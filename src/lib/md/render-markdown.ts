import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { PRINT_THEME_CSS } from "@/lib/md/print-theme";

/**
 * Converts Markdown (GFM) into a complete HTML document suitable for Chromium print / Gotenberg.
 *
 * @param markdown - Source Markdown.
 * @param documentLang - BCP 47 language tag for hyphenation (e.g. `en`).
 * @returns Full HTML document string with embedded print CSS.
 *
 * @example
 * const html = await renderMarkdownToHtmlDocument("# Hi\\n\\n|a|b|\\n|-|-|\\n|1|2|", "en");
 */
export async function renderMarkdownToHtmlDocument(
  markdown: string,
  documentLang: string,
): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(markdown);

  const body = String(file);

  return `<!DOCTYPE html>
<html lang="${escapeHtmlAttr(documentLang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Document</title>
  <style>
${PRINT_THEME_CSS}
  </style>
</head>
<body>
${body}
</body>
</html>
`;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
