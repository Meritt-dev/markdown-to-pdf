/**
 * Default print theme: neutral sans-serif, bordered tables, light code blocks.
 *
 * @returns Theme-specific CSS.
 */
export function defaultThemeCss(): string {
  return `
:root {
  color-scheme: light;
}

body {
  font-family: system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: #111;
}

a {
  color: inherit;
}

pre {
  border: 1px solid #ddd;
  background: #f7f7f7;
  padding: 8px 10px;
  border-radius: 4px;
}

blockquote {
  margin: 0.8em 0;
  padding-left: 12px;
  border-left: 3px solid #ccc;
  color: #333;
}

th,
td {
  border: 1px solid #ccc;
}

th {
  background: #f2f2f2;
  font-weight: 600;
}

hr {
  border-top: 1px solid #ddd;
}
`;
}
