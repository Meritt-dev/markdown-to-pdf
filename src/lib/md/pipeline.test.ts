import { describe, expect, it } from "vitest";

import { createMarkdownProcessor } from "./pipeline";

describe("pipeline", () => {
  describe("createMarkdownProcessor", () => {
    it("should process basic markdown", async () => {
      const processor = createMarkdownProcessor();
      const file = await processor.process("# Hello\n\nWorld");
      const html = String(file);

      expect(html).toContain("<h1>Hello</h1>");
      expect(html).toContain("<p>World</p>");
    });

    it("should process GFM tables", async () => {
      const processor = createMarkdownProcessor();
      const markdown = `| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |`;

      const file = await processor.process(markdown);
      const html = String(file);

      expect(html).toContain("<table>");
      expect(html).toContain("<thead>");
      expect(html).toContain("<tbody>");
      expect(html).toContain("Header 1");
      expect(html).toContain("Cell 1");
    });

    it("should process code blocks with syntax highlighting", async () => {
      const processor = createMarkdownProcessor({ syntaxHighlighting: true });
      const markdown = "```javascript\nconst x = 1;\n```";

      const file = await processor.process(markdown);
      const html = String(file);

      expect(html).toContain("<pre><code");
      expect(html).toContain("const");
    });

    it("should skip syntax highlighting when disabled", async () => {
      const processor = createMarkdownProcessor({ syntaxHighlighting: false });
      const markdown = "```javascript\nconst x = 1;\n```";

      const file = await processor.process(markdown);
      const html = String(file);

      expect(html).toContain("<pre><code");
      expect(html).toContain("const");
    });

    it("should extract front matter when enabled", async () => {
      const processor = createMarkdownProcessor({ frontmatter: true });
      const markdown = `---
title: Test
author: Jane
---

# Content`;

      const file = await processor.process(markdown);
      const html = String(file);

      expect(file.data.frontmatter).toEqual({
        title: "Test",
        author: "Jane",
      });
      expect(html).not.toContain("title: Test");
      expect(html).toContain("<h1>Content</h1>");
    });

    it("should skip front matter when disabled", async () => {
      const processor = createMarkdownProcessor({ frontmatter: false });
      const markdown = `---
title: Test
---

# Content`;

      const file = await processor.process(markdown);
      const html = String(file);

      expect(file.data.frontmatter).toBeUndefined();
      expect(html).toContain("<h1>Content</h1>");
    });

    it("should generate table of contents when enabled", async () => {
      const processor = createMarkdownProcessor({ tableOfContents: true });
      const markdown = `# Contents

## Section 1

Content 1

## Section 2

Content 2`;

      const file = await processor.process(markdown);
      const html = String(file);

      expect(html).toContain("Section 1");
      expect(html).toContain("Section 2");
    });

    it("should process inline math with KaTeX", async () => {
      const processor = createMarkdownProcessor({ math: true });
      const markdown = "The formula is $x = y + z$.";

      const file = await processor.process(markdown);
      const html = String(file);

      // KaTeX should render math to HTML
      expect(html).toContain("formula");
    });

    it("should process display math with KaTeX", async () => {
      const processor = createMarkdownProcessor({ math: true });
      const markdown = "$$\nx = y + z\n$$";

      const file = await processor.process(markdown);
      const html = String(file);

      // KaTeX should render display math
      expect(html).toBeTruthy();
    });

    it("should skip math rendering when disabled", async () => {
      const processor = createMarkdownProcessor({ math: false });
      const markdown = "The formula is $x = y + z$.";

      const file = await processor.process(markdown);
      const html = String(file);

      expect(html).toContain("formula");
    });

    it("should process GFM strikethrough", async () => {
      const processor = createMarkdownProcessor();
      const markdown = "This is ~~deleted~~ text.";

      const file = await processor.process(markdown);
      const html = String(file);

      expect(html).toContain("<del>deleted</del>");
    });

    it("should process GFM task lists", async () => {
      const processor = createMarkdownProcessor();
      const markdown = `- [x] Completed
- [ ] Pending`;

      const file = await processor.process(markdown);
      const html = String(file);

      expect(html).toContain("input");
      expect(html).toContain("checkbox");
    });

    it("should sanitize HTML in markdown", async () => {
      const processor = createMarkdownProcessor();
      const markdown = '<script>alert("xss")</script>\n\nSafe content.';

      const file = await processor.process(markdown);
      const html = String(file);

      // Script tags should be sanitized
      expect(html).not.toContain("<script>");
      expect(html).toContain("Safe content");
    });

    it("should handle empty markdown", async () => {
      const processor = createMarkdownProcessor();
      const file = await processor.process("");
      const html = String(file);

      expect(html).toBe("");
    });

    it("should handle markdown with only whitespace", async () => {
      const processor = createMarkdownProcessor();
      const file = await processor.process("   \n\n   ");
      const html = String(file);

      expect(html.trim()).toBe("");
    });

    it("should process nested lists", async () => {
      const processor = createMarkdownProcessor();
      const markdown = `- Item 1
  - Nested 1.1
  - Nested 1.2
- Item 2`;

      const file = await processor.process(markdown);
      const html = String(file);

      expect(html).toContain("<ul>");
      expect(html).toContain("Item 1");
      expect(html).toContain("Nested 1.1");
    });

    it("should process blockquotes", async () => {
      const processor = createMarkdownProcessor();
      const markdown = "> This is a quote\n> with multiple lines";

      const file = await processor.process(markdown);
      const html = String(file);

      expect(html).toContain("<blockquote>");
      expect(html).toContain("quote");
    });

    it("should process links", async () => {
      const processor = createMarkdownProcessor();
      const markdown = "[Link text](https://example.com)";

      const file = await processor.process(markdown);
      const html = String(file);

      expect(html).toContain('<a href="https://example.com">Link text</a>');
    });

    it("should process inline code", async () => {
      const processor = createMarkdownProcessor();
      const markdown = "Use `console.log()` for debugging.";

      const file = await processor.process(markdown);
      const html = String(file);

      expect(html).toContain("<code>console.log()</code>");
    });

    it("should process horizontal rules", async () => {
      const processor = createMarkdownProcessor();
      const markdown = "Above\n\n---\n\nBelow";

      const file = await processor.process(markdown);
      const html = String(file);

      expect(html).toContain("<hr>");
    });

    it("should process images with alt text", async () => {
      const processor = createMarkdownProcessor({ inlineImages: false });
      const markdown = "![Alt text](image.png)";

      const file = await processor.process(markdown);
      const html = String(file);

      expect(html).toContain('<img');
      expect(html).toContain('alt="Alt text"');
      expect(html).toContain('src="image.png"');
    });

    it("should handle all options enabled", async () => {
      const processor = createMarkdownProcessor({
        syntaxHighlighting: true,
        tableOfContents: true,
        inlineImages: false,
        math: true,
        frontmatter: true,
      });

      const markdown = `---
title: Full Test
---

# Contents

## Section

\`\`\`js
const x = 1;
\`\`\`

Math: $x = y$

| A | B |
|---|---|
| 1 | 2 |`;

      const file = await processor.process(markdown);
      const html = String(file);

      expect(html).toContain("<h2>Section</h2>");
      expect(html).toContain("<code");
      expect(html).toContain("<table>");
      expect(file.data.frontmatter).toBeDefined();
    });

    it("should handle all options disabled", async () => {
      const processor = createMarkdownProcessor({
        syntaxHighlighting: false,
        tableOfContents: false,
        inlineImages: false,
        math: false,
        frontmatter: false,
      });

      const markdown = "# Simple\n\nContent";

      const file = await processor.process(markdown);
      const html = String(file);

      expect(html).toContain("<h1>Simple</h1>");
      expect(html).toContain("<p>Content</p>");
    });
  });
});
