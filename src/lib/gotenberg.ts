import type { ExportOptions } from "@/lib/export-options";
import { marginPresetToMm, paperSizeToInches } from "@/lib/export-options";

const FOOTER_HEIGHT_INCHES = 0.45;

/**
 * Builds Gotenberg footer HTML with page numbers.
 *
 * @returns Complete footer HTML document.
 */
function buildFooterHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    html {
      font-size: 9pt;
      font-family: system-ui, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <p>Page <span class="pageNumber"></span> of <span class="totalPages"></span></p>
</body>
</html>`;
}

/**
 * Converts millimeters to inches for Gotenberg margin fields.
 *
 * @param mm - Margin in millimeters.
 * @returns Margin in inches (2 decimal places).
 */
function mmToInches(mm: number): number {
  return Math.round((mm / 25.4) * 100) / 100;
}

/**
 * Optional PDF metadata to embed in the generated PDF.
 */
export interface PdfMetadata {
  /**
   * Document title.
   */
  readonly title?: string;

  /**
   * Document author.
   */
  readonly author?: string;
}

/**
 * Converts an HTML document to PDF bytes using a Gotenberg 8 Chromium route.
 *
 * @param html - Full HTML document (with embedded CSS recommended).
 * @param options - Paper size, margins, and footer options.
 * @param metadata - Optional PDF metadata (title, author) to embed in the PDF.
 * @returns PDF binary.
 * @throws Error when Gotenberg is unreachable or returns a non-OK response.
 *
 * @example
 * const pdf = await convertHtmlToPdf("<!DOCTYPE html><html>...</html>", options, { title: "My Doc" });
 */
export async function convertHtmlToPdf(
  html: string,
  options: ExportOptions,
  metadata?: PdfMetadata,
): Promise<Buffer> {
  const baseUrl = process.env.GOTENBERG_URL ?? "http://localhost:3030";
  const url = new URL("/forms/chromium/convert/html", baseUrl).toString();
  const { width, height } = paperSizeToInches(options.paperSize);
  const marginMm = marginPresetToMm(options.marginPreset);
  const marginInches = mmToInches(marginMm);
  const bottomMarginInches = options.showPageNumbers
    ? mmToInches(marginMm) + FOOTER_HEIGHT_INCHES
    : marginInches;

  const form = new FormData();
  const blob = new Blob([html], { type: "text/html" });
  form.append("files", blob, "index.html");

  if (options.showPageNumbers) {
    const footerBlob = new Blob([buildFooterHtml()], { type: "text/html" });
    form.append("files", footerBlob, "footer.html");
  }

  form.append("emulatedMediaType", "print");
  form.append("printBackground", "true");
  form.append("preferCssPageSize", "true");
  form.append("paperWidth", String(width));
  form.append("paperHeight", String(height));
  form.append("marginTop", String(marginInches));
  form.append("marginBottom", String(bottomMarginInches));
  form.append("marginLeft", String(marginInches));
  form.append("marginRight", String(marginInches));

  // Add PDF metadata if provided
  if (metadata?.title) {
    form.append("pdfTitle", metadata.title);
  }
  if (metadata?.author) {
    form.append("pdfAuthor", metadata.author);
  }

  const response = await fetch(url, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gotenberg HTTP ${response.status}: ${detail.slice(0, 500)}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
