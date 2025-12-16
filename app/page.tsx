'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Search, Loader2, CheckCircle, XCircle, AlertCircle, SkipForward } from 'lucide-react'

interface ScanResult {
  url: string
  status: 'found' | 'not_found' | 'error' | 'skipped'
  result: 1 | 0 | string
  method?: 'http' | 'browser'
  error?: string
}

interface Summary {
  total: number
  found: number
  notFound: number
  errors: number
  skipped: number
}

export default function Home() {
  const [urls, setUrls] = useState('')
  const [keyword, setKeyword] = useState('')
  const [concurrency, setConcurrency] = useState(20)
  const [isScanning, setIsScanning] = useState(false)
  const [results, setResults] = useState<ScanResult[]>([])
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [summary, setSummary] = useState<Summary | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const urlCount = urls.split('\n').filter(u => u.trim()).length

  const handleScan = async () => {
    const urlList = urls.split('\n').filter(u => u.trim())

    if (urlList.length === 0) {
      alert('Please enter at least one URL')
      return
    }

    if (!keyword.trim()) {
      alert('Please enter a keyword')
      return
    }

    setIsScanning(true)
    setResults([])
    setSummary(null)
    setProgress({ current: 0, total: urlList.length })

    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urlList, keyword: keyword.trim(), concurrency }),
        signal: abortControllerRef.current.signal,
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No response body')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'progress') {
              setProgress({ current: data.index, total: data.total })
              setResults(prev => {
                const newResults = [...prev]
                newResults[data.index - 1] = data.result
                return newResults
              })
            } else if (data.type === 'complete') {
              setSummary(data.summary)
              setResults(data.results)
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Scan error:', error)
        alert('Scan failed: ' + error.message)
      }
    } finally {
      setIsScanning(false)
    }
  }

  const handleStop = () => {
    abortControllerRef.current?.abort()
    setIsScanning(false)
  }

  const handleExport = async (format: 'csv' | 'xlsx') => {
    const response = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results, keyword, format }),
    })

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scan-results-${new Date().toISOString().slice(0, 10)}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'found':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'not_found':
        return <XCircle className="h-5 w-5 text-gray-400" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'skipped':
        return <SkipForward className="h-5 w-5 text-yellow-500" />
      default:
        return null
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">URL Keyword Scanner</h1>
          <p className="text-gray-600">Check if URLs contain a specific keyword</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Enter URLs and keyword to scan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyword">Keyword</Label>
                <Input
                  id="keyword"
                  placeholder="e.g., Techcombank"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  disabled={isScanning}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="urls">
                  URLs {urlCount > 0 && <span className="text-muted-foreground">({urlCount} URLs)</span>}
                </Label>
                <Textarea
                  id="urls"
                  placeholder="https://example.com/page1&#10;https://example.com/page2&#10;https://example.com/page3"
                  className="h-48 font-mono text-sm"
                  value={urls}
                  onChange={(e) => setUrls(e.target.value)}
                  disabled={isScanning}
                />
              </div>

              <div className="space-y-2">
                <Label>Concurrency: {concurrency}</Label>
                <Slider
                  value={[concurrency]}
                  onValueChange={([value]) => setConcurrency(value)}
                  min={1}
                  max={50}
                  step={1}
                  disabled={isScanning}
                />
                <p className="text-xs text-muted-foreground">
                  Number of parallel requests (higher = faster, but may cause blocks)
                </p>
              </div>

              <div className="flex gap-2">
                {!isScanning ? (
                  <Button onClick={handleScan} className="flex-1">
                    <Search className="h-4 w-4 mr-2" />
                    Start Scan
                  </Button>
                ) : (
                  <Button onClick={handleStop} variant="destructive" className="flex-1">
                    Stop
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Progress & Summary Section */}
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
              <CardDescription>
                {isScanning
                  ? `Scanning ${progress.current} of ${progress.total} URLs...`
                  : summary
                  ? 'Scan complete'
                  : 'Ready to scan'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isScanning && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm">
                      {progress.current} / {progress.total}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {summary && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">{summary.found}</div>
                      <div className="text-sm text-green-700">Found</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-gray-600">{summary.notFound}</div>
                      <div className="text-sm text-gray-700">Not Found</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-red-600">{summary.errors}</div>
                      <div className="text-sm text-red-700">Errors</div>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-yellow-600">{summary.skipped}</div>
                      <div className="text-sm text-yellow-700">Skipped</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={() => handleExport('csv')} variant="outline" className="flex-1">
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                    <Button onClick={() => handleExport('xlsx')} variant="outline" className="flex-1">
                      <Download className="h-4 w-4 mr-2" />
                      Export XLSX
                    </Button>
                  </div>
                </div>
              )}

              {!isScanning && !summary && (
                <p className="text-muted-foreground text-center py-8">
                  Enter URLs and keyword, then click &quot;Start Scan&quot;
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results Table */}
        {results.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>
                {results.filter(r => r).length} of {progress.total} URLs scanned
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">#</th>
                      <th className="text-left py-3 px-4 font-medium">URL</th>
                      <th className="text-center py-3 px-4 font-medium">Result</th>
                      <th className="text-center py-3 px-4 font-medium">Method</th>
                      <th className="text-left py-3 px-4 font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, index) =>
                      result ? (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 text-muted-foreground">{index + 1}</td>
                          <td className="py-3 px-4">
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline break-all"
                            >
                              {result.url.length > 60
                                ? result.url.slice(0, 60) + '...'
                                : result.url}
                            </a>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {getStatusIcon(result.status)}
                              <span
                                className={
                                  result.status === 'found'
                                    ? 'text-green-600 font-medium'
                                    : result.status === 'error'
                                    ? 'text-red-600'
                                    : 'text-gray-500'
                                }
                              >
                                {typeof result.result === 'number' ? result.result : result.status}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {result.method && (
                              <span
                                className={`px-2 py-1 rounded text-xs ${
                                  result.method === 'http'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-purple-100 text-purple-700'
                                }`}
                              >
                                {result.method}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-red-600 text-xs">
                            {result.error && result.error.slice(0, 50)}
                          </td>
                        </tr>
                      ) : null
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
