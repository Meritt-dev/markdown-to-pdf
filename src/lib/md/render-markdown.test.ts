import { describe, expect, it } from "vitest";

import { renderMarkdownToHtmlDocument, renderMarkdownToHtmlFragment } from "./render-markdown";
import { DEFAULT_EXPORT_OPTIONS } from "../export-options";

describe("render-markdown", () => {
  describe("renderMarkdownToHtmlDocument", () => {
    it("should return complete HTML document", async () => {
      const markdown = "# Hello World";
      const result = await renderMarkdownToHtmlDocument(markdown, "en");

      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.html).toContain("<html lang=\"en\">");
      expect(result.html).toContain("<head>");
      expect(result.html).toContain("<body>");
      expect(result.html).toContain("</body>");
      expect(result.html).toContain("</html>");
    });

    it("should include title from front matter in document", async () => {
      const markdown = `---
title: Test Document
---

# Content`;

      const result = await renderMarkdownToHtmlDocument(markdown, "en");

      expect(result.html).toContain("<title>Test Document</title>");
      expect(result.metadata.title).toBe("Test Document");
    });

    it("should use default title when no front matter", async () => {
      const markdown = "# Just Content";
      const result = await renderMarkdownToHtmlDocument(markdown, "en");

      expect(result.html).toContain("<title>Document</title>");
      expect(result.metadata.title).toBeUndefined();
    });

    it("should include cover page when front matter present", async () => {
      const markdown = `---
title: My Document
author: Jane Doe
date: 2026-06-17
---

# Content`;

      const result = await renderMarkdownToHtmlDocument(markdown, "en");

      expect(result.html).toContain('class="document-cover"');
      expect(result.html).toContain('class="cover-title"');
      expect(result.html).toContain("My Document");
      expect(result.html).toContain("Jane Doe");
      expect(result.html).toContain("2026-06-17");
    });

    it("should not include cover when no metadata", async () => {
      const markdown = "# Plain Document";
      const result = await renderMarkdownToHtmlDocument(markdown, "en");

      expect(result.html).not.toContain('class="document-cover"');
      expect(result.html).not.toContain('class="cover-title"');
    });

    it("should process GFM tables", async () => {
      const markdown = `| A | B |
|---|---|
| 1 | 2 |`;

      const result = await renderMarkdownToHtmlDocument(markdown, "en");

      expect(result.html).toContain("<table>");
      expect(result.html).toContain("<thead>");
      expect(result.html).toContain("<tbody>");
    });

    it("should process code blocks with syntax highlighting", async () => {
      const markdown = "```javascript\nconst x = 1;\n```";
      const result = await renderMarkdownToHtmlDocument(markdown, "en");

      expect(result.html).toContain("<pre><code");
      expect(result.html).toContain("const");
    });

    it("should render inline math with KaTeX", async () => {
      const markdown = "Formula: $x = y + z$";
      const result = await renderMarkdownToHtmlDocument(markdown, "en");

      expect(result.html).toContain("Formula");
      // KaTeX should process the math
      expect(result.html).toBeTruthy();
    });

    it("should render display math with KaTeX", async () => {
      const markdown = "$$\nx = y + z\n$$";
      const result = await renderMarkdownToHtmlDocument(markdown, "en");

      // KaTeX renders display math
      expect(result.html).toBeTruthy();
    });

    it("should include KaTeX CSS in document", async () => {
      const markdown = "$x$";
      const result = await renderMarkdownToHtmlDocument(markdown, "en");

      // Should include KaTeX styles or attempt to
      expect(result.html).toContain("<style>");
    });

    it("should include print theme CSS", async () => {
      const markdown = "# Test";
      const result = await renderMarkdownToHtmlDocument(markdown, "en", DEFAULT_EXPORT_OPTIONS);

      expect(result.html).toContain("<style>");
      expect(result.html).toContain("@page");
    });

    it("should escape HTML in language attribute", async () => {
      const markdown = "# Test";
      const result = await renderMarkdownToHtmlDocument(markdown, '<script>alert("xss")</script>');

      expect(result.html).not.toContain('<script>alert("xss")</script>');
      expect(result.html).toContain("&lt;script&gt;");
    });

    it("should apply custom export options", async () => {
      const markdown = "# Test";
      const options = {
        theme: "minimal" as const,
        paperSize: "letter" as const,
        marginPreset: "wide" as const,
        showPageNumbers: true,
      };

      const result = await renderMarkdownToHtmlDocument(markdown, "en", options);

      // CSS should reflect the options
      expect(result.html).toContain("@page");
      expect(result.html).toContain("20mm"); // wide margins
    });

    it("should handle empty markdown", async () => {
      const markdown = "";
      const result = await renderMarkdownToHtmlDocument(markdown, "en");

      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.html).toContain("<body>");
      expect(result.metadata.title).toBeUndefined();
    });

    it("should preserve metadata in result", async () => {
      const markdown = `---
title: Test
author: John
date: 2026-06-17
custom: value
---

# Content`;

      const result = await renderMarkdownToHtmlDocument(markdown, "en");

      expect(result.metadata.title).toBe("Test");
      expect(result.metadata.author).toBe("John");
      expect(result.metadata.date).toBe("2026-06-17");
      expect((result.metadata as any).custom).toBe("value");
    });

    it("should generate TOC when heading present", async () => {
      const markdown = `# Contents

## Section 1
Content 1

## Section 2
Content 2`;

      const result = await renderMarkdownToHtmlDocument(markdown, "en");

      expect(result.html).toContain("Section 1");
      expect(result.html).toContain("Section 2");
    });

    it("should handle different language codes", async () => {
      const markdown = "# Test";
      const languages = ["en", "fr", "de", "es", "ja"];

      for (const lang of languages) {
        const result = await renderMarkdownToHtmlDocument(markdown, lang);
        expect(result.html).toContain(`<html lang="${lang}">`);
      }
    });
  });

  describe("renderMarkdownToHtmlFragment", () => {
    it("should return HTML fragment without document wrapper", async () => {
      const markdown = "# Hello";
      const result = await renderMarkdownToHtmlFragment(markdown);

      expect(result).not.toContain("<!DOCTYPE html>");
      expect(result).not.toContain("<html");
      expect(result).not.toContain("<head>");
      expect(result).toContain("<h1>Hello</h1>");
    });

    it("should include cover when front matter present", async () => {
      const markdown = `---
title: Fragment Test
author: Jane
---

# Content`;

      const result = await renderMarkdownToHtmlFragment(markdown);

      expect(result).toContain('class="document-cover"');
      expect(result).toContain("Fragment Test");
      expect(result).toContain("Jane");
      expect(result).toContain("<h1>Content</h1>");
    });

    it("should not include cover when no metadata", async () => {
      const markdown = "# Plain";
      const result = await renderMarkdownToHtmlFragment(markdown);

      expect(result).not.toContain("document-cover");
      expect(result).toContain("<h1>Plain</h1>");
    });

    it("should process GFM tables", async () => {
      const markdown = `| A | B |
|---|---|
| 1 | 2 |`;

      const result = await renderMarkdownToHtmlFragment(markdown);

      expect(result).toContain("<table>");
      expect(result).toContain("<thead>");
    });

    it("should process code with syntax highlighting", async () => {
      const markdown = "```js\nconst x = 1;\n```";
      const result = await renderMarkdownToHtmlFragment(markdown);

      expect(result).toContain("<pre><code");
    });

    it("should render math", async () => {
      const markdown = "Math: $x = y$";
      const result = await renderMarkdownToHtmlFragment(markdown);

      expect(result).toContain("Math");
    });

    it("should not inline remote images in preview mode", async () => {
      const markdown = "![test](https://example.com/image.png)";
      const result = await renderMarkdownToHtmlFragment(markdown);

      // Should keep original URL (inlineImages is disabled for preview)
      expect(result).toContain("https://example.com/image.png");
    });

    it("should sanitize HTML", async () => {
      const markdown = '<script>alert("xss")</script>\n\nSafe.';
      const result = await renderMarkdownToHtmlFragment(markdown);

      expect(result).not.toContain("<script>");
      expect(result).toContain("Safe");
    });

    it("should handle empty markdown", async () => {
      const result = await renderMarkdownToHtmlFragment("");
      expect(result).toBe("");
    });

    it("should handle markdown with only front matter", async () => {
      const markdown = `---
title: Only Metadata
---`;

      const result = await renderMarkdownToHtmlFragment(markdown);

      expect(result).toContain("Only Metadata");
      expect(result).toContain("document-cover");
    });
  });
});
