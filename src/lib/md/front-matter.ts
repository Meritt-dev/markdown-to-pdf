import type { Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import { parse as parseYaml } from "yaml";

import type { DocumentMetadata } from "@/lib/md/types";

/**
 * Extracts front matter metadata from a remark AST.
 *
 * This plugin should run after `remark-frontmatter` to parse YAML front matter blocks.
 * It stores the extracted metadata in the `data` field of the VFile for later use.
 *
 * @returns Unified plugin that extracts and stores document metadata.
 *
 * @example
 * unified()
 *   .use(remarkParse)
 *   .use(remarkFrontmatter, ['yaml'])
 *   .use(remarkExtractFrontmatter)
 *   .process(markdown);
 */
export const remarkExtractFrontmatter: Plugin<[], Root> = function () {
  return (tree, file) => {
    visit(tree, "yaml", (node) => {
      try {
        const data = parseYaml(node.value) as Record<string, unknown>;
        file.data.frontmatter = data;
      } catch {
        // Ignore invalid YAML
      }
    });
  };
};

/**
 * Strips front matter nodes from the AST so they don't appear in the rendered output.
 *
 * This plugin should run after `remarkExtractFrontmatter` to remove the front matter blocks
 * from the document tree before rendering to HTML.
 *
 * @returns Unified plugin that removes front matter nodes.
 *
 * @example
 * unified()
 *   .use(remarkParse)
 *   .use(remarkFrontmatter, ['yaml'])
 *   .use(remarkExtractFrontmatter)
 *   .use(remarkStripFrontmatter)
 *   .use(remarkRehype)
 *   .process(markdown);
 */
export const remarkStripFrontmatter: Plugin<[], Root> = function () {
  return (tree) => {
    const filtered = tree.children.filter((node) => node.type !== "yaml");
    tree.children = filtered;
  };
};

/**
 * Extracts document metadata from a VFile's data field.
 *
 * @param fileData - VFile data object containing extracted metadata.
 * @returns Parsed document metadata object.
 *
 * @example
 * const file = await processor.process(markdown);
 * const metadata = extractMetadata(file.data);
 * console.log(metadata.title, metadata.author);
 */
export function extractMetadata(fileData: Record<string, unknown>): DocumentMetadata {
  const frontmatter = (fileData.frontmatter as Record<string, unknown> | undefined) ?? {};
  
  return {
    title: typeof frontmatter.title === "string" ? frontmatter.title : undefined,
    author: typeof frontmatter.author === "string" ? frontmatter.author : undefined,
    date: typeof frontmatter.date === "string" ? frontmatter.date : undefined,
    ...frontmatter,
  };
}

/**
 * Generates HTML for a cover page block from document metadata.
 *
 * This creates a styled cover section that will be rendered at the top of the document.
 * The cover is styled via print CSS themes and contains title, author, and date.
 *
 * @param metadata - Document metadata extracted from front matter.
 * @returns HTML string for the cover block, or empty string if no metadata.
 *
 * @example
 * const metadata = { title: "My Document", author: "Jane Doe", date: "2026-06-17" };
 * const coverHtml = buildCoverHtml(metadata);
 * // Returns: '<div class="document-cover">...</div>'
 */
export function buildCoverHtml(metadata: DocumentMetadata): string {
  if (!metadata.title && !metadata.author && !metadata.date) {
    return "";
  }

  const parts: string[] = [];

  if (metadata.title) {
    parts.push(`<h1 class="cover-title">${escapeHtml(metadata.title)}</h1>`);
  }

  if (metadata.author) {
    parts.push(`<p class="cover-author">${escapeHtml(metadata.author)}</p>`);
  }

  if (metadata.date) {
    parts.push(`<p class="cover-date">${escapeHtml(metadata.date)}</p>`);
  }

  return `<div class="document-cover">\n${parts.join("\n")}\n</div>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
