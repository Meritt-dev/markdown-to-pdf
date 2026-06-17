/**
 * Docs print theme: technical documentation style with accent headings and code blocks.
 *
 * @returns Theme-specific CSS.
 */
export function docsThemeCss(): string {
  return `
:root {
  color-scheme: light;
}

body {
  font-family: system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: #0f172a;
}

h1 {
  font-size: 1.75em;
  color: #0f172a;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0.25em;
  margin-bottom: 0.6em;
}

h2 {
  font-size: 1.35em;
  color: #1e293b;
  margin-top: 1.2em;
}

h3 {
  font-size: 1.1em;
  color: #334155;
}

a {
  color: #0369a1;
}

pre {
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  padding: 10px 12px;
  border-radius: 6px;
}

code {
  background: #f1f5f9;
  padding: 0.1em 0.35em;
  border-radius: 3px;
}

pre code {
  background: transparent;
  padding: 0;
}

blockquote {
  margin: 0.8em 0;
  padding: 8px 12px;
  border-left: 4px solid #38bdf8;
  background: #f0f9ff;
  color: #0c4a6e;
}

th,
td {
  border: 1px solid #e2e8f0;
}

th {
  background: #f1f5f9;
  font-weight: 600;
  color: #334155;
}

hr {
  border-top: 1px solid #e2e8f0;
}
`;
}
