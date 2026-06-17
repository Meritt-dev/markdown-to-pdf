# Roadmap

This document outlines the planned evolution of **Markdown to PDF**.

Tier 1 is already implemented (preview, export options, themes, dev:all, job history). The following tiers focus on professional-grade output, operational reliability, and expanding the product's reach.

---

## Tier 2 — PDF Quality ✅ IMPLEMENTED

Focus: Moving from "basic GFM" to "professional document engine."

| Feature | Description | Files Touched | Priority | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Front matter (YAML)** | Support `---` blocks for title, author, date. Render as a cover block and inject into PDF metadata. | `src/lib/md/front-matter.ts`, `src/lib/md/render-markdown.ts`, `src/lib/gotenberg.ts`, `scripts/worker.ts` | High | ✅ Done |
| **Syntax highlighting** | Add code block highlighting using rehype-highlight. | `src/lib/md/pipeline.ts`, `src/lib/md/themes/base.ts` | High | ✅ Done |
| **Table of Contents** | Automatic TOC generation from headings using `remark-toc`. | `src/lib/md/pipeline.ts` | Medium | ✅ Done |
| **Image Support** | Fetch remote images and inline them as Base64 to ensure PDFs are self-contained. | `src/lib/md/rehype-inline-images.ts`, `src/lib/md/pipeline.ts` | Medium | ✅ Done |
| **Math** | Support KaTeX for LaTeX formulas (inline `$...$` and display `$$...$$`). | `src/lib/md/pipeline.ts`, `src/lib/md/render-markdown.ts` | Low | ✅ Done |

### Implementation Notes
- **Architecture**: Split into modular pipeline under `src/lib/md/`:
  - `pipeline.ts` — unified processor factory with all Tier 2 plugins
  - `front-matter.ts` — YAML parsing, extraction, and cover HTML generation
  - `rehype-inline-images.ts` — image fetching and base64 inlining plugin
  - `types.ts` — DocumentMetadata and MarkdownProcessingResult interfaces
- **Front matter**: Uses `remark-frontmatter` + custom `remarkExtractFrontmatter` and `remarkStripFrontmatter` plugins. Metadata is passed to Gotenberg's `pdfTitle` and `pdfAuthor` fields.
- **Syntax highlighting**: Uses `rehype-highlight` with embedded CSS styles in themes.
- **Table of Contents**: Uses `remark-toc` to auto-generate TOC from `## Table of Contents` heading placeholder.
- **Images**: Custom `rehype-inline-images` plugin fetches http/https images and converts to data URIs with timeout and size limits.
- **Math**: Uses `remark-math` + `rehype-katex` with embedded KaTeX CSS.
- **Diagram support (Mermaid)**: Deferred to future tier — requires build-time rendering or browser-based client-side approach.

---

## Tier 3 — Reliability & Ops ✅ IMPLEMENTED

Focus: Making the system production-ready and self-healing.

| Feature | Description | Files Touched | Priority | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Stale Job Recovery** | Automatically reset jobs stuck in `running` for >10 mins back to `pending` or `failed`. | `src/lib/db/jobs.ts`, `scripts/worker.ts` | High | ✅ Done |
| **Retention / Cleanup** | Cron-like task to delete PDFs and database rows older than N days (e.g., 7 days). | `scripts/cleanup.ts` (new), `src/lib/paths.ts` | High | ✅ Done |
| **Health Endpoint** | `GET /api/health` to verify Postgres connectivity and Gotenberg availability. | `src/app/api/health/route.ts` (new) | Medium | ✅ Done |
| **SSE Status** | Replace UI polling with Server-Sent Events for real-time job updates. | `src/app/api/jobs/[id]/stream/route.ts` (new), `src/components/job-console.tsx` | Medium | ✅ Done |
| **App Image** | Unified Dockerfile to run both the Next.js app and the background worker. | `Dockerfile` (new), `docker-compose.yml` | Medium | ✅ Done |

### Implementation Notes
- **Cleanup**: The worker periodically runs stale job recovery. A standalone `npm run cleanup` script deletes jobs older than `JOB_RETENTION_DAYS` and unlinks corresponding files in `PDF_STORAGE_PATH`.
- **SSE**: Uses a `LISTEN/NOTIFY` pattern in Postgres to trigger SSE updates from the worker to the API. UI falls back to polling if SSE connection fails.
- **Docker**: The `app` service uses a shell entrypoint to run both Next.js and the worker concurrently.

---

## Tier 4 — Product Shape

Focus: Expanding beyond a simple web UI into a platform and toolchain.

| Feature | Description | Files Touched | Priority |
| :--- | :--- | :--- | :--- |
| **CLI Tool** | `md2pdf README.md -o out.pdf` — a standalone binary or script for terminal use. | `bin/md2pdf` (new) | High |
| **GitHub Action** | Official action to convert docs to PDF on every push or PR. | `.github/workflows/` | Medium |
| **API Keys** | Simple token-based auth for the `POST /api/jobs` endpoint. | `src/lib/db/auth.ts` (new), `middleware.ts` | Medium |
| **Batch Mode** | Upload a ZIP or folder of Markdown files and receive a ZIP of PDFs. | `src/app/api/jobs/batch/route.ts` (new) | Low |
| **Custom CSS** | Allow users to provide a custom CSS string or file to override theme styles. | `src/lib/export-options.ts`, `src/lib/md/themes/` | Low |
| **Org Templates** | Pre-baked themes for specific organizations (e.g., Meritt-branded). | `src/lib/md/themes/meritt.ts` (new) | Low |

### Implementation Notes
- **CLI**: The CLI should wrap `curl` calls to the local or remote API, handling polling and downloading automatically.
- **API Keys**: Add an `api_keys` table. Use a Next.js middleware to check the `Authorization: Bearer <token>` header against the database.

---

## Principles

- **Zero-config where possible**: Sensible defaults for all new features.
- **Self-contained PDFs**: All assets (CSS, images, fonts) must be embedded in the final file.
- **Traceability**: Every action (cleanup, recovery, batch) must be logged.
