import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExportOptions } from "./export-options";
import { convertHtmlToPdf, type PdfMetadata } from "./gotenberg";

describe("gotenberg", () => {
  const originalFetch = globalThis.fetch;
  const defaultOptions: ExportOptions = {
    theme: "default",
    paperSize: "a4",
    marginPreset: "default",
    showPageNumbers: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("convertHtmlToPdf", () => {
    it("should send HTML to Gotenberg and return PDF buffer", async () => {
      const mockPdfBuffer = Buffer.from("fake-pdf-content");
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => {
          // Return a proper ArrayBuffer, not the buffer property
          const buf = Buffer.from("fake-pdf-content");
          return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        },
      } as any;

      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      const html = "<!DOCTYPE html><html><body>Test</body></html>";
      const result = await convertHtmlToPdf(html, defaultOptions);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe("fake-pdf-content");
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it("should send correct form fields to Gotenberg", async () => {
      const mockPdfBuffer = Buffer.from("pdf");
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => mockPdfBuffer.buffer,
      } as any;

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      const html = "<!DOCTYPE html><html><body>Test</body></html>";
      await convertHtmlToPdf(html, defaultOptions);

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/forms/chromium/convert/html"),
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
          signal: expect.any(AbortSignal),
        })
      );

      const call = fetchSpy.mock.calls[0];
      const formData = call[1].body as FormData;
      
      // Check that HTML file was added
      expect(formData.has("files")).toBe(true);
      expect(formData.has("emulatedMediaType")).toBe(true);
      expect(formData.get("emulatedMediaType")).toBe("print");
      expect(formData.get("printBackground")).toBe("true");
    });

    it("should apply A4 paper size dimensions", async () => {
      const mockPdfBuffer = Buffer.from("pdf");
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => mockPdfBuffer.buffer,
      } as any;

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      const options: ExportOptions = {
        ...defaultOptions,
        paperSize: "a4",
      };

      await convertHtmlToPdf("<html></html>", options);

      const formData = fetchSpy.mock.calls[0][1].body as FormData;
      expect(formData.get("paperWidth")).toBe("8.27");
      expect(formData.get("paperHeight")).toBe("11.7");
    });

    it("should apply letter paper size dimensions", async () => {
      const mockPdfBuffer = Buffer.from("pdf");
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => mockPdfBuffer.buffer,
      } as any;

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      const options: ExportOptions = {
        ...defaultOptions,
        paperSize: "letter",
      };

      await convertHtmlToPdf("<html></html>", options);

      const formData = fetchSpy.mock.calls[0][1].body as FormData;
      expect(formData.get("paperWidth")).toBe("8.5");
      expect(formData.get("paperHeight")).toBe("11");
    });

    it("should apply narrow margin preset", async () => {
      const mockPdfBuffer = Buffer.from("pdf");
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => mockPdfBuffer.buffer,
      } as any;

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      const options: ExportOptions = {
        ...defaultOptions,
        marginPreset: "narrow",
      };

      await convertHtmlToPdf("<html></html>", options);

      const formData = fetchSpy.mock.calls[0][1].body as FormData;
      // 8mm = ~0.31 inches
      expect(formData.get("marginTop")).toBe("0.31");
      expect(formData.get("marginLeft")).toBe("0.31");
      expect(formData.get("marginRight")).toBe("0.31");
    });

    it("should apply default margin preset", async () => {
      const mockPdfBuffer = Buffer.from("pdf");
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => mockPdfBuffer.buffer,
      } as any;

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      const options: ExportOptions = {
        ...defaultOptions,
        marginPreset: "default",
      };

      await convertHtmlToPdf("<html></html>", options);

      const formData = fetchSpy.mock.calls[0][1].body as FormData;
      // 12mm = ~0.47 inches
      expect(formData.get("marginTop")).toBe("0.47");
      expect(formData.get("marginLeft")).toBe("0.47");
      expect(formData.get("marginRight")).toBe("0.47");
    });

    it("should apply wide margin preset", async () => {
      const mockPdfBuffer = Buffer.from("pdf");
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => mockPdfBuffer.buffer,
      } as any;

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      const options: ExportOptions = {
        ...defaultOptions,
        marginPreset: "wide",
      };

      await convertHtmlToPdf("<html></html>", options);

      const formData = fetchSpy.mock.calls[0][1].body as FormData;
      // 20mm = ~0.79 inches
      expect(formData.get("marginTop")).toBe("0.79");
      expect(formData.get("marginLeft")).toBe("0.79");
      expect(formData.get("marginRight")).toBe("0.79");
    });

    it("should include footer when showPageNumbers is true", async () => {
      const mockPdfBuffer = Buffer.from("pdf");
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => mockPdfBuffer.buffer,
      } as any;

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      const options: ExportOptions = {
        ...defaultOptions,
        showPageNumbers: true,
      };

      await convertHtmlToPdf("<html></html>", options);

      const formData = fetchSpy.mock.calls[0][1].body as FormData;
      const files = formData.getAll("files");
      
      // Should have both index.html and footer.html
      expect(files.length).toBe(2);
      
      // Bottom margin should be larger to accommodate footer
      const bottomMargin = Number.parseFloat(formData.get("marginBottom") as string);
      const topMargin = Number.parseFloat(formData.get("marginTop") as string);
      expect(bottomMargin).toBeGreaterThan(topMargin);
    });

    it("should not include footer when showPageNumbers is false", async () => {
      const mockPdfBuffer = Buffer.from("pdf");
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => mockPdfBuffer.buffer,
      } as any;

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      const options: ExportOptions = {
        ...defaultOptions,
        showPageNumbers: false,
      };

      await convertHtmlToPdf("<html></html>", options);

      const formData = fetchSpy.mock.calls[0][1].body as FormData;
      const files = formData.getAll("files");
      
      // Should only have index.html
      expect(files.length).toBe(1);
    });

    it("should include PDF metadata when provided", async () => {
      const mockPdfBuffer = Buffer.from("pdf");
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => mockPdfBuffer.buffer,
      } as any;

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      const metadata: PdfMetadata = {
        title: "Test Document",
        author: "Jane Doe",
      };

      await convertHtmlToPdf("<html></html>", defaultOptions, metadata);

      const formData = fetchSpy.mock.calls[0][1].body as FormData;
      expect(formData.get("pdfTitle")).toBe("Test Document");
      expect(formData.get("pdfAuthor")).toBe("Jane Doe");
    });

    it("should omit metadata fields when not provided", async () => {
      const mockPdfBuffer = Buffer.from("pdf");
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => mockPdfBuffer.buffer,
      } as any;

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      await convertHtmlToPdf("<html></html>", defaultOptions);

      const formData = fetchSpy.mock.calls[0][1].body as FormData;
      expect(formData.has("pdfTitle")).toBe(false);
      expect(formData.has("pdfAuthor")).toBe(false);
    });

    it("should throw error on non-OK response", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: async () => "Internal server error",
      } as any;

      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      await expect(convertHtmlToPdf("<html></html>", defaultOptions)).rejects.toThrow(
        /Gotenberg HTTP 500/
      );
    });

    it("should handle Gotenberg error with details", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: async () => "Invalid HTML structure",
      } as any;

      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      await expect(convertHtmlToPdf("<html></html>", defaultOptions)).rejects.toThrow(
        /Gotenberg HTTP 400.*Invalid HTML/
      );
    });

    it("should handle network errors", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

      await expect(convertHtmlToPdf("<html></html>", defaultOptions)).rejects.toThrow(
        "Network failure"
      );
    });

    it("should use GOTENBERG_URL from environment", async () => {
      const originalEnv = process.env.GOTENBERG_URL;
      process.env.GOTENBERG_URL = "http://custom-gotenberg:9000";

      const mockPdfBuffer = Buffer.from("pdf");
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => mockPdfBuffer.buffer,
      } as any;

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      await convertHtmlToPdf("<html></html>", defaultOptions);

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://custom-gotenberg:9000/forms/chromium/convert/html",
        expect.anything()
      );

      if (originalEnv !== undefined) {
        process.env.GOTENBERG_URL = originalEnv;
      } else {
        delete process.env.GOTENBERG_URL;
      }
    });

    it("should use default URL when GOTENBERG_URL not set", async () => {
      const originalEnv = process.env.GOTENBERG_URL;
      delete process.env.GOTENBERG_URL;

      const mockPdfBuffer = Buffer.from("pdf");
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => mockPdfBuffer.buffer,
      } as any;

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      await convertHtmlToPdf("<html></html>", defaultOptions);

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:3030/forms/chromium/convert/html",
        expect.anything()
      );

      if (originalEnv !== undefined) {
        process.env.GOTENBERG_URL = originalEnv;
      }
    });

    it("should set correct timeout", async () => {
      const mockPdfBuffer = Buffer.from("pdf");
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => mockPdfBuffer.buffer,
      } as any;

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      await convertHtmlToPdf("<html></html>", defaultOptions);

      const call = fetchSpy.mock.calls[0];
      expect(call[1].signal).toBeInstanceOf(AbortSignal);
    });

    it("should handle ECONNREFUSED error", async () => {
      const connError = new Error("connect ECONNREFUSED 127.0.0.1:3030");
      (connError as any).code = "ECONNREFUSED";
      globalThis.fetch = vi.fn().mockRejectedValue(connError);

      await expect(convertHtmlToPdf("<html></html>", defaultOptions)).rejects.toThrow(
        /ECONNREFUSED/
      );
    });

    it("should handle timeout error", async () => {
      const timeoutError = new Error("The operation was aborted");
      timeoutError.name = "AbortError";
      globalThis.fetch = vi.fn().mockRejectedValue(timeoutError);

      await expect(convertHtmlToPdf("<html></html>", defaultOptions)).rejects.toThrow(
        /aborted/
      );
    });
  });
});
