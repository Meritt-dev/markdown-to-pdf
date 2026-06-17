import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkToc from "remark-toc";
import { unified } from "unified";

import {
  remarkExtractFrontmatter,
  remarkStripFrontmatter,
} from "@/lib/md/front-matter";
import { rehypeInlineImages } from "@/lib/md/rehype-inline-images";

/**
 * Pipeline configuration options.
 */
export interface PipelineOptions {
  /**
   * Enable syntax highlighting for code blocks. Defaults to true.
   */
  readonly syntaxHighlighting?: boolean;

  /**
   * Enable table of contents generation. Defaults to true.
   */
  readonly tableOfContents?: boolean;

  /**
   * Enable inline remote images as base64. Defaults to true.
   */
  readonly inlineImages?: boolean;

  /**
   * Enable math rendering with KaTeX. Defaults to true.
   */
  readonly math?: boolean;

  /**
   * Enable front matter parsing. Defaults to true.
   */
  readonly frontmatter?: boolean;
}

/**
 * Creates a configured unified processor for converting Markdown to HTML.
 *
 * This factory function builds a unified pipeline with all Tier 2 features:
 * - Front matter (YAML) parsing
 * - Syntax highlighting (rehype-highlight)
 * - Table of contents generation (remark-toc)
 * - Remote image inlining (base64 data URIs)
 * - Math rendering (KaTeX)
 * - GFM support (tables, task lists, strikethrough)
 *
 * @param options - Pipeline configuration options.
 * @returns Configured unified processor.
 *
 * @example
 * const processor = createMarkdownProcessor({ syntaxHighlighting: true });
 * const file = await processor.process(markdown);
 * const html = String(file);
 */
export function createMarkdownProcessor(options: PipelineOptions = {}) {
  const {
    syntaxHighlighting = true,
    tableOfContents = true,
    inlineImages = true,
    math = true,
    frontmatter = true,
  } = options;

  // Build the processor chain
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processor: any = unified().use(remarkParse).use(remarkGfm);

  // Front matter support
  if (frontmatter) {
    processor = processor
      .use(remarkFrontmatter, ["yaml"])
      .use(remarkExtractFrontmatter)
      .use(remarkStripFrontmatter);
  }

  // Table of contents
  if (tableOfContents) {
    processor = processor.use(remarkToc, {
      heading: "(table[ -]of[ -])?contents?|toc",
      tight: true,
      ordered: false,
    });
  }

  // Math support
  if (math) {
    processor = processor.use(remarkMath);
  }

  // Convert to HTML
  processor = processor.use(remarkRehype);

  // Math rendering
  if (math) {
    processor = processor.use(rehypeKatex, {
      throwOnError: false,
      output: "html",
    });
  }

  // Inline remote images as base64
  if (inlineImages) {
    processor = processor.use(rehypeInlineImages, {
      timeoutMs: 15_000,
      maxSizeBytes: 10_000_000,
    });
  }

  // Sanitize HTML (allow data: URIs for images and KaTeX elements)
  const sanitizeSchema = {
    ...defaultSchema,
    // Allow KaTeX elements
    tagNames: [
      ...(defaultSchema.tagNames ?? []),
      "math",
      "semantics",
      "mrow",
      "mi",
      "mo",
      "mn",
      "msup",
      "msub",
      "mfrac",
      "msqrt",
      "mroot",
      "mtext",
      "annotation",
      "span",
    ],
    attributes: {
      ...defaultSchema.attributes,
      img: [
        ...(defaultSchema.attributes?.img ?? []),
        // Allow data URIs for inlined images
        ["src", /^data:image\/(png|jpg|jpeg|gif|webp|svg\+xml);base64,/],
      ],
      "*": [
        ...(defaultSchema.attributes?.["*"] ?? []),
        "className",
        "ariaHidden",
        "style",
      ],
    },
  };

  processor = processor.use(rehypeSanitize, sanitizeSchema);

  // Syntax highlighting (after sanitize to preserve classes)
  if (syntaxHighlighting) {
    processor = processor.use(rehypeHighlight, {
      detect: true,
      subset: false,
    });
  }

  processor = processor.use(rehypeStringify);

  return processor;
}
