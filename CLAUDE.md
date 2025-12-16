# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A URL keyword scanner built with Next.js. Users enter a list of URLs and a keyword, and the app checks each URL to see if it contains that keyword. Results are displayed in a table and can be exported to CSV/XLSX.

## Commands

```bash
# Install dependencies
npm install

# Install Playwright browsers (required for browser fallback)
npx playwright install chromium

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Architecture

```
app/
├── page.tsx              # Main UI (React + shadcn/ui)
├── layout.tsx            # Root layout
├── globals.css           # Tailwind CSS styles
└── api/
    ├── scan/route.ts     # SSE streaming endpoint for scanning
    └── export/route.ts   # CSV/XLSX export endpoint

components/ui/            # shadcn/ui components

lib/
├── crawler.ts            # HTTP-first + Playwright fallback crawler
├── export.ts             # CSV/XLSX generation
└── utils.ts              # Utility functions (cn)
```

## Crawling Strategy

The crawler uses a two-phase approach:

1. **HTTP-first (fast path)**: Uses axios + cheerio to fetch and parse HTML
   - Fast and lightweight
   - Works for most static sites

2. **Browser fallback**: Uses Playwright when HTTP fails
   - Triggered when site blocks requests (403, captcha)
   - Triggered when site requires JavaScript rendering
   - Resource blocking enabled (images, fonts, stylesheets)

## API Endpoints

### POST /api/scan
Starts a scan and streams results via Server-Sent Events (SSE).

Request body:
```json
{
  "urls": ["https://example.com/page1", "..."],
  "keyword": "Techcombank",
  "concurrency": 20
}
```

Events:
- `start`: Scan started, includes total count
- `progress`: Individual URL result
- `complete`: All results + summary

### POST /api/export
Generates downloadable CSV or XLSX file.

Request body:
```json
{
  "results": [...],
  "keyword": "Techcombank",
  "format": "csv" | "xlsx"
}
```

## Deployment (Railway)

The project includes a Dockerfile configured for Railway deployment with Playwright browser support.

```bash
# Deploy via Railway CLI
railway up
```

Or connect the GitHub repo to Railway for automatic deployments.

## Key Configuration

- **Concurrency**: Default 20, max 50 parallel requests (user-configurable in UI)
- **HTTP timeout**: 30 seconds
- **Browser timeout**: 60 seconds
- **Resource blocking**: Images, fonts, stylesheets blocked in browser mode
