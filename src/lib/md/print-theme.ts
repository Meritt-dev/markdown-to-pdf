/**
 * Print-first CSS for Chromium: tables, word breaking, code blocks, and A4 page model.
 * Embedded in the HTML sent to Gotenberg so output does not depend on external assets.
 */
export const PRINT_THEME_CSS = `
:root {
  color-scheme: light;
}

@page {
  size: A4;
  margin: 12mm;
}

html {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

body {
  font-family: system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.45;
  color: #111;
  hyphenate-character: "-";
  hyphens: auto;
}

h1, h2, h3, h4, h5, h6 {
  line-height: 1.2;
  page-break-after: avoid;
  break-after: avoid-page;
}

p,
li,
blockquote,
td,
th,
dd,
dt {
  overflow-wrap: anywhere;
  word-break: normal;
}

a {
  color: inherit;
  text-decoration: underline;
  overflow-wrap: anywhere;
}

pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 9.5pt;
  line-height: 1.35;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  border: 1px solid #ddd;
  background: #f7f7f7;
  padding: 8px 10px;
  border-radius: 4px;
  page-break-inside: avoid;
  break-inside: avoid;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 0.95em;
  overflow-wrap: anywhere;
}

pre code {
  font-size: inherit;
  overflow-wrap: anywhere;
}

blockquote {
  margin: 0.8em 0;
  padding-left: 12px;
  border-left: 3px solid #ccc;
  color: #333;
}

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  margin: 0.8em 0;
}

thead {
  display: table-header-group;
}

tr {
  page-break-inside: avoid;
  break-inside: avoid;
}

th,
td {
  border: 1px solid #ccc;
  padding: 6px 8px;
  vertical-align: top;
  overflow-wrap: anywhere;
  word-break: normal;
  hyphens: auto;
}

th {
  background: #f2f2f2;
  font-weight: 600;
}

ul,
ol {
  padding-left: 1.25em;
}

.task-list-item {
  list-style-type: none;
}

hr {
  border: none;
  border-top: 1px solid #ddd;
  margin: 1em 0;
}

img {
  max-width: 100%;
  height: auto;
}
`;
