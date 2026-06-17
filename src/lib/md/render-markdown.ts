import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

import type { ExportOptions } from "@/lib/export-options";
import { DEFAULT_EXPORT_OPTIONS } from "@/lib/export-options";
import { buildPrintThemeCss } from "@/lib/md/themes";

/**
 * Converts Markdown (GFM) into a complete HTML document suitable for Chromium print / Gotenberg.
 *
 * @param markdown - Source Markdown.
 * @param documentLang - BCP 47 language tag for hyphenation (e.g. `en`).
 * @param options - Print theme, paper size, and margin options.
 * @returns Full HTML document string with embedded print CSS.
 *
 * @example
 * const html = await renderMarkdownToHtmlDocument("# Hi\\n\\n|a|b|\\n|-|-|\\n|1|2|", "en");
 */
export async function renderMarkdownToHtmlDocument(
  markdown: string,
  documentLang: string,
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS,
): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(markdown);

  const body = String(file);
  const printCss = buildPrintThemeCss(options);

  return `<!DOCTYPE html>
<html lang="${escapeHtmlAttr(documentLang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Document</title>
  <style>
${printCss}
  </style>
</head>
<body>
${body}
</body>
</html>
`;
}

/**
 * Renders Markdown to an HTML fragment (body content only) for live preview.
 *
 * @param markdown - Source Markdown.
 * @returns Sanitized HTML body fragment.
 */
export async function renderMarkdownToHtmlFragment(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(markdown);

  return String(file);
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
