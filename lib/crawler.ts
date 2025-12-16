import axios from 'axios'
import * as cheerio from 'cheerio'
import { chromium, Browser } from 'playwright'

export interface ScanResult {
  url: string
  status: 'found' | 'not_found' | 'error' | 'skipped'
  result: 1 | 0 | string
  method?: 'http' | 'browser'
  error?: string
}

// URLs that should be skipped (PDFs, downloads, etc.)
function shouldSkipUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase()
  return (
    lowerUrl.endsWith('.pdf') ||
    lowerUrl.includes('.pdf?') ||
    lowerUrl.includes('/pdf/') ||
    lowerUrl.includes('/download') ||
    lowerUrl.includes('file-pdf') ||
    lowerUrl.endsWith('.zip') ||
    lowerUrl.endsWith('.exe') ||
    lowerUrl.endsWith('.dmg')
  )
}

// Check if response indicates we're blocked
function isBlocked(statusCode: number, html: string): boolean {
  if (statusCode === 403 || statusCode === 429 || statusCode === 503) {
    return true
  }
  const lowerHtml = html.toLowerCase()
  return (
    lowerHtml.includes('captcha') ||
    lowerHtml.includes('cloudflare') ||
    lowerHtml.includes('access denied') ||
    lowerHtml.includes('please verify') ||
    lowerHtml.includes('rate limit')
  )
}

// Check if page likely needs JavaScript
function needsJavaScript(html: string): boolean {
  const lowerHtml = html.toLowerCase()
  // Very little text content but has scripts
  const textLength = html.replace(/<[^>]*>/g, '').trim().length
  const hasReactRoot = lowerHtml.includes('id="root"') || lowerHtml.includes('id="__next"')
  const hasAppDiv = lowerHtml.includes('id="app"')

  return textLength < 500 && (hasReactRoot || hasAppDiv)
}

// Timeout configuration
const HTTP_TIMEOUT = 30000    // 30 seconds for HTTP requests
const BROWSER_TIMEOUT = 60000 // 60 seconds for browser navigation

// HTTP-first approach
async function tryHttpFetch(url: string, keyword: string): Promise<{ success: boolean; found?: boolean; html?: string; error?: string }> {
  try {
    const response = await axios.get(url, {
      timeout: HTTP_TIMEOUT,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
      validateStatus: (status) => status < 500,
    })

    const html = response.data

    if (isBlocked(response.status, html)) {
      return { success: false, error: 'blocked' }
    }

    if (needsJavaScript(html)) {
      return { success: false, error: 'needs_js' }
    }

    // Parse HTML and extract text
    const $ = cheerio.load(html)
    $('script, style, noscript, iframe').remove()
    const text = $('body').text().toLowerCase()

    const found = text.includes(keyword.toLowerCase())
    return { success: true, found, html }

  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Browser fallback using Playwright
let browserInstance: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-http2',
      ],
    })
  }
  return browserInstance
}

async function tryBrowserFetch(url: string, keyword: string): Promise<{ success: boolean; found?: boolean; error?: string }> {
  let context = null
  let page = null

  try {
    const browser = await getBrowser()

    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
    })

    // Block unnecessary resources
    await context.route('**/*', (route) => {
      const resourceType = route.request().resourceType()
      if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
        return route.abort()
      }
      return route.continue()
    })

    page = await context.newPage()
    page.setDefaultTimeout(BROWSER_TIMEOUT)

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: BROWSER_TIMEOUT })
    await page.waitForTimeout(3000) // Let JS render

    const text = await page.evaluate(() => {
      document.querySelectorAll('script, style, noscript, iframe').forEach(el => el.remove())
      return document.body?.innerText?.toLowerCase() || ''
    })

    const found = text.includes(keyword.toLowerCase())
    return { success: true, found }

  } catch (error: any) {
    return { success: false, error: error.message }
  } finally {
    if (page) await page.close().catch(() => {})
    if (context) await context.close().catch(() => {})
  }
}

// Main scan function
export async function scanUrl(url: string, keyword: string): Promise<ScanResult> {
  // Validate URL
  try {
    new URL(url)
  } catch {
    return { url, status: 'error', result: 'Invalid URL', error: 'Invalid URL format' }
  }

  // Skip PDFs and downloads
  if (shouldSkipUrl(url)) {
    return { url, status: 'skipped', result: 'Skipped (PDF/Download)' }
  }

  // Try HTTP first
  const httpResult = await tryHttpFetch(url, keyword)

  if (httpResult.success) {
    return {
      url,
      status: httpResult.found ? 'found' : 'not_found',
      result: httpResult.found ? 1 : 0,
      method: 'http',
    }
  }

  // Fall back to browser
  const browserResult = await tryBrowserFetch(url, keyword)

  if (browserResult.success) {
    return {
      url,
      status: browserResult.found ? 'found' : 'not_found',
      result: browserResult.found ? 1 : 0,
      method: 'browser',
    }
  }

  // Both failed
  return {
    url,
    status: 'error',
    result: browserResult.error || 'Unknown error',
    error: browserResult.error,
  }
}

// Batch scan with concurrency control
export async function scanUrls(
  urls: string[],
  keyword: string,
  concurrency: number,
  onProgress: (result: ScanResult, index: number, total: number) => void
): Promise<ScanResult[]> {
  const results: ScanResult[] = []
  const total = urls.length
  let currentIndex = 0

  async function processNext(): Promise<void> {
    while (currentIndex < urls.length) {
      const index = currentIndex++
      const url = urls[index]

      const result = await scanUrl(url, keyword)
      results[index] = result
      onProgress(result, index + 1, total)
    }
  }

  // Start workers
  const workers = Array(Math.min(concurrency, urls.length))
    .fill(null)
    .map(() => processNext())

  await Promise.all(workers)

  return results
}

// Cleanup browser on shutdown
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close()
    browserInstance = null
  }
}
