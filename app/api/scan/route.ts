import { NextRequest } from 'next/server'
import { scanUrl, closeBrowser, type ScanResult } from '@/lib/crawler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { urls, keyword, concurrency = 20 } = await request.json()

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return new Response(JSON.stringify({ error: 'URLs array is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!keyword || typeof keyword !== 'string' || keyword.trim() === '') {
    return new Response(JSON.stringify({ error: 'Keyword is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Clean and filter URLs
  const cleanUrls = urls
    .map((url: string) => url.trim())
    .filter((url: string) => url.length > 0)

  if (cleanUrls.length === 0) {
    return new Response(JSON.stringify({ error: 'No valid URLs provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const results: ScanResult[] = []
      const total = cleanUrls.length
      let currentIndex = 0
      const actualConcurrency = Math.min(concurrency, 50) // Cap at 50

      const sendEvent = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // Send start event
      sendEvent({ type: 'start', total, keyword, concurrency: actualConcurrency })

      async function processUrl(url: string, index: number): Promise<ScanResult> {
        const result = await scanUrl(url, keyword.trim())
        sendEvent({
          type: 'progress',
          index: index + 1,
          total,
          result,
        })
        return result
      }

      // Process with concurrency control
      async function processNext(): Promise<void> {
        while (currentIndex < cleanUrls.length) {
          const index = currentIndex++
          const url = cleanUrls[index]
          const result = await processUrl(url, index)
          results[index] = result
        }
      }

      try {
        // Start concurrent workers
        const workers = Array(Math.min(actualConcurrency, cleanUrls.length))
          .fill(null)
          .map(() => processNext())

        await Promise.all(workers)

        // Calculate summary
        const found = results.filter(r => r.status === 'found').length
        const notFound = results.filter(r => r.status === 'not_found').length
        const errors = results.filter(r => r.status === 'error').length
        const skipped = results.filter(r => r.status === 'skipped').length

        // Send complete event
        sendEvent({
          type: 'complete',
          summary: { total, found, notFound, errors, skipped },
          results,
        })

      } catch (error: any) {
        sendEvent({ type: 'error', message: error.message })
      } finally {
        // Close browser after scan
        await closeBrowser()
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
