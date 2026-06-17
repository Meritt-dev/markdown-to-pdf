"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface JobStatusPayload {
  readonly id: string;
  readonly status: string;
  readonly error: string | null;
  readonly downloadUrl: string | null;
}

const MAX_MARKDOWN_BYTES = 2_000_000;

const sampleMarkdown = `# Markdown → PDF test

Paragraph with a **verylongunbrokenword** and a normal URL: https://example.com/path/to/something?query=long-value-here

## Table

| Column A | Column B | Notes |
| -------- | -------- | ----- |
| Short | Another | OK |
| Long technical identifier that should wrap | Value | Check wrapping |
| \`inline code cell with_long_token\` | 42 | Code in cells |

## Code

\`\`\`ts
const example = "strings that might overflow in some renderers";
\`\`\`

## Task list

- [x] Generate PDF
- [ ] Iterate on CSS
`;

function isMarkdownLikeFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    return true;
  }
  const type = file.type;
  return type === "text/markdown" || type === "text/x-markdown";
}

/**
 * Reads a dropped or selected file as UTF-8 text after basic validation.
 *
 * @param file - File from input or DataTransfer.
 * @returns File text content.
 * @throws Error when type/size is invalid.
 */
async function readMarkdownFile(file: File): Promise<string> {
  if (!isMarkdownLikeFile(file)) {
    throw new Error("Please use a .md or .markdown file.");
  }
  if (file.size > MAX_MARKDOWN_BYTES) {
    throw new Error("That file is too large. Try a smaller document.");
  }
  const text = await file.text();
  if (new TextEncoder().encode(text).length > MAX_MARKDOWN_BYTES) {
    throw new Error("That file is too large after decoding.");
  }
  return text;
}

function formatStatusLabel(status: string | null): string {
  if (!status) {
    return "—";
  }
  switch (status) {
    case "pending":
      return "Queued";
    case "running":
      return "Generating PDF";
    case "completed":
      return "Ready";
    case "failed":
      return "Something went wrong";
    default:
      return status;
  }
}

function statusDotClass(status: string | null): string {
  switch (status) {
    case "pending":
      return "bg-amber-400";
    case "running":
      return "bg-sky-500 motion-safe:animate-pulse";
    case "completed":
      return "bg-emerald-500";
    case "failed":
      return "bg-red-500";
    default:
      return "bg-zinc-300 dark:bg-zinc-600";
  }
}

/**
 * Primary workspace: load Markdown from paste, upload, or drag-and-drop, then convert to PDF.
 */
