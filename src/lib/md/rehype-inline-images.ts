import type { Root } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

import { createLogger } from "@/lib/logger";

const log = createLogger("rehype-inline-images");

const FETCH_TIMEOUT_MS = 10_000;
const MAX_IMAGE_SIZE_BYTES = 10_000_000; // 10 MB

/**
 * Options for the rehype-inline-images plugin.
 */
export interface RehypeInlineImagesOptions {
  /**
   * Maximum fetch timeout in milliseconds. Defaults to 10000.
   */
  readonly timeoutMs?: number;

  /**
   * Maximum image size in bytes. Defaults to 10MB.
   */
  readonly maxSizeBytes?: number;
}

/**
 * Fetches an image from a URL and converts it to a base64 data URI.
 *
 * @param url - Remote image URL (must be http or https).
 * @param timeoutMs - Maximum fetch timeout.
 * @param maxSizeBytes - Maximum image size.
 * @returns Base64 data URI string.
 * @throws Error when fetch fails, times out, or image is too large.
 *
 * @example
 * const dataUri = await fetchImageAsDataUri("https://example.com/image.png", 10000, 5000000);
 * // Returns: "data:image/png;base64,iVBORw0KGgoAAAANS..."
 */
async function fetchImageAsDataUri(
  url: string,
  timeoutMs: number,
  maxSizeBytes: number,
): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const contentLength = response.headers.get("content-length");

  if (contentLength && Number.parseInt(contentLength, 10) > maxSizeBytes) {
    throw new Error(`Image too large: ${contentLength} bytes`);
  }

  const arrayBuffer = await response.arrayBuffer();

  if (arrayBuffer.byteLength > maxSizeBytes) {
    throw new Error(`Image too large: ${arrayBuffer.byteLength} bytes`);
  }

  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");

  return `data:${contentType};base64,${base64}`;
}

/**
 * Rehype plugin that fetches remote images and inlines them as base64 data URIs.
 *
 * This ensures PDFs are self-contained and don't rely on external image URLs.
 * Images that fail to fetch are left unchanged (with their original URLs).
 *
 * @param options - Plugin configuration options.
 * @returns Unified plugin that inlines remote images.
 *
 * @example
 * unified()
 *   .use(remarkParse)
 *   .use(remarkRehype)
 *   .use(rehypeInlineImages, { timeoutMs: 15000, maxSizeBytes: 5000000 })
 *   .use(rehypeStringify)
 *   .process(markdown);
 */
export const rehypeInlineImages: Plugin<[RehypeInlineImagesOptions?], Root> = function (
  options = {},
) {
  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS;
  const maxSizeBytes = options.maxSizeBytes ?? MAX_IMAGE_SIZE_BYTES;

  return async (tree) => {
    const promises: Promise<void>[] = [];

    visit(tree, "element", (node) => {
      if (node.tagName !== "img") {
        return;
      }

      const src = node.properties?.src;
      if (typeof src !== "string") {
        return;
      }

      // Only process http/https URLs
      if (!src.startsWith("http://") && !src.startsWith("https://")) {
        return;
      }

      const promise = (async () => {
        try {
          log.debug({ url: src }, "fetching image");
          const dataUri = await fetchImageAsDataUri(src, timeoutMs, maxSizeBytes);
          node.properties = node.properties ?? {};
          node.properties.src = dataUri;
          log.debug({ url: src, dataUriLength: dataUri.length }, "inlined image");
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          log.warn({ url: src, err: error }, `failed to inline image: ${message}`);
          // Leave the original src unchanged on failure
        }
      })();

      promises.push(promise);
    });

    await Promise.all(promises);
  };
};
