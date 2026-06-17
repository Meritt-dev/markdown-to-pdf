"use client";

import { useCallback, useEffect, useState } from "react";

import { DownloadIcon, RefreshIcon, SpinnerIcon } from "@/components/icons";
import type { ExportOptions } from "@/lib/export-options";

interface JobHistoryItem {
  readonly id: string;
  readonly status: string;
  readonly error: string | null;
  readonly options: ExportOptions;
  readonly createdAt: string;
  readonly downloadUrl: string | null;
}

interface JobHistoryProps {
  readonly refreshKey: number;
  readonly onSelectJob?: (jobId: string) => void;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) {
    return "Just now";
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return `${diffHr}h ago`;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Queued";
    case "running":
      return "Generating";
    case "completed":
      return "Ready";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "bg-success/15 text-success";
    case "failed":
      return "bg-danger/15 text-danger";
    case "running":
      return "bg-foreground/10 text-foreground";
    default:
      return "bg-warning/15 text-warning";
  }
}

/**
 * Lists recent conversion jobs with re-download links.
 *
 * @param props - Refresh trigger and optional job selection handler.
 * @returns Job history panel.
 */
export function JobHistory({ refreshKey, onSelectJob }: JobHistoryProps): React.ReactElement {
  const [jobs, setJobs] = useState<readonly JobHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs?limit=15");
      const json: unknown = await res.json();
      if (!res.ok) {
        throw new Error("Could not load history.");
      }
      const items =
        typeof json === "object" && json !== null && "jobs" in json && Array.isArray((json as { jobs: unknown }).jobs)
          ? (json as { jobs: JobHistoryItem[] }).jobs
          : [];
      setJobs(items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, refreshKey]);

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Recent exports</h2>
          <p className="mt-0.5 text-xs text-text-tertiary">Re-download completed PDFs from this session.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadHistory();
          }}
          className="btn-secondary shrink-0 px-3 py-2 text-xs"
          aria-label="Refresh export history"
        >
          <RefreshIcon className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {loading && jobs.length === 0 ? (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-text-tertiary">
          <SpinnerIcon className="h-4 w-4 motion-safe:animate-spin" />
          Loading history…
        </div>
      ) : error ? (
        <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : jobs.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border-subtle bg-surface-muted/30 px-4 py-8 text-center">
          <p className="text-sm font-medium text-text-secondary">No exports yet</p>
          <p className="mt-1 text-xs text-text-tertiary">Your completed PDFs will appear here</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(job.status)}`}>
                    {statusLabel(job.status)}
                  </span>
                  <span className="text-xs text-text-tertiary">{formatRelativeTime(job.createdAt)}</span>
                  <span className="rounded-md bg-surface px-2 py-0.5 text-xs text-text-secondary">
                    {job.options.theme} · {job.options.paperSize}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSelectJob?.(job.id);
                  }}
                  className="mt-1.5 block max-w-full cursor-pointer truncate font-mono text-xs text-text-tertiary transition-colors hover:text-foreground"
                  title={job.id}
                >
                  {job.id}
                </button>
                {job.error ? (
                  <p className="mt-1 line-clamp-2 text-xs text-danger">{job.error}</p>
                ) : null}
              </div>
              {job.downloadUrl ? (
                <a href={job.downloadUrl} className="btn-primary shrink-0 px-4 py-2 text-xs">
                  <DownloadIcon className="h-3.5 w-3.5" />
                  Download
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
