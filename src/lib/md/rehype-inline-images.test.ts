import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";

import { rehypeInlineImages } from "./rehype-inline-images";

describe("rehype-inline-images", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("image inlining", () => {
    it("should inline https image to base64 data URI", async () => {
      const imageBuffer = Buffer.from("fake-image-data");
      const mockResponse = {
        ok: true,
        headers: {
          get: (name: string) => (name === "content-type" ? "image/png" : null),
        },
        arrayBuffer: async () => {
          const buf = Buffer.from("fake-image-data");
          return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        },
      } as any;

      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      const markdown = "![test](https://example.com/image.png)";
      const processor = unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypeInlineImages, { timeoutMs: 5000 })
        .use(rehypeStringify);

      const result = await processor.process(markdown);
      const html = String(result);

      expect(html).toContain("data:image/png;base64,");
      expect(html).toContain(imageBuffer.toString("base64"));
      expect(html).not.toContain("https://example.com/image.png");
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://example.com/image.png",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it("should inline http image to base64 data URI", async () => {
      const imageBuffer = Buffer.from("test-data");
      const mockResponse = {
        ok: true,
        headers: {
          get: (name: string) => (name === "content-type" ? "image/jpeg" : null),
        },
        arrayBuffer: async () => {
          const buf = Buffer.from("test-data");
          return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        },
      } as any;

      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      const markdown = "![test](http://example.com/photo.jpg)";
      const processor = unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypeInlineImages)
        .use(rehypeStringify);

      const result = await processor.process(markdown);
      const html = String(result);

      expect(html).toContain("data:image/jpeg;base64,");
      expect(html).toContain(imageBuffer.toString("base64"));
    });

    it("should leave relative URLs unchanged", async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const markdown = "![local](./images/local.png)";
      const processor = unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypeInlineImages)
        .use(rehypeStringify);

      const result = await processor.process(markdown);
      const html = String(result);

      expect(html).toContain("./images/local.png");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should leave data URIs unchanged", async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA";
      const markdown = `![embedded](${dataUri})`;
      const processor = unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypeInlineImages)
        .use(rehypeStringify);

      const result = await processor.process(markdown);
      const html = String(result);

      expect(html).toContain(dataUri);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should leave original URL on fetch failure", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const markdown = "![fail](https://example.com/missing.png)";
      const processor = unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypeInlineImages)
        .use(rehypeStringify);

      const result = await processor.process(markdown);
      const html = String(result);

      expect(html).toContain("https://example.com/missing.png");
      expect(html).not.toContain("data:image");
    });

    it("should leave original URL on HTTP error status", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      } as any;

      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      const markdown = "![404](https://example.com/notfound.png)";
      const processor = unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypeInlineImages)
        .use(rehypeStringify);

      const result = await processor.process(markdown);
      const html = String(result);

      expect(html).toContain("https://example.com/notfound.png");
      expect(html).not.toContain("data:image");
    });

    it("should handle timeout errors gracefully", async () => {
      globalThis.fetch = vi.fn().mockImplementation(() => {
        return Promise.reject(new Error("TimeoutError"));
      });

      const markdown = "![slow](https://slow-server.com/image.png)";
      const processor = unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypeInlineImages, { timeoutMs: 100 })
        .use(rehypeStringify);

      const result = await processor.process(markdown);
      const html = String(result);

      expect(html).toContain("https://slow-server.com/image.png");
    });

    it("should reject images exceeding maxSizeBytes via content-length", async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: (name: string) => {
            if (name === "content-type") return "image/png";
            if (name === "content-length") return "15000000";
            return null;
          },
        },
        arrayBuffer: async () => new ArrayBuffer(15000000),
      } as any;

      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      const markdown = "![huge](https://example.com/huge.png)";
      const processor = unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypeInlineImages, { maxSizeBytes: 1000000 })
        .use(rehypeStringify);

      const result = await processor.process(markdown);
      const html = String(result);

      expect(html).toContain("https://example.com/huge.png");
    });

    it("should reject images exceeding maxSizeBytes after download", async () => {
      const largeBuffer = Buffer.alloc(15000000);
      const mockResponse = {
        ok: true,
        headers: {
          get: (name: string) => (name === "content-type" ? "image/png" : null),
        },
        arrayBuffer: async () => {
          const buf = Buffer.alloc(15000000);
          return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        },
      } as any;

      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      const markdown = "![large](https://example.com/large.png)";
      const processor = unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypeInlineImages, { maxSizeBytes: 1000000 })
        .use(rehypeStringify);

      const result = await processor.process(markdown);
      const html = String(result);

      expect(html).toContain("https://example.com/large.png");
    });

    it("should handle multiple images in parallel", async () => {
      const imageBuffer1 = Buffer.from("image1");
      const imageBuffer2 = Buffer.from("image2");

      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: (name: string) => (name === "content-type" ? "image/png" : null),
          },
          arrayBuffer: async () => {
            const buf = Buffer.from("image1");
            return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
          },
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: (name: string) => (name === "content-type" ? "image/jpeg" : null),
          },
          arrayBuffer: async () => {
            const buf = Buffer.from("image2");
            return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
          },
        } as any);

      const markdown = `![img1](https://example.com/1.png)
![img2](https://example.com/2.jpg)`;

      const processor = unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypeInlineImages)
        .use(rehypeStringify);

      const result = await processor.process(markdown);
      const html = String(result);

      expect(html).toContain("data:image/png;base64,");
      expect(html).toContain("data:image/jpeg;base64,");
      expect(html).toContain(imageBuffer1.toString("base64"));
      expect(html).toContain(imageBuffer2.toString("base64"));
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it("should use default content-type when header missing", async () => {
      const imageBuffer = Buffer.from("data");
      const mockResponse = {
        ok: true,
        headers: {
          get: () => null,
        },
        arrayBuffer: async () => {
          const buf = Buffer.from("data");
          return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        },
      } as any;

      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      const markdown = "![no-type](https://example.com/image)";
      const processor = unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypeInlineImages)
        .use(rehypeStringify);

      const result = await processor.process(markdown);
      const html = String(result);

      expect(html).toContain("data:application/octet-stream;base64,");
    });

    it("should respect custom timeout option", async () => {
      const imageBuffer = Buffer.from("data");
      const mockResponse = {
        ok: true,
        headers: {
          get: (name: string) => (name === "content-type" ? "image/png" : null),
        },
        arrayBuffer: async () => {
          const buf = Buffer.from("data");
          return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        },
      } as any;

      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      const markdown = "![test](https://example.com/image.png)";
      const processor = unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypeInlineImages, { timeoutMs: 5000 })
        .use(rehypeStringify);

      await processor.process(markdown);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://example.com/image.png",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });
});
