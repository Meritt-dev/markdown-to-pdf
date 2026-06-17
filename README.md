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
| Markdown (GFM)     | remark → rehype → sanitize  | Print-themed HTML         |
| UI or `POST /api/jobs` | Job row in Postgres     | Job ID + status polling   |
| Background worker  | Gotenberg Chromium route    | PDF on disk               |
| Download API       | `GET /api/jobs/:id/download` | `application/pdf`    |

Pipeline: **Markdown → HTML → Chromium print → PDF**

## What it renders

GitHub Flavored Markdown with a print-first theme baked into the HTML:

- Headings, paragraphs, blockquotes
- Tables (with wrapping for long cells)
- Task lists
- Fenced code blocks
- Links and inline code
- A4 page model with `@page` margins

HTML is sanitized before rendering. CSS is embedded — PDF output does not depend on external assets.

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
```

## Principles

**Self-hosted** — Postgres, Gotenberg, and PDF storage run under your control.

**Async by default** — Conversion runs in a worker; the API returns immediately with a job ID.

**Print-first** — CSS targets Chromium’s print engine (A4, hyphenation, table wrapping).

**No magic migrations** — Schema is applied automatically on first database access.

## Capabilities

**Today**

* Web UI with paste, file upload, drag-and-drop, and status polling
* **Live preview** — side-by-side editor and server-rendered HTML preview
* **Export options** — theme (default / minimal / docs), A4 or Letter, margin presets, page numbers
* **Job history** — recent exports with re-download
* REST API for create, preview, list, status, and download
* GFM rendering (tables, task lists, code fences)
* Sanitized HTML + embedded print CSS
* Gotenberg 8 Chromium PDF generation
* Postgres job queue with background worker
* Docker Compose for Postgres + Gotenberg

**Reasonable extensions**

* Custom themes / brand CSS
* Auth and multi-tenant job isolation
* Object storage instead of local disk
* Webhooks on job completion

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
| `npm run build` | Production build |
| `npm run start` | Production server (run `build` first) |
| `npm run lint` | ESLint |

### Troubleshooting

| Issue | Fix |
| ----- | --- |
| Connection refused on `5432` or `3030` | `docker compose ps` — ensure both services are up |
| Jobs stuck on “Queued” / `pending` | Start the worker: `npm run worker` |
| Gotenberg errors | Confirm `GOTENBERG_URL=http://localhost:3030` in `.env.local` |

## Layout

```
src/
  app/
    api/jobs/           REST API (create, list, status, download)
    api/preview/        Live HTML preview (no job created)
    page.tsx            Home UI
  components/
    job-console.tsx     Editor, preview, export, status
    export-options-panel.tsx
    markdown-preview.tsx
    job-history.tsx
  lib/
    export-options.ts   Theme, paper, margin, page number types
    db/                 Postgres pool, migrations, job queries
    md/themes/          Print CSS themes (default, minimal, docs)
    gotenberg.ts        HTML → PDF client
```

## Foundation

* [Next.js](https://nextjs.org/) 16 — App Router, API routes
* [Postgres](https://www.postgresql.org/) 16 — job queue and status
* [Gotenberg](https://gotenberg.dev/) 8 — Chromium PDF rendering
* [unified](https://github.com/unifiedjs/unified) / remark / rehype — GFM → HTML
* [Tailwind CSS](https://tailwindcss.com/) 4 — UI styling
