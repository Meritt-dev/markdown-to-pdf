import { describe, expect, it } from "vitest";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

import {
  buildCoverHtml,
  extractMetadata,
  remarkExtractFrontmatter,
  remarkStripFrontmatter,
} from "./front-matter";
import type { DocumentMetadata } from "./types";

describe("front-matter", () => {
  describe("remarkExtractFrontmatter", () => {
    it("should extract YAML front matter", async () => {
      const markdown = `---
title: Test Document
author: Jane Doe
date: 2026-06-17
---

# Content`;

      const processor = unified()
        .use(remarkParse)
        .use(remarkFrontmatter, ["yaml"])
        .use(remarkExtractFrontmatter)
        .use(remarkStringify);

      const file = await processor.process(markdown);
      const frontmatter = file.data.frontmatter as Record<string, unknown>;

      expect(frontmatter).toEqual({
        title: "Test Document",
        author: "Jane Doe",
        date: "2026-06-17",
      });
    });

    it("should handle markdown without front matter", async () => {
      const markdown = "# Just Content\n\nNo front matter here.";

      const processor = unified()
        .use(remarkParse)
        .use(remarkFrontmatter, ["yaml"])
        .use(remarkExtractFrontmatter)
        .use(remarkStringify);

      const file = await processor.process(markdown);
      expect(file.data.frontmatter).toBeUndefined();
    });

    it("should ignore invalid YAML", async () => {
      const markdown = `---
invalid: yaml: syntax: error
---

# Content`;

      const processor = unified()
        .use(remarkParse)
        .use(remarkFrontmatter, ["yaml"])
        .use(remarkExtractFrontmatter)
        .use(remarkStringify);

      const file = await processor.process(markdown);
      expect(file.data.frontmatter).toBeUndefined();
    });

    it("should extract nested properties", async () => {
      const markdown = `---
title: Document
metadata:
  category: tech
  tags:
    - testing
    - vitest
---

# Content`;

      const processor = unified()
        .use(remarkParse)
        .use(remarkFrontmatter, ["yaml"])
        .use(remarkExtractFrontmatter)
        .use(remarkStringify);

      const file = await processor.process(markdown);
      const frontmatter = file.data.frontmatter as Record<string, unknown>;

      expect(frontmatter.title).toBe("Document");
      expect(frontmatter.metadata).toEqual({
        category: "tech",
        tags: ["testing", "vitest"],
      });
    });
  });

  describe("remarkStripFrontmatter", () => {
    it("should remove front matter from AST", async () => {
      const markdown = `---
title: Test
---

# Heading

Content here.`;

      const processor = unified()
        .use(remarkParse)
        .use(remarkFrontmatter, ["yaml"])
        .use(remarkStripFrontmatter)
        .use(remarkStringify);

      const file = await processor.process(markdown);
      const tree = file.data as any;

      expect(String(file)).not.toContain("---");
      expect(String(file)).not.toContain("title: Test");
    });

    it("should preserve content when no front matter exists", async () => {
      const markdown = "# Heading\n\nContent here.";

      const processor = unified()
        .use(remarkParse)
        .use(remarkFrontmatter, ["yaml"])
        .use(remarkStripFrontmatter)
        .use(remarkStringify);

      const file = await processor.process(markdown);
      expect(String(file)).toContain("# Heading");
    });
  });

  describe("extractMetadata", () => {
    it("should extract standard metadata fields", () => {
      const fileData = {
        frontmatter: {
          title: "My Document",
          author: "John Smith",
          date: "2026-06-17",
        },
      };

      const metadata = extractMetadata(fileData);

      expect(metadata.title).toBe("My Document");
      expect(metadata.author).toBe("John Smith");
      expect(metadata.date).toBe("2026-06-17");
    });

    it("should handle missing frontmatter", () => {
      const fileData = {};
      const metadata = extractMetadata(fileData);

      expect(metadata.title).toBeUndefined();
      expect(metadata.author).toBeUndefined();
      expect(metadata.date).toBeUndefined();
    });

    it("should handle partial metadata", () => {
      const fileData = {
        frontmatter: {
          title: "Partial Doc",
        },
      };

      const metadata = extractMetadata(fileData);

      expect(metadata.title).toBe("Partial Doc");
      expect(metadata.author).toBeUndefined();
      expect(metadata.date).toBeUndefined();
    });

    it("should preserve all frontmatter properties including non-string values", () => {
      const fileData = {
        frontmatter: {
          title: 123,
          author: true,
          date: ["array"],
        },
      };

      const metadata = extractMetadata(fileData) as any;

      // extractMetadata spreads all frontmatter, but only validates strings for title/author/date
      // Non-string values are spread but the typed properties remain undefined
      expect(typeof metadata.title === "string" ? metadata.title : undefined).toBeUndefined();
      expect(typeof metadata.author === "string" ? metadata.author : undefined).toBeUndefined();
      expect(typeof metadata.date === "string" ? metadata.date : undefined).toBeUndefined();
      
      // But the raw values are preserved in the spread
      expect(metadata).toHaveProperty("title");
      expect(metadata).toHaveProperty("author");
      expect(metadata).toHaveProperty("date");
    });

    it("should preserve additional frontmatter properties", () => {
      const fileData = {
        frontmatter: {
          title: "Doc",
          category: "tech",
          tags: ["test", "docs"],
          custom: { nested: "value" },
        },
      };

      const metadata = extractMetadata(fileData) as DocumentMetadata & Record<string, unknown>;

      expect(metadata.title).toBe("Doc");
      expect(metadata.category).toBe("tech");
      expect(metadata.tags).toEqual(["test", "docs"]);
      expect(metadata.custom).toEqual({ nested: "value" });
    });
  });

  describe("buildCoverHtml", () => {
    it("should return empty string when no metadata provided", () => {
      const metadata: DocumentMetadata = {};
      const result = buildCoverHtml(metadata);
      expect(result).toBe("");
    });

    it("should build cover with title only", () => {
      const metadata: DocumentMetadata = { title: "Test Document" };
      const result = buildCoverHtml(metadata);

      expect(result).toContain('<div class="document-cover">');
      expect(result).toContain('<h1 class="cover-title">Test Document</h1>');
      expect(result).not.toContain("cover-author");
      expect(result).not.toContain("cover-date");
      expect(result).toContain("</div>");
    });

    it("should build cover with author only", () => {
      const metadata: DocumentMetadata = { author: "Jane Doe" };
      const result = buildCoverHtml(metadata);

      expect(result).toContain('<p class="cover-author">Jane Doe</p>');
      expect(result).not.toContain("cover-title");
      expect(result).not.toContain("cover-date");
    });

    it("should build cover with date only", () => {
      const metadata: DocumentMetadata = { date: "2026-06-17" };
      const result = buildCoverHtml(metadata);

      expect(result).toContain('<p class="cover-date">2026-06-17</p>');
      expect(result).not.toContain("cover-title");
      expect(result).not.toContain("cover-author");
    });

    it("should build complete cover with all fields", () => {
      const metadata: DocumentMetadata = {
        title: "Complete Document",
        author: "John Smith",
        date: "2026-06-17",
      };
      const result = buildCoverHtml(metadata);

      expect(result).toContain('<div class="document-cover">');
      expect(result).toContain('<h1 class="cover-title">Complete Document</h1>');
      expect(result).toContain('<p class="cover-author">John Smith</p>');
      expect(result).toContain('<p class="cover-date">2026-06-17</p>');
      expect(result).toContain("</div>");
    });

    it("should escape HTML in title", () => {
      const metadata: DocumentMetadata = {
        title: 'Test <script>alert("xss")</script> & "quotes"',
      };
      const result = buildCoverHtml(metadata);

      expect(result).not.toContain("<script>");
      expect(result).toContain("&lt;script&gt;");
      expect(result).toContain("&amp;");
      expect(result).toContain("&quot;");
    });

    it("should escape HTML in author", () => {
      const metadata: DocumentMetadata = {
        author: "John <b>Bold</b> & Smith",
      };
      const result = buildCoverHtml(metadata);

      expect(result).not.toContain("<b>");
      expect(result).toContain("&lt;b&gt;");
      expect(result).toContain("&amp;");
    });

    it("should escape HTML in date", () => {
      const metadata: DocumentMetadata = {
        date: "2026<script>alert(1)</script>",
      };
      const result = buildCoverHtml(metadata);

      expect(result).not.toContain("<script>");
      expect(result).toContain("&lt;script&gt;");
    });

    it("should escape apostrophes", () => {
      const metadata: DocumentMetadata = {
        title: "It's a Test Document",
      };
      const result = buildCoverHtml(metadata);

      expect(result).toContain("It&#039;s a Test Document");
    });
  });
});
