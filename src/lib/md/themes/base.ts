import type { ExportOptions, MarginPreset, PaperSize } from "@/lib/export-options";
import { marginPresetToMm } from "@/lib/export-options";

/**
 * Shared print CSS: page model, typography baseline, and element rules common to all themes.
 *
 * @param options - Export options controlling page size and margins.
 * @returns CSS string.
 */
export function buildBasePrintCss(options: ExportOptions): string {
  const marginMm = marginPresetToMm(options.marginPreset);
  const pageSize = options.paperSize === "letter" ? "letter" : "A4";

  return `
@page {
  size: ${pageSize};
  margin: ${marginMm}mm;
}

html {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

body {
  font-size: 11pt;
  line-height: 1.45;
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
  padding: 6px 8px;
  vertical-align: top;
  overflow-wrap: anywhere;
  word-break: normal;
  hyphens: auto;
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
  margin: 1em 0;
}

img {
  max-width: 100%;
  height: auto;
}

/* Front matter cover block */
.document-cover {
  text-align: center;
  margin-bottom: 3em;
  padding-bottom: 2em;
  border-bottom: 1px solid #e0e0e0;
  page-break-after: avoid;
  break-after: avoid-page;
}

.cover-title {
  font-size: 2em;
  font-weight: 700;
  margin: 0 0 0.5em 0;
  line-height: 1.2;
}

.cover-author {
  font-size: 1.1em;
  margin: 0.25em 0;
  color: #555;
}

.cover-date {
  font-size: 0.95em;
  margin: 0.25em 0;
  color: #777;
  font-style: italic;
}

/* Syntax highlighting (rehype-highlight default theme) */
.hljs {
  display: block;
  overflow-x: auto;
  padding: 0.5em;
  background: #f5f5f5;
}

.hljs-comment,
.hljs-quote {
  color: #998;
  font-style: italic;
}

.hljs-keyword,
.hljs-selector-tag,
.hljs-subst {
  color: #333;
  font-weight: bold;
}

.hljs-number,
.hljs-literal,
.hljs-variable,
.hljs-template-variable,
.hljs-tag .hljs-attr {
  color: #008080;
}

.hljs-string,
.hljs-doctag {
  color: #d14;
}

.hljs-title,
.hljs-section,
.hljs-selector-id {
  color: #900;
  font-weight: bold;
}

.hljs-subst {
  font-weight: normal;
}

.hljs-type,
.hljs-class .hljs-title {
  color: #458;
  font-weight: bold;
}

.hljs-tag,
.hljs-name,
.hljs-attribute {
  color: #000080;
  font-weight: normal;
}

.hljs-regexp,
.hljs-link {
  color: #009926;
}

.hljs-symbol,
.hljs-bullet {
  color: #990073;
}

.hljs-built_in,
.hljs-builtin-name {
  color: #0086b3;
}

.hljs-meta {
  color: #999;
  font-weight: bold;
}

.hljs-deletion {
  background: #fdd;
}

.hljs-addition {
  background: #dfd;
}

.hljs-emphasis {
  font-style: italic;
}

.hljs-strong {
  font-weight: bold;
}

/* KaTeX math rendering */
.katex {
  font-size: 1.05em;
}

.katex-display {
  overflow-x: auto;
  overflow-y: hidden;
}
`;
}

/**
 * Human-readable label for a margin preset (UI).
 *
 * @param preset - Margin preset id.
 * @returns Display label.
 */
export function marginPresetLabel(preset: MarginPreset): string {
  switch (preset) {
    case "narrow":
      return "Narrow (8 mm)";
    case "wide":
      return "Wide (20 mm)";
    default:
      return "Default (12 mm)";
  }
}

/**
 * Human-readable label for a paper size (UI).
 *
 * @param paperSize - Paper size id.
 * @returns Display label.
 */
export function paperSizeLabel(paperSize: PaperSize): string {
  return paperSize === "letter" ? "US Letter" : "A4";
}
