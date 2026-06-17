import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import type { ExportOptions } from "@/lib/export-options";

vi.mock("@/lib/md/render-markdown");
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("POST /api/preview", () => {
  beforeEach(() => {
    process.env.DOCUMENT_LOCALE = "en";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return 200 with HTML on valid markdown", async () => {
    const { renderMarkdownToHtmlDocument } = await import("@/lib/md/render-markdown");
    vi.mocked(renderMarkdownToHtmlDocument).mockResolvedValue({
      html: "<html><body><h1>Test</h1></body></html>",
      warnings: [],
    });

    const request = new Request("http://localhost/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: "# Test" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ html: "<html><body><h1>Test</h1></body></html>" });
    expect(renderMarkdownToHtmlDocument).toHaveBeenCalledWith("# Test", "en", expect.any(Object));
  });

  it("should return 200 with HTML on valid markdown and options", async () => {
    const { renderMarkdownToHtmlDocument } = await import("@/lib/md/render-markdown");
    vi.mocked(renderMarkdownToHtmlDocument).mockResolvedValue({
      html: "<html><body><h1>Test</h1></body></html>",
      warnings: [],
    });

    const options: Partial<ExportOptions> = {
      theme: "minimal",
      paperSize: "letter",
      showPageNumbers: true,
    };

    const request = new Request("http://localhost/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: "# Test", options }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("html");
    expect(renderMarkdownToHtmlDocument).toHaveBeenCalledWith(
      "# Test",
      "en",
      expect.objectContaining(options)
    );
  });

  it("should return 400 on missing markdown field", async () => {
    const request = new Request("http://localhost/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty("error", "Invalid body");
    expect(data).toHaveProperty("details");
  });

  it("should return 400 on invalid options", async () => {
    const request = new Request("http://localhost/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        markdown: "# Test",
        options: { theme: "invalid-theme" },
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty("error", "Invalid body");
  });

  it("should return 400 when markdown exceeds max length", async () => {
    const longMarkdown = "x".repeat(2_000_001);

    const request = new Request("http://localhost/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: longMarkdown }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty("error", "Invalid body");
  });

  it("should return 500 when render fails", async () => {
    const { renderMarkdownToHtmlDocument } = await import("@/lib/md/render-markdown");
    vi.mocked(renderMarkdownToHtmlDocument).mockRejectedValue(new Error("Render failed"));

    const request = new Request("http://localhost/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: "# Test" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Server error" });
  });

  it("should handle empty markdown by rendering a space", async () => {
    const { renderMarkdownToHtmlDocument } = await import("@/lib/md/render-markdown");
    vi.mocked(renderMarkdownToHtmlDocument).mockResolvedValue({
      html: "<html><body></body></html>",
      warnings: [],
    });

    const request = new Request("http://localhost/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: "" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(renderMarkdownToHtmlDocument).toHaveBeenCalledWith(" ", "en", expect.any(Object));
  });

  it("should return 400 on malformed JSON", async () => {
    const request = new Request("http://localhost/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Server error" });
  });
});
