# Markdown to PDF

**Write Markdown. Get a print-ready PDF.**

Self-hosted Markdown → PDF conversion with a job queue, background worker, and Chromium rendering via Gotenberg. Paste or upload a document, convert, and download when it’s ready.

Web UI + API. Async jobs in Postgres. PDFs stored on disk — no external SaaS required.

**Source:** [github.com/Meritt-dev/markdown-to-pdf](https://github.com/Meritt-dev/markdown-to-pdf)

```bash
cp .env.example .env.local
docker compose up -d
npm install
npm run dev:all   # Next.js + worker in one terminal
```

Open [http://localhost:3000](http://localhost:3000), tune export options, preview your document, and click **Export PDF**.

Or run app and worker separately: `npm run dev` (terminal 1) and `npm run worker` (terminal 2).

---

## What it does

You submit Markdown through the UI or API. The app queues a job, a worker renders it to HTML with print-first CSS, and Gotenberg turns that HTML into a PDF you can download.

It does not block the request while Chromium runs. Jobs move through `pending` → `running` → `completed` (or `failed`), and the UI polls until the PDF is ready.

Every conversion leaves a traceable job record.

## What it is not

| **Online converters** | Upload to a third-party site |
| --------------------- | ---------------------------- |
| **Pandoc / CLI tools** | One-shot terminal conversion |
| **Markdown to PDF**   | Self-hosted, queued, API-backed |

This is not a WYSIWYG editor or a hosted document service. It is a small pipeline you run locally (or deploy yourself) with full control over storage and rendering.

> Paste Markdown in. Print-ready PDF out.

## Getting started

```bash
cp .env.example .env.local
docker compose up -d
npm install
npm run dev:all
```

1. Open [http://localhost:3000](http://localhost:3000)
2. Paste Markdown or drop a `.md` file
3. Pick a theme, paper size, margins, and optional page numbers
4. Check the live preview panel
5. Click **Export PDF** and download when status shows **Ready**

The worker must be running — `npm run dev:all` starts it automatically.

## How it works

**Markdown in. PDF out.**

| Input              | Pipeline                    | Output                    |
| ------------------ | --------------------------- | ------------------------- |
| Markdown (GFM + YAML) | remark plugins → rehype plugins | Print-themed HTML with embedded assets |
| UI or `POST /api/jobs` | Job row in Postgres     | Job ID + status polling   |
| Background worker  | Gotenberg Chromium route    | PDF on disk with metadata |
| Download API       | `GET /api/jobs/:id/download` | `application/pdf`    |

Pipeline: **Markdown → unified processor (frontmatter, TOC, math, syntax highlighting, image inlining) → HTML → Chromium print → PDF**

## What it renders

GitHub Flavored Markdown with professional document features and a print-first theme:

- **Front matter (YAML)** — Extract title, author, date from `---` blocks; render as cover page; inject into PDF metadata
- **Syntax highlighting** — Color-coded code blocks with rehype-highlight
- **Table of Contents** — Auto-generated from headings with `## Table of Contents` placeholder
- **Mathematics** — LaTeX formulas rendered with KaTeX (inline: `$...$`, display: `$$...$$`)
- **Remote images** — Fetched and inlined as base64 data URIs for self-contained PDFs
- **GFM support** — Tables, task lists, strikethrough, autolinks
- **Typography** — Headings, paragraphs, blockquotes, lists, code blocks
- **Print-first CSS** — A4/Letter page model, hyphenation, table wrapping, page breaks

HTML is sanitized before rendering. All CSS, fonts, and images are embedded — PDF output does not depend on external assets.

## Example flow

```bash
# Create a job with export options
curl -s -X POST http://localhost:3000/api/jobs \
  -H 'Content-Type: application/json' \
  -d '{"markdown":"# Hello\n\n| A | B |\n|---|---|\n| 1 | 2 |","options":{"theme":"docs","paperSize":"a4","marginPreset":"default","showPageNumbers":true}}'

# Preview without creating a job
curl -s -X POST http://localhost:3000/api/preview \
  -H 'Content-Type: application/json' \
  -d '{"markdown":"# Preview","options":{"theme":"minimal"}}'

# List recent jobs
curl -s http://localhost:3000/api/jobs?limit=10

# Poll status (replace <id> with the returned job id)
curl -s http://localhost:3000/api/jobs/<id>

# Download when status is "completed"
curl -o out.pdf http://localhost:3000/api/jobs/<id>/download
```

```
POST /api/preview       →  { "html": "…" }
POST /api/jobs          →  { "id": "…" }
GET  /api/jobs          →  { "jobs": [ … ] }
GET  /api/jobs/:id      →  { "status": "completed", "downloadUrl": "…", "options": { … } }
GET  /api/jobs/:id/download  →  PDF bytes
GET  /api/jobs/:id/stream    →  Server-Sent Events (real-time status)
GET  /api/health        →  { "status": "ok"|"degraded", "postgres": boolean, "gotenberg": boolean }
```

## Principles

**Self-hosted** — Postgres, Gotenberg, and PDF storage run under your control.

**Async by default** — Conversion runs in a worker; the API returns immediately with a job ID.

**Print-first** — CSS targets Chromium’s print engine (A4, hyphenation, table wrapping).

**No magic migrations** — Schema is applied automatically on first database access.

## Capabilities

**Today**

* Web UI with paste, file upload, drag-and-drop, and real-time status updates (SSE)
* **Live preview** — side-by-side editor and server-rendered HTML preview
* **Export options** — theme (default / minimal / docs), A4 or Letter, margin presets, page numbers
* **Job history** — recent exports with re-download
* **Health monitoring** — `/api/health` endpoint to verify Postgres and Gotenberg connectivity
* **Stale job recovery** — automatic reset of jobs stuck in `running` state for >10 minutes
* **Automated cleanup** — retention policy to delete old jobs and PDFs (default: 7 days)
* **Server-Sent Events** — real-time job status updates without polling
* **Professional document features (Tier 2)**
  * **Front matter** — YAML metadata blocks (`title`, `author`, `date`) with cover page rendering and PDF metadata injection
  * **Syntax highlighting** — Automatic code block highlighting with rehype-highlight
  * **Table of Contents** — Auto-generated TOC from headings
  * **Mathematics** — KaTeX rendering for inline and display math formulas
  * **Image inlining** — Remote images fetched and embedded as base64 for self-contained PDFs
* REST API for create, preview, list, status, and download
* GFM rendering (tables, task lists, code fences, strikethrough)
* Sanitized HTML + embedded print CSS
* Gotenberg 8 Chromium PDF generation
* Postgres job queue with background worker
* Docker Compose for Postgres + Gotenberg + App (full-stack deployment)

**Reasonable extensions**

* Custom themes / brand CSS
* Auth and multi-tenant job isolation
* Object storage instead of local disk
* Webhooks on job completion

See [ROADMAP.md](./ROADMAP.md) for the full Tier 2-4 plan.

---

## Architecture

The app is organized in four layers:

**Presentation**

* **Next.js UI** — `JobConsole`: paste/upload Markdown, poll job status, download PDF
* **API routes** — `POST /api/jobs`, `GET /api/jobs/:id`, `GET /api/jobs/:id/download`

**Job queue**

* **Postgres** — `jobs` table (`pending` → `running` → `completed` / `failed`)
* **Worker** — `scripts/worker.ts` polls, claims jobs, orchestrates conversion

**Rendering**

* **remark / rehype** — GFM parse, sanitize, stringify to HTML
* **Print theme** — embedded CSS (`@page`, tables, code, hyphenation)
* **Gotenberg** — Chromium HTML → PDF (`/forms/chromium/convert/html`)

**Storage**

* **Local disk** — PDFs written to `PDF_STORAGE_PATH` (default `./data/pdfs`)

```
Browser / curl
    → Next.js API (create job)
    → Postgres (pending)
    → Worker (claim → render HTML → Gotenberg → write PDF)
    → Postgres (completed)
    → Download API
```

## Configuration

Copy `.env.example` to `.env.local`. The worker loads `.env.local` first, then `.env`.

| Variable | Default | Role |
| -------- | ------- | ---- |
| `DATABASE_URL` | `postgresql://md2pdf:md2pdf@localhost:5432/md2pdf` | Postgres connection string |
| `GOTENBERG_URL` | `http://localhost:3030` | Gotenberg API (host `3030` → container `3000`) |
| `PDF_STORAGE_PATH` | `./data/pdfs` | Where completed PDFs are stored (created automatically) |
| `DOCUMENT_LOCALE` | `en` | BCP 47 tag for CSS hyphenation |
| `STALE_JOB_MINUTES` | `10` | Minutes before a running job is considered stale and reset |
| `JOB_RETENTION_DAYS` | `7` | Days to retain jobs and PDFs before automatic cleanup |

Job `options` (JSON) accepted by `POST /api/jobs` and `POST /api/preview`:

| Field | Values | Default |
| ----- | ------ | ------- |
| `theme` | `default`, `minimal`, `docs` | `default` |
| `paperSize` | `a4`, `letter` | `a4` |
| `marginPreset` | `narrow` (8 mm), `default` (12 mm), `wide` (20 mm) | `default` |
| `showPageNumbers` | `true` / `false` | `false` |

**Secrets are never committed.** Keep credentials in `.env.local` (gitignored).

`docker compose` provisions Postgres and Gotenberg with defaults that match `.env.example`:

```yaml
# docker-compose.yml (summary)
postgres:  localhost:5432  (user/db: md2pdf)
gotenberg: localhost:3030  (API_TIMEOUT: 120s)
```

## Prerequisites

| Requirement | Role |
| ----------- | ---- |
| Node.js 18+ (20+ recommended) | Next.js app and worker |
| Docker | Postgres 16 and Gotenberg 8 via `docker compose` |

Docker is required for local infrastructure. The app and worker run on the host with `npm`.

## Local development

```bash
cp .env.example .env.local
docker compose up -d                  # Postgres + Gotenberg
npm install
npm run dev:all                       # Next.js + worker (recommended)
# or: npm run dev + npm run worker in separate terminals
```

**Quick verification**

1. Ensure `docker compose ps` shows Postgres and Gotenberg healthy
2. Open the UI, paste sample Markdown, click **Convert to PDF**
3. Confirm the worker logs a completed job and the UI offers a download

Stop infrastructure when finished:

```bash
docker compose down
```

### Production-style run

```bash
docker compose up -d
npm run build
npm run start    # terminal 1
npm run worker   # terminal 2
```

### Scripts

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | Next.js development server |
| `npm run dev:all` | Next.js + worker together (recommended for local dev) |
| `npm run worker` | Background job processor |
| `npm run cleanup` | Delete old jobs and PDFs (respects `JOB_RETENTION_DAYS`) |
| `npm run build` | Production build |
| `npm run start` | Production server (run `build` first) |
| `npm run lint` | ESLint |

### Troubleshooting

| Issue | Fix |
| ----- | --- |
| Connection refused on `5432` or `3030` | `docker compose ps` — ensure both services are up |
| Jobs stuck on “Queued” / `pending` | Start the worker: `npm run worker` |
| Gotenberg errors | Confirm `GOTENBERG_URL=http://localhost:3030` in `.env.local` |

## Operational Features

### Health Monitoring

Check system health with the `/api/health` endpoint:

```bash
curl http://localhost:3000/api/health
```

Returns `200 OK` when all services are healthy, `503 Service Unavailable` if any dependency is down:

```json
{
  "status": "ok",
  "postgres": true,
  "gotenberg": true
}
```

### Stale Job Recovery

The worker automatically recovers jobs stuck in `running` state:

- Runs on worker startup
- Checks every 60 seconds during operation
- Resets jobs stuck for longer than `STALE_JOB_MINUTES` (default: 10 minutes)
- Marks recovered jobs as `failed` with timeout message

### Cleanup and Retention

Delete old jobs and PDFs to prevent unbounded storage growth:

```bash
npm run cleanup
```

- Removes jobs and PDFs older than `JOB_RETENTION_DAYS` (default: 7 days)
- Can be run manually or scheduled as a cron job
- Logs deleted job count and any file deletion errors

### Real-Time Status Updates

The UI uses Server-Sent Events (SSE) for instant job status updates:

- Connects to `/api/jobs/:id/stream` when a job is created
- Receives status changes in real-time via Postgres LISTEN/NOTIFY
- Falls back to polling if SSE connection fails
- No manual refresh needed — status updates automatically

## Docker Deployment

Run the entire stack (app + worker + dependencies) with Docker Compose:

```bash
docker compose up -d
```

The `app` service runs both the Next.js server and background worker in a single container.

**Services:**

- `app` — Next.js + worker (port 3000)
- `postgres` — Postgres 16 (port 5432)
- `gotenberg` — Gotenberg 8 (internal)

**Volumes:**

- `md2pdf_pgdata` — Postgres data
- `md2pdf_pdfs` — Generated PDF files

**Environment:**

The `app` service is configured via `docker-compose.yml`. To customize, edit the `environment` section or use a `.env` file.

## Layout

```
src/
  app/
    api/jobs/           REST API (create, list, status, download)
    api/jobs/[id]/stream/   Server-Sent Events for real-time status
    api/preview/        Live HTML preview (no job created)
    api/health/         Health check endpoint
    page.tsx            Home UI
  components/
    job-console.tsx     Editor, preview, export, status (with SSE)
    export-options-panel.tsx
    markdown-preview.tsx
    job-history.tsx
  lib/
    export-options.ts   Theme, paper, margin, page number types
    db/                 Postgres pool, migrations, job queries
    md/themes/          Print CSS themes (default, minimal, docs)
    gotenberg.ts        HTML → PDF client
scripts/
  worker.ts             Background job processor with stale job recovery
  cleanup.ts            Retention cleanup script
```

## Foundation

* [Next.js](https://nextjs.org/) 16 — App Router, API routes
* [Postgres](https://www.postgresql.org/) 16 — job queue and status
* [Gotenberg](https://gotenberg.dev/) 8 — Chromium PDF rendering
* [unified](https://github.com/unifiedjs/unified) / remark / rehype — GFM → HTML
* [Tailwind CSS](https://tailwindcss.com/) 4 — UI styling
