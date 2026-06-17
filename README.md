# Markdown to PDF

A Next.js app that converts Markdown to PDF. Jobs are queued in Postgres, processed by a background worker, and rendered with [Gotenberg](https://gotenberg.dev/).

## Prerequisites

- **Node.js** 18+ (20+ recommended)
- **Docker** (for Postgres and Gotenberg)

## Run locally

You need three pieces running: Docker services (Postgres + Gotenberg), the Next.js dev server, and the background worker.

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

The defaults in `.env.example` work with `docker compose`:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://md2pdf:md2pdf@localhost:5432/md2pdf` | Postgres connection string |
| `GOTENBERG_URL` | `http://localhost:3030` | Gotenberg API (host port maps to container `3000`) |
| `PDF_STORAGE_PATH` | `./data/pdfs` | Where generated PDFs are stored (created automatically) |
| `DOCUMENT_LOCALE` | `en` (optional) | BCP 47 tag for CSS hyphenation |

The worker loads `.env.local` first, then `.env`, so keep the same variables in both if you use a `.env` file.

### 3. Start infrastructure

```bash
docker compose up -d
```

This starts:

- **Postgres** on `localhost:5432`
- **Gotenberg** on `localhost:3030`

### 4. Start the app (terminal 1)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Start the worker (terminal 2)

```bash
npm run worker
```

The worker polls the database, converts Markdown to HTML, sends it to Gotenberg, and saves PDFs. **Without the worker, jobs stay pending.**

### 6. Try it

Paste Markdown on the homepage and click **Convert to PDF**. When the job completes, download the PDF from the UI.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js in development mode |
| `npm run worker` | Run the background job processor |
| `npm run build` | Production build |
| `npm run start` | Start the production server (run `build` first) |
| `npm run lint` | Run ESLint |

## Production-style run

```bash
docker compose up -d
npm run build
npm run start   # terminal 1
npm run worker  # terminal 2
```

You still need Docker and the worker for PDF conversion to work.

## How it works

1. The UI submits Markdown via the API; a job row is created in Postgres (`pending`).
2. The worker claims pending jobs, renders Markdown to HTML, and calls Gotenberg to produce a PDF.
3. Completed PDFs are written to `PDF_STORAGE_PATH` and served via the download API.

Database migrations run automatically on first database access—no separate migrate step is required.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Connection refused on port `5432` or `3030` | Run `docker compose ps` and ensure both services are up |
| Jobs stuck on “pending” | Start the worker with `npm run worker` |
| Gotenberg errors | Confirm `GOTENBERG_URL=http://localhost:3030` in `.env.local` |

Stop Docker when finished:

```bash
docker compose down
```

## Stack

- [Next.js](https://nextjs.org/) — App Router, API routes
- [Postgres](https://www.postgresql.org/) — Job queue and status
- [Gotenberg](https://gotenberg.dev/) — HTML to PDF conversion
- [unified](https://github.com/unifiedjs/unified) / remark / rehype — Markdown rendering
