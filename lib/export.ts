import * as XLSX from 'xlsx'
import { ScanResult } from './crawler'

export function generateCSV(results: ScanResult[], keyword: string): string {
  const headers = ['URL', `Contains "${keyword}"`, 'Method', 'Error']
  const rows = results.map(r => [
    r.url,
    typeof r.result === 'number' ? r.result.toString() : r.result,
    r.method || '',
    r.error || '',
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma
        const escaped = String(cell).replace(/"/g, '""')
        return escaped.includes(',') || escaped.includes('\n') ? `"${escaped}"` : escaped
      }).join(',')
    ),
  ].join('\n')

  return csvContent
}

export function generateXLSX(results: ScanResult[], keyword: string): Buffer {
  const data = results.map(r => ({
    'URL': r.url,
    [`Contains "${keyword}"`]: typeof r.result === 'number' ? r.result : r.result,
    'Method': r.method || '',
    'Error': r.error || '',
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)

  // Set column widths
  worksheet['!cols'] = [
    { wch: 60 }, // URL
    { wch: 20 }, // Contains keyword
    { wch: 10 }, // Method
    { wch: 40 }, // Error
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Scan Results')

  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
}
