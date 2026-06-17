import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { processOneJob } from "./worker";
import type { ExportOptions } from "@/lib/export-options";
import { DEFAULT_EXPORT_OPTIONS } from "@/lib/export-options";

vi.mock("@/lib/db/pool");
vi.mock("@/lib/db/jobs");
vi.mock("@/lib/gotenberg");
vi.mock("@/lib/md/render-markdown");
vi.mock("@/lib/paths");
vi.mock("node:fs", () => ({
  default: {
    promises: {
      writeFile: vi.fn(),
    },
  },
}));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    fatal: vi.fn(),
  }),
}));

describe("worker", () => {
  let mockPool: Partial<Pool>;

  beforeEach(async () => {
    mockPool = {
      query: vi.fn(),
    };

    const { getPool } = await import("@/lib/db/pool");
    vi.mocked(getPool).mockResolvedValue(mockPool as Pool);

    const { ensurePdfStorageDir, getPdfPathForJob } = await import("@/lib/paths");
    vi.mocked(ensurePdfStorageDir).mockReturnValue(undefined);
    vi.mocked(getPdfPathForJob).mockReturnValue("/tmp/test-job.pdf");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("processOneJob", () => {
    it("should process job successfully and mark completed", async () => {
      const jobId = "job-123";
      const markdown = "# Test Document";
      const options: ExportOptions = DEFAULT_EXPORT_OPTIONS;

      const { renderMarkdownToHtmlDocument } = await import("@/lib/md/render-markdown");
      vi.mocked(renderMarkdownToHtmlDocument).mockResolvedValue({
        html: "<html><body><h1>Test</h1></body></html>",
        metadata: { title: "Test Document", author: "Test Author" },
      });

      const { convertHtmlToPdf } = await import("@/lib/gotenberg");
      const mockPdfBuffer = Buffer.from("mock-pdf-content");
      vi.mocked(convertHtmlToPdf).mockResolvedValue(mockPdfBuffer);

      const { markJobCompleted } = await import("@/lib/db/jobs");
      vi.mocked(markJobCompleted).mockResolvedValue();

      const fs = await import("node:fs");
      vi.mocked(fs.default.promises.writeFile).mockResolvedValue();

      await processOneJob(jobId, markdown, options, mockPool as Pool);

      expect(renderMarkdownToHtmlDocument).toHaveBeenCalledWith(markdown, "en", options);
      expect(convertHtmlToPdf).toHaveBeenCalledWith(
        expect.stringContaining("<h1>Test</h1>"),
        options,
        { title: "Test Document", author: "Test Author" }
      );
      expect(fs.default.promises.writeFile).toHaveBeenCalledWith("/tmp/test-job.pdf", mockPdfBuffer);
      expect(markJobCompleted).toHaveBeenCalledWith(mockPool, jobId);
    });

    it("should mark job failed on conversion error", async () => {
      const jobId = "job-456";
      const markdown = "# Test";
      const options: ExportOptions = DEFAULT_EXPORT_OPTIONS;

      const { renderMarkdownToHtmlDocument } = await import("@/lib/md/render-markdown");
      vi.mocked(renderMarkdownToHtmlDocument).mockRejectedValue(new Error("Conversion failed"));

      await expect(processOneJob(jobId, markdown, options, mockPool as Pool)).rejects.toThrow(
        "Conversion failed"
      );
    });

    it("should handle gotenberg conversion failure", async () => {
      const jobId = "job-789";
      const markdown = "# Test";
      const options: ExportOptions = DEFAULT_EXPORT_OPTIONS;

      const { renderMarkdownToHtmlDocument } = await import("@/lib/md/render-markdown");
      vi.mocked(renderMarkdownToHtmlDocument).mockResolvedValue({
        html: "<html><body><h1>Test</h1></body></html>",
        metadata: { title: "Test", author: null },
      });

      const { convertHtmlToPdf } = await import("@/lib/gotenberg");
      vi.mocked(convertHtmlToPdf).mockRejectedValue(new Error("PDF generation failed"));

      await expect(processOneJob(jobId, markdown, options, mockPool as Pool)).rejects.toThrow(
        "PDF generation failed"
      );
    });

    it("should use custom document locale from env", async () => {
      const originalEnv = process.env.DOCUMENT_LOCALE;
      process.env.DOCUMENT_LOCALE = "fr";

      const jobId = "job-locale";
      const markdown = "# Test";
      const options: ExportOptions = DEFAULT_EXPORT_OPTIONS;

      const { renderMarkdownToHtmlDocument } = await import("@/lib/md/render-markdown");
      vi.mocked(renderMarkdownToHtmlDocument).mockResolvedValue({
        html: "<html><body><h1>Test</h1></body></html>",
        metadata: { title: "Test", author: null },
      });

      const { convertHtmlToPdf } = await import("@/lib/gotenberg");
      vi.mocked(convertHtmlToPdf).mockResolvedValue(Buffer.from("pdf"));

      const { markJobCompleted } = await import("@/lib/db/jobs");
      vi.mocked(markJobCompleted).mockResolvedValue();

      const fs = await import("node:fs");
      vi.mocked(fs.default.promises.writeFile).mockResolvedValue();

      await processOneJob(jobId, markdown, options, mockPool as Pool);

      expect(renderMarkdownToHtmlDocument).toHaveBeenCalledWith(markdown, "fr", options);

      if (originalEnv !== undefined) {
        process.env.DOCUMENT_LOCALE = originalEnv;
      } else {
        delete process.env.DOCUMENT_LOCALE;
      }
    });
  });
});
