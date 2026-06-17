import fs from "node:fs";
import path from "node:path";

import type { ExportOptions } from "@/lib/export-options";
import { DEFAULT_EXPORT_OPTIONS } from "@/lib/export-options";
import { buildCoverHtml, extractMetadata } from "@/lib/md/front-matter";
import { createMarkdownProcessor } from "@/lib/md/pipeline";
import { buildPrintThemeCss } from "@/lib/md/themes";
import type { MarkdownProcessingResult } from "@/lib/md/types";

let katexCssCache: string | null = null;

/**
 * Reads and caches the KaTeX CSS for embedding in HTML documents.
 *
 * @returns KaTeX CSS content as a string.
 */
function getKatexCss(): string {
  if (katexCssCache !== null) {
    return katexCssCache;
  }

  try {
    const katexCssPath = path.join(process.cwd(), "node_modules", "katex", "dist", "katex.min.css");
    katexCssCache = fs.readFileSync(katexCssPath, "utf-8");
    return katexCssCache;
  } catch {
    // If KaTeX CSS can't be loaded, return empty string
    return "";
  }
}

/**
 * Converts Markdown (GFM) into a complete HTML document suitable for Chromium print / Gotenberg.
 *
 * @param markdown - Source Markdown.
 * @param documentLang - BCP 47 language tag for hyphenation (e.g. `en`).
 * @param options - Print theme, paper size, and margin options.
 * @returns Processing result with HTML document and metadata.
 *
 * @example
 * const result = await renderMarkdownToHtmlDocument("# Hi\\n\\n|a|b|\\n|-|-|\\n|1|2|", "en");
 * console.log(result.html, result.metadata.title);
 */
export async function renderMarkdownToHtmlDocument(
  markdown: string,
  documentLang: string,
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS,
): Promise<MarkdownProcessingResult> {
  const processor = createMarkdownProcessor({
    syntaxHighlighting: true,
    tableOfContents: true,
    inlineImages: true,
    math: true,
    frontmatter: true,
  });

  const file = await processor.process(markdown);
  const metadata = extractMetadata(file.data);
  const bodyContent = String(file);

  const coverHtml = buildCoverHtml(metadata);
  const printCss = buildPrintThemeCss(options);
  const katexCss = getKatexCss();

  const title = metadata.title ?? "Document";

  const html = `<!DOCTYPE html>
<html lang="${escapeHtmlAttr(documentLang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtmlAttr(title)}</title>
  <style>
${printCss}
  </style>
${katexCss ? `  <style>\n${katexCss}\n  </style>\n` : ""}</head>
<body>
${coverHtml ? `${coverHtml}\n` : ""}${bodyContent}
</body>
</html>
`;

  return { html, metadata };
}

/**
 * Renders Markdown to an HTML fragment (body content only) for live preview.
 *
 * @param markdown - Source Markdown.
 * @returns Sanitized HTML body fragment.
 */
export async function renderMarkdownToHtmlFragment(markdown: string): Promise<string> {
  const processor = createMarkdownProcessor({
    syntaxHighlighting: true,
    tableOfContents: true,
    inlineImages: false, // Skip image fetching for preview
    math: true,
    frontmatter: true,
  });

  const file = await processor.process(markdown);
  const metadata = extractMetadata(file.data);
  const bodyContent = String(file);

  const coverHtml = buildCoverHtml(metadata);

  return coverHtml ? `${coverHtml}\n${bodyContent}` : bodyContent;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