export function JobConsole(): React.ReactElement {
  const [markdown, setMarkdown] = useState(sampleMarkdown);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileHint, setFileHint] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollJob = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/jobs/${id}`, { method: "GET" });
      const json: unknown = await res.json();
      if (!res.ok) {
        const message =
          typeof json === "object" && json !== null && "error" in json && typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : "Could not load export status.";
        throw new Error(message);
      }

      const payload = json as JobStatusPayload;
      setStatus(payload.status);
      setError(payload.error);
      setDownloadUrl(payload.downloadUrl);

      if (payload.status === "completed" || payload.status === "failed") {
        stopPolling();
        setBusy(false);
      }
    },
    [stopPolling],
  );

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const applyLoadedMarkdown = useCallback((text: string, fileName: string | null) => {
    setMarkdown(text);
    setLoadedFileName(fileName);
    setFileHint(null);
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      const first = list[0];
      if (!first) {
        return;
      }
      try {
        const text = await readMarkdownFile(first);
        applyLoadedMarkdown(text, first.name);
      } catch (err: unknown) {
        setFileHint(err instanceof Error ? err.message : "Could not read that file.");
      }
    },
    [applyLoadedMarkdown],
  );

  async function onSubmit(): Promise<void> {
    setBusy(true);
    setJobId(null);
    setStatus(null);
    setError(null);
    setDownloadUrl(null);
    stopPolling();

    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown }),
    });

    const json: unknown = await res.json();
    if (!res.ok) {
      setBusy(false);
      const message =
        typeof json === "object" && json !== null && "error" in json && typeof (json as { error: unknown }).error === "string"
          ? (json as { error: string }).error
          : "Could not start export.";
      setError(message);
      return;
    }

    const id = typeof json === "object" && json !== null && "id" in json ? String((json as { id: unknown }).id) : "";
    if (!id) {
      setBusy(false);
      setError("Unexpected response from the server.");
      return;
    }

    setJobId(id);
    setStatus("pending");

    pollRef.current = window.setInterval(() => {
      pollJob(id).catch((err: unknown) => {
        stopPolling();
        setBusy(false);
        setError(err instanceof Error ? err.message : "Lost connection while exporting.");
      });
    }, 900);

    await pollJob(id).catch((err: unknown) => {
      stopPolling();
      setBusy(false);
      setError(err instanceof Error ? err.message : "Lost connection while exporting.");
    });
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-8">
      <section
        className={`relative overflow-hidden rounded-2xl border transition-colors ${
          isDragging
            ? "border-sky-400 bg-sky-50/80 ring-2 ring-sky-300/60 dark:border-sky-500 dark:bg-sky-950/40 dark:ring-sky-600/50"
            : "border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950/60"
        }`}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragDepthRef.current += 1;
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragDepthRef.current -= 1;
          if (dragDepthRef.current <= 0) {
            dragDepthRef.current = 0;
            setIsDragging(false);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragDepthRef.current = 0;
          setIsDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex flex-col gap-4 p-6 sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Your document</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Paste Markdown below, or drop a <span className="font-medium text-zinc-700 dark:text-zinc-300">.md</span> file anywhere in this
                area.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.markdown,text/markdown"
                className="sr-only"
                aria-label="Upload Markdown file"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files?.length) {
                    void handleFiles(files);
                  }
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                <UploadIcon className="h-4 w-4 opacity-70" aria-hidden />
                Upload file
              </button>
            </div>
          </div>

          {loadedFileName ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
                <FileIcon className="h-3.5 w-3.5 opacity-70" aria-hidden />
                {loadedFileName}
              </span>
              <button
                type="button"
                className="text-sm font-medium text-sky-700 underline-offset-4 hover:underline dark:text-sky-400"
                onClick={() => {
                  setLoadedFileName(null);
                }}
              >
                Remove
              </button>
            </div>
          ) : null}

          {fileHint ? (
            <p className="text-sm text-amber-800 dark:text-amber-200" role="status">
              {fileHint}
            </p>
          ) : null}

          <label htmlFor="md" className="sr-only">
            Markdown source
          </label>
          <textarea
            id="md"
            className="min-h-[280px] w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 font-mono text-[13px] leading-relaxed text-zinc-900 shadow-inner outline-none ring-zinc-300/80 transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-400/30 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-50 dark:focus:border-sky-500 dark:focus:bg-zinc-950 dark:focus:ring-sky-500/25"
            value={markdown}
            onChange={(e) => {
              setMarkdown(e.target.value);
              setLoadedFileName(null);
              setFileHint(null);
            }}
            spellCheck={false}
            placeholder="Write or paste Markdown here…"
          />
        </div>
      </section>

      <div>
        <button
          type="button"
          onClick={() => {
            void onSubmit();
          }}
          disabled={busy || markdown.trim().length === 0}
          className="inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Spinner />
              Working…
            </span>
          ) : (
            "Export PDF"
          )}
        </button>
      </div>

      {(jobId !== null || status !== null || error !== null || downloadUrl !== null) && (
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${statusDotClass(status)}`}
                aria-hidden
              />
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{formatStatusLabel(status)}</p>
                {jobId ? (
                  <p className="mt-1 break-all font-mono text-xs text-zinc-500 dark:text-zinc-400">{jobId}</p>
                ) : null}
              </div>
            </div>
            {downloadUrl ? (
              <a
                className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 sm:w-auto"
                href={downloadUrl}
              >
                Download PDF
              </a>
            ) : null}
          </div>
          {error ? (
            <p className="mt-4 whitespace-pre-wrap text-sm text-red-700 dark:text-red-300" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}

function Spinner(): React.ReactElement {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function UploadIcon({ className }: { readonly className?: string }): React.ReactElement {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function FileIcon({ className }: { readonly className?: string }): React.ReactElement {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
