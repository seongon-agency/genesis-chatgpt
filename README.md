# URL Keyword Scanner

A high-performance web application for scanning multiple URLs to check if they contain a specific keyword. Built with Next.js 14 and features real-time progress streaming, intelligent crawling with browser fallback, and export capabilities.

## Features

- **Bulk URL Scanning** - Scan hundreds of URLs simultaneously with configurable concurrency
- **Real-time Progress** - Live updates via Server-Sent Events (SSE) as each URL is processed
- **Smart Crawling Strategy**
  - HTTP-first approach using axios + cheerio for speed
  - Automatic Playwright browser fallback for JavaScript-rendered pages
  - Handles CAPTCHAs, Cloudflare protection, and rate limiting detection
- **Resource Optimization** - Blocks images, fonts, and stylesheets in browser mode
- **Export Results** - Download scan results as CSV or XLSX
- **Modern UI** - Clean interface built with shadcn/ui and Tailwind CSS
- **Docker Ready** - Includes Dockerfile for easy deployment

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI**: React 18 + shadcn/ui + Tailwind CSS
- **HTTP Client**: Axios + Cheerio
- **Browser Automation**: Playwright
- **Export**: xlsx library
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd url-keyword-scanner
```

2. Install dependencies:
```bash
npm install
```

3. Install Playwright browser (required for browser fallback):
```bash
npx playwright install chromium
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Enter a keyword** - The term you want to search for on each page
2. **Paste URLs** - One URL per line in the textarea
3. **Adjust concurrency** - Higher values = faster but may trigger rate limits (default: 20)
4. **Click "Start Scan"** - Watch real-time progress as URLs are scanned
5. **Export results** - Download as CSV or XLSX when complete

### Result Statuses

| Status | Description |
|--------|-------------|
| Found (1) | Keyword was found on the page |
| Not Found (0) | Keyword was not found on the page |
| Error | Failed to fetch the page |
| Skipped | URL was skipped (PDF, download link, etc.) |

### Methods

| Method | Description |
|--------|-------------|
| HTTP | Fast path using axios + cheerio |
| Browser | Playwright fallback for JS-rendered pages |

## API Reference

### POST /api/scan

Starts a scan and streams results via SSE.

**Request Body:**
```json
{
  "urls": ["https://example.com/page1", "https://example.com/page2"],
  "keyword": "search term",
  "concurrency": 20
}
```

**SSE Events:**
- `start` - Scan initiated, includes total URL count
- `progress` - Individual URL result with index
- `complete` - Final results with summary statistics

### POST /api/export

Generates a downloadable file with scan results.

**Request Body:**
```json
{
  "results": [...],
  "keyword": "search term",
  "format": "csv" | "xlsx"
}
```

**Response:** Binary file download

## Architecture

```
app/
├── page.tsx              # Main UI component
├── layout.tsx            # Root layout with metadata
├── globals.css           # Global styles (Tailwind)
└── api/
    ├── scan/route.ts     # SSE streaming endpoint
    └── export/route.ts   # File export endpoint

components/ui/            # shadcn/ui components
├── button.tsx
├── card.tsx
├── input.tsx
├── label.tsx
├── slider.tsx
└── textarea.tsx

lib/
├── crawler.ts            # Crawling logic (HTTP + Playwright)
├── export.ts             # CSV/XLSX generation
└── utils.ts              # Utility functions
```

### Crawling Strategy

The crawler uses a two-phase approach:

1. **HTTP-first (fast path)**
   - Uses axios for HTTP requests with proper headers
   - Parses HTML with cheerio
   - Works for most static websites
   - 30-second timeout

2. **Browser fallback (Playwright)**
   - Triggered when HTTP fails (403, CAPTCHA, rate limit)
   - Triggered when page requires JavaScript rendering
   - Blocks unnecessary resources for speed
   - 60-second timeout

## Configuration

| Setting | Default | Max | Description |
|---------|---------|-----|-------------|
| Concurrency | 20 | 50 | Parallel requests |
| HTTP Timeout | 30s | - | Timeout for HTTP requests |
| Browser Timeout | 60s | - | Timeout for Playwright |

## Deployment

### Railway (Recommended)

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login and deploy:
```bash
railway login
railway up
```

Or connect your GitHub repository to Railway for automatic deployments.

### Docker

Build and run locally:
```bash
docker build -t url-keyword-scanner .
docker run -p 3000:3000 url-keyword-scanner
```

### Manual Deployment

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

## Skipped URL Types

The following URL patterns are automatically skipped:
- PDF files (`.pdf`, `/pdf/`)
- Download links (`/download`)
- Binary files (`.zip`, `.exe`, `.dmg`)

## License

MIT
