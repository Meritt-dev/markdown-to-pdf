/**
 * Minimal print theme: serif body, subtle rules, no table fills.
 *
 * @returns Theme-specific CSS.
 */
export function minimalThemeCss(): string {
  return `
:root {
  color-scheme: light;
}

body {
  font-family: Georgia, "Times New Roman", Times, serif;
  color: #1a1a1a;
}

a {
  color: #1a1a1a;
}

h1, h2, h3 {
  font-weight: 600;
  letter-spacing: -0.01em;
}

pre {
  border: none;
  background: transparent;
  padding: 0;
  border-left: 2px solid #bbb;
  padding-left: 12px;
  border-radius: 0;
}

blockquote {
  margin: 1em 0;
  padding: 0 0 0 1em;
  border-left: 1px solid #999;
  color: #444;
  font-style: italic;
}

th,
td {
  border: none;
  border-bottom: 1px solid #ddd;
}

th {
  background: transparent;
  font-weight: 600;
  border-bottom: 2px solid #999;
}

hr {
  border-top: 1px solid #ccc;
}
`;
}
