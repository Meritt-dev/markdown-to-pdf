import { z } from "zod";

export const PRINT_THEMES = ["default", "minimal", "docs"] as const;
export const PAPER_SIZES = ["a4", "letter"] as const;
export const MARGIN_PRESETS = ["narrow", "default", "wide"] as const;

export type PrintTheme = (typeof PRINT_THEMES)[number];
export type PaperSize = (typeof PAPER_SIZES)[number];
export type MarginPreset = (typeof MARGIN_PRESETS)[number];

export interface ExportOptions {
  readonly theme: PrintTheme;
  readonly paperSize: PaperSize;
  readonly marginPreset: MarginPreset;
  readonly showPageNumbers: boolean;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  theme: "default",
  paperSize: "a4",
  marginPreset: "default",
  showPageNumbers: false,
};

export const exportOptionsSchema = z.object({
  theme: z.enum(PRINT_THEMES).optional(),
  paperSize: z.enum(PAPER_SIZES).optional(),
  marginPreset: z.enum(MARGIN_PRESETS).optional(),
  showPageNumbers: z.boolean().optional(),
});

/**
 * Merges partial export options with defaults.
 *
 * @param partial - Options from API or UI.
 * @returns Complete export options.
 */
export function resolveExportOptions(partial?: Partial<ExportOptions>): ExportOptions {
  return {
    theme: partial?.theme ?? DEFAULT_EXPORT_OPTIONS.theme,
    paperSize: partial?.paperSize ?? DEFAULT_EXPORT_OPTIONS.paperSize,
    marginPreset: partial?.marginPreset ?? DEFAULT_EXPORT_OPTIONS.marginPreset,
    showPageNumbers: partial?.showPageNumbers ?? DEFAULT_EXPORT_OPTIONS.showPageNumbers,
  };
}

/**
 * Margin preset in millimeters (applied via CSS `@page`).
 *
 * @param preset - Named margin preset.
 * @returns Margin size in mm.
 */
export function marginPresetToMm(preset: MarginPreset): number {
  switch (preset) {
    case "narrow":
      return 8;
    case "wide":
      return 20;
    default:
      return 12;
  }
}

/**
 * Paper dimensions for Gotenberg (inches).
 *
 * @param paperSize - A4 or Letter.
 * @returns Width and height in inches.
 */
export function paperSizeToInches(paperSize: PaperSize): { readonly width: number; readonly height: number } {
  if (paperSize === "letter") {
    return { width: 8.5, height: 11 };
  }
  return { width: 8.27, height: 11.7 };
}

/**
 * Serializes export options for Postgres JSONB storage.
 *
 * @param options - Export options.
 * @returns JSON string.
 */
export function serializeExportOptions(options: ExportOptions): string {
  return JSON.stringify(options);
}

/**
 * Parses export options from a database JSON value.
 *
 * @param value - Raw JSON from Postgres.
 * @returns Parsed export options.
 */
export function parseExportOptions(value: unknown): ExportOptions {
  if (value === null || value === undefined) {
    return DEFAULT_EXPORT_OPTIONS;
  }
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  const result = exportOptionsSchema.safeParse(parsed);
  if (!result.success) {
    return DEFAULT_EXPORT_OPTIONS;
  }
  return resolveExportOptions(result.data);
}
