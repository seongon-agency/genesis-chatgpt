import { NextRequest } from 'next/server'
import { generateCSV, generateXLSX } from '@/lib/export'
import { ScanResult } from '@/lib/crawler'

export async function POST(request: NextRequest) {
  const { results, keyword, format } = await request.json()

  if (!results || !Array.isArray(results)) {
    return new Response(JSON.stringify({ error: 'Results array is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!keyword) {
    return new Response(JSON.stringify({ error: 'Keyword is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const timestamp = new Date().toISOString().slice(0, 10)
  const filename = `scan-results-${timestamp}`

  if (format === 'xlsx') {
    const buffer = generateXLSX(results as ScanResult[], keyword)
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
      },
    })
  } else {
    const csv = generateCSV(results as ScanResult[], keyword)
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    })
  }
}
