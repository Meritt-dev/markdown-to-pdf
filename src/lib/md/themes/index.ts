import type { ExportOptions, PrintTheme } from "@/lib/export-options";

import { buildBasePrintCss } from "./base";
import { defaultThemeCss } from "./default";
import { docsThemeCss } from "./docs";
import { minimalThemeCss } from "./minimal";

/**
 * Returns theme-specific CSS for the given theme id.
 *
 * @param theme - Print theme identifier.
 * @returns CSS string for the theme layer.
 */
function themeLayerCss(theme: PrintTheme): string {
  switch (theme) {
    case "minimal":
      return minimalThemeCss();
    case "docs":
      return docsThemeCss();
    default:
      return defaultThemeCss();
  }
}

/**
 * Builds complete print CSS for a document (base + theme + page model).
 *
 * @param options - Export options.
 * @returns Full embedded stylesheet for PDF rendering.
 *
 * @example
 * const css = buildPrintThemeCss({ theme: "docs", paperSize: "a4", marginPreset: "default", showPageNumbers: false });
 */
export function buildPrintThemeCss(options: ExportOptions): string {
  return `${buildBasePrintCss(options)}\n${themeLayerCss(options.theme)}`;
}

export { marginPresetLabel, paperSizeLabel } from "./base";
