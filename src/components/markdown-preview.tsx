"use client";

import { useEffect, useRef, useState } from "react";

import { EyeIcon, SpinnerIcon } from "@/components/icons";
import type { ExportOptions } from "@/lib/export-options";

interface MarkdownPreviewProps {
  readonly markdown: string;
  readonly options: ExportOptions;
}

/**
 * Live HTML preview of Markdown using the same render pipeline as PDF export.
 *
 * @param props - Markdown source and export options.
 * @returns Preview panel with debounced server render and paper metaphor.
 */
export function MarkdownPreview({ markdown, options }: MarkdownPreviewProps): React.ReactElement {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);

      void fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown, options }),
      })
        .then(async (res) => {
          const json: unknown = await res.json();
          if (!res.ok) {
            const message =
              typeof json === "object" && json !== null && "error" in json && typeof (json as { error: unknown }).error === "string"
                ? (json as { error: string }).error
                : "Preview failed.";
            throw new Error(message);
          }
          if (requestId !== requestIdRef.current) {
            return;
          }
          const previewHtml =
            typeof json === "object" && json !== null && "html" in json && typeof (json as { html: unknown }).html === "string"
              ? (json as { html: string }).html
              : "";
          setHtml(previewHtml);
        })
        .catch((err: unknown) => {
          if (requestId !== requestIdRef.current) {
            return;
          }
          setError(err instanceof Error ? err.message : "Preview failed.");
        })
        .finally(() => {
          if (requestId === requestIdRef.current) {
            setLoading(false);
          }
        });
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [markdown, options]);

  return (
    <div className="flex h-full min-h-[min(70vh,800px)] flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <EyeIcon className="h-4 w-4 text-foreground" aria-hidden />
          <span className="text-sm font-semibold text-foreground">Live preview</span>
        </div>
        {loading ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-text-tertiary">
            <SpinnerIcon className="h-3.5 w-3.5 motion-safe:animate-spin" />
            Updating
          </span>
        ) : (
          <span className="text-xs text-text-tertiary">Matches PDF output</span>
        )}
      </div>

      <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-border-subtle bg-preview-canvas p-4">
        {error ? (
          <p className="rounded-lg bg-surface p-4 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : html ? (
          <div className="mx-auto w-full max-w-full flex-1 overflow-hidden rounded-sm shadow-lg ring-1 ring-black/5">
            <iframe
              title="Markdown preview"
              srcDoc={html}
              className="h-full min-h-[min(60vh,700px)] w-full border-0 bg-white"
              sandbox=""
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface/50 p-8 text-center">
            <EyeIcon className="h-8 w-8 text-text-tertiary opacity-50" aria-hidden />
            <p className="text-sm font-medium text-text-secondary">Preview appears here</p>
            <p className="text-xs text-text-tertiary">Start writing Markdown to see the rendered layout</p>
          </div>
        )}
      </div>
    </div>
  );
}
