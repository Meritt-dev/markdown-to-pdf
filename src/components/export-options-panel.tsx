"use client";

import { useState } from "react";

import { ChevronDownIcon, SettingsIcon } from "@/components/icons";
import type { ExportOptions, MarginPreset, PaperSize, PrintTheme } from "@/lib/export-options";
import {
  DEFAULT_EXPORT_OPTIONS,
  MARGIN_PRESETS,
  PAPER_SIZES,
  PRINT_THEMES,
} from "@/lib/export-options";
import { marginPresetLabel, paperSizeLabel } from "@/lib/md/themes";

interface ExportOptionsPanelProps {
  readonly options: ExportOptions;
  readonly onChange: (options: ExportOptions) => void;
  readonly disabled?: boolean;
}

const THEME_LABELS: Record<PrintTheme, string> = {
  default: "Default",
  minimal: "Minimal",
  docs: "Docs",
};

const THEME_DESCRIPTIONS: Record<PrintTheme, string> = {
  default: "Balanced sans-serif with bordered tables",
  minimal: "Serif, light rules, editorial feel",
  docs: "Technical docs with accent headings",
};

/**
 * Export settings: theme pills, paper size, margins, and page numbers.
 *
 * @param props - Panel state and change handler.
 * @returns Export options form controls.
 */
export function ExportOptionsPanel({
  options,
  onChange,
  disabled = false,
}: ExportOptionsPanelProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  function patch(partial: Partial<ExportOptions>): void {
    onChange({ ...options, ...partial });
  }

  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        onClick={() => {
          setExpanded((v) => !v);
        }}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-muted/60"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse export options" : "Expand export options"}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted text-foreground">
            <SettingsIcon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Export options</h2>
            <p className="text-xs text-text-tertiary">
              {THEME_LABELS[options.theme]} · {paperSizeLabel(options.paperSize)} · {marginPresetLabel(options.marginPreset).split(" (")[0]}
              {options.showPageNumbers ? " · Page numbers" : ""}
            </p>
          </div>
        </div>
        <ChevronDownIcon
          className={`h-4 w-4 text-text-secondary transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {expanded ? (
        <div className="space-y-5 border-t border-border-subtle px-5 pb-5 pt-4">
          <fieldset disabled={disabled} className="space-y-2 disabled:opacity-60">
            <legend className="text-xs font-medium text-text-secondary">Theme</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {PRINT_THEMES.map((theme) => {
                const active = options.theme === theme;
                return (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => {
                      patch({ theme });
                    }}
                    className={`cursor-pointer rounded-xl border px-3 py-2.5 text-left transition-all duration-150 ${
                      active
                        ? "border-foreground bg-surface-muted ring-2 ring-foreground/15"
                        : "border-border-subtle bg-surface-muted/40 hover:border-border hover:bg-surface-muted"
                    }`}
                    aria-pressed={active}
                  >
                    <span className="block text-sm font-semibold text-foreground">{THEME_LABELS[theme]}</span>
                    <span className="mt-0.5 block text-xs text-text-tertiary">{THEME_DESCRIPTIONS[theme]}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary">Paper size</span>
              <select
                value={options.paperSize}
                disabled={disabled}
                onChange={(e) => {
                  patch({ paperSize: e.target.value as PaperSize });
                }}
                className="input-base cursor-pointer px-3 py-2.5 text-sm disabled:cursor-not-allowed"
              >
                {PAPER_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {paperSizeLabel(size)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary">Margins</span>
              <select
                value={options.marginPreset}
                disabled={disabled}
                onChange={(e) => {
                  patch({ marginPreset: e.target.value as MarginPreset });
                }}
                className="input-base cursor-pointer px-3 py-2.5 text-sm disabled:cursor-not-allowed"
              >
                {MARGIN_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {marginPresetLabel(preset)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-border-subtle bg-surface-muted/40 px-4 py-3">
              <input
                type="checkbox"
                checked={options.showPageNumbers}
                disabled={disabled}
                onChange={(e) => {
                  patch({ showPageNumbers: e.target.checked });
                }}
                className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-foreground"
              />
              <span className="text-sm text-foreground">Page numbers in footer</span>
            </label>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export { DEFAULT_EXPORT_OPTIONS };
