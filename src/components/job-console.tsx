"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DEFAULT_EXPORT_OPTIONS, ExportOptionsPanel } from "@/components/export-options-panel";
import {
  DownloadIcon,
  EyeIcon,
  FileIcon,
  PencilIcon,
  SpinnerIcon,
  UploadIcon,
  ColumnsIcon,
} from "@/components/icons";
import { JobHistory } from "@/components/job-history";
import { MarkdownPreview } from "@/components/markdown-preview";
import type { ExportOptions } from "@/lib/export-options";

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
      return "Queued — waiting for worker";
    case "running":
      return "Generating your PDF…";
    case "completed":
      return "PDF ready to download";
    case "failed":
      return "Export failed";
    default:
      return status;
  }
}

function statusAccentClass(status: string | null): string {
  switch (status) {
    case "pending":
      return "border-warning/30 bg-warning/10";
    case "running":
      return "border-foreground/20 bg-foreground/5";
    case "completed":
      return "border-success/30 bg-success/10";
    case "failed":
      return "border-danger/30 bg-danger/10";
    default:
      return "border-border-subtle bg-surface-muted/40";
  }
}

/**
 * Primary workspace: editor, live preview, export options, and job history.
 */
export function JobConsole(): React.ReactElement {
  const [markdown, setMarkdown] = useState(sampleMarkdown);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [exportOptions, setExportOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [activePane, setActivePane] = useState<"edit" | "preview" | "split">("edit");
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileHint, setFileHint] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const pollRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const charCount = markdown.length;

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
        setHistoryRefreshKey((k) => k + 1);
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
      body: JSON.stringify({ markdown, options: exportOptions }),
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
    setHistoryRefreshKey((k) => k + 1);

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
    <div className="flex w-full flex-col gap-6">
      <ExportOptionsPanel options={exportOptions} onChange={setExportOptions} disabled={busy} />

      <div className="card-elevated overflow-hidden">
        {/* Workspace toolbar */}
        <div className="flex flex-col gap-3 border-b border-border-subtle bg-surface-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="inline-flex rounded-lg border border-border-subtle bg-surface p-1" role="tablist" aria-label="Editor or preview">
            <button
              type="button"
              role="tab"
              aria-selected={activePane === "edit"}
              onClick={() => {
                setActivePane("edit");
              }}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                activePane === "edit" ? "tab-active shadow-sm" : "text-text-secondary hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              <PencilIcon className="h-4 w-4" aria-hidden />
              Edit
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activePane === "preview"}
              onClick={() => {
                setActivePane("preview");
              }}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                activePane === "preview" ? "tab-active shadow-sm" : "text-text-secondary hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              <EyeIcon className="h-4 w-4" aria-hidden />
              Preview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activePane === "split"}
              onClick={() => {
                setActivePane("split");
              }}
              className={`hidden cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 lg:inline-flex ${
                activePane === "split" ? "tab-active shadow-sm" : "text-text-secondary hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              <ColumnsIcon className="h-4 w-4" aria-hidden />
              Split
            </button>
          </div>

          <div className="flex items-center gap-2">
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
              className="btn-secondary px-3 py-2 text-sm"
            >
              <UploadIcon className="h-4 w-4" aria-hidden />
              Upload
            </button>
            <button
              type="button"
              onClick={() => {
                void onSubmit();
              }}
              disabled={busy || markdown.trim().length === 0}
              className="btn-primary px-5 py-2.5 text-sm"
            >
              {busy ? (
                <>
                  <SpinnerIcon className="h-4 w-4 motion-safe:animate-spin" />
                  Exporting…
                </>
              ) : (
                "Export PDF"
              )}
            </button>
          </div>
        </div>

        {/* Editor / Preview panes */}
        <div className={`grid ${activePane === "split" ? "lg:grid-cols-2" : "grid-cols-1"}`}>
          <section
            className={`relative border-border-subtle transition-colors duration-200 ${
              activePane === "split" ? "lg:border-r" : ""
            } ${activePane === "preview" ? "hidden" : "block"} ${
              isDragging ? "bg-foreground/5 ring-2 ring-inset ring-foreground/20" : ""
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
            {isDragging ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-foreground/5 backdrop-blur-[1px]">
                <p className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-md">
                  Drop your .md file here
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Your document</h2>
                  <p className="text-xs text-text-tertiary">Paste Markdown or drop a file</p>
                </div>
                <span className="font-mono text-xs text-text-tertiary">{charCount.toLocaleString()} chars</span>
              </div>

              {loadedFileName ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-muted px-3 py-1.5 text-xs font-medium text-foreground">
                    <FileIcon className="h-3.5 w-3.5 text-text-secondary" aria-hidden />
                    {loadedFileName}
                  </span>
                  <button
                    type="button"
                    className="cursor-pointer text-xs font-medium text-text-secondary hover:text-foreground hover:underline"
                    onClick={() => {
                      setLoadedFileName(null);
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : null}

              {fileHint ? (
                <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning" role="status">
                  {fileHint}
                </p>
              ) : null}

              <label htmlFor="md" className="sr-only">
                Markdown source
              </label>
              <textarea
                id="md"
                className="input-base min-h-[min(70vh,800px)] w-full resize-y p-4 font-mono text-[13px] leading-relaxed"
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

          <div className={`p-4 sm:p-5 ${activePane === "edit" ? "hidden" : "block"}`}>
            <MarkdownPreview markdown={markdown} options={exportOptions} />
          </div>
        </div>
      </div>

      {(jobId !== null || status !== null || error !== null || downloadUrl !== null) && (
        <section
          className={`rounded-xl border p-5 transition-colors duration-200 ${statusAccentClass(status)}`}
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              {busy ? (
                <SpinnerIcon className="mt-0.5 h-5 w-5 shrink-0 text-foreground motion-safe:animate-spin" aria-hidden />
              ) : (
                <span
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                    status === "completed"
                      ? "bg-success"
                      : status === "failed"
                        ? "bg-danger"
                        : status === "running"
                          ? "bg-foreground motion-safe:animate-pulse"
                          : "bg-warning"
                  }`}
                  aria-hidden
                />
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">{formatStatusLabel(status)}</p>
                {jobId ? (
                  <p className="mt-1 break-all font-mono text-xs text-text-tertiary">{jobId}</p>
                ) : null}
              </div>
            </div>
            {downloadUrl ? (
              <a href={downloadUrl} className="btn-primary w-full px-5 py-2.5 text-sm sm:w-auto">
                <DownloadIcon className="h-4 w-4" />
                Download PDF
              </a>
            ) : null}
          </div>
          {error ? (
            <p className="mt-4 whitespace-pre-wrap rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      )}

      <JobHistory
        refreshKey={historyRefreshKey}
        onSelectJob={(id) => {
          setJobId(id);
        }}
      />
    </div>
  );
}
