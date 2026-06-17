import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MarkdownPreview } from "./markdown-preview";
import { DEFAULT_EXPORT_OPTIONS } from "@/lib/export-options";

const mockFetch = vi.fn<typeof fetch>();

describe("MarkdownPreview", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should show placeholder when markdown is empty", () => {
    render(<MarkdownPreview markdown="" options={DEFAULT_EXPORT_OPTIONS} />);

    expect(screen.getByText(/preview appears here/i)).toBeInTheDocument();
    expect(screen.getByText(/start writing markdown/i)).toBeInTheDocument();
  });

  it("should fetch preview API after debounce", async () => {
    const mockHtml = "<html><body><h1>Test</h1></body></html>";
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ html: mockHtml }),
    } as Response);

    render(<MarkdownPreview markdown="# Test" options={DEFAULT_EXPORT_OPTIONS} />);

    expect(screen.getByText(/preview appears here/i)).toBeInTheDocument();

    await waitFor(
      () => {
        const iframe = screen.getByTitle("Markdown preview") as HTMLIFrameElement;
        expect(iframe.getAttribute("srcDoc")).toBe(mockHtml);
      },
      { timeout: 2000 }
    );

    expect(mockFetch).toHaveBeenCalledWith("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: "# Test", options: DEFAULT_EXPORT_OPTIONS }),
    });
  });

  it("should show loading state while fetching", async () => {
    let resolveFetch: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    mockFetch.mockReturnValue(fetchPromise);

    render(<MarkdownPreview markdown="# Test" options={DEFAULT_EXPORT_OPTIONS} />);

    await waitFor(() => {
      expect(screen.getByText(/updating/i)).toBeInTheDocument();
    });

    resolveFetch!({
      ok: true,
      json: async () => ({ html: "<html></html>" }),
    } as Response);

    await waitFor(() => {
      expect(screen.queryByText(/updating/i)).not.toBeInTheDocument();
    });
  });

  it("should display error message when fetch fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Rendering failed" }),
    } as Response);

    render(<MarkdownPreview markdown="# Test" options={DEFAULT_EXPORT_OPTIONS} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Rendering failed");
    });
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<MarkdownPreview markdown="# Test" options={DEFAULT_EXPORT_OPTIONS} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });

  it("should debounce rapid markdown changes", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ html: "<html></html>" }),
    } as Response);

    const { rerender } = render(<MarkdownPreview markdown="# Test 1" options={DEFAULT_EXPORT_OPTIONS} />);

    await new Promise((resolve) => setTimeout(resolve, 200));

    rerender(<MarkdownPreview markdown="# Test 2" options={DEFAULT_EXPORT_OPTIONS} />);

    await new Promise((resolve) => setTimeout(resolve, 200));

    rerender(<MarkdownPreview markdown="# Test 3" options={DEFAULT_EXPORT_OPTIONS} />);

    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      },
      { timeout: 2000 }
    );
  });

  it("should update preview when options change", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ html: "<html></html>" }),
    } as Response);

    const { rerender } = render(<MarkdownPreview markdown="# Test" options={DEFAULT_EXPORT_OPTIONS} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    mockFetch.mockClear();

    rerender(<MarkdownPreview markdown="# Test" options={{ ...DEFAULT_EXPORT_OPTIONS, theme: "minimal" }} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  it("should render iframe with sandbox attribute", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ html: "<html><body><h1>Test</h1></body></html>" }),
    } as Response);

    render(<MarkdownPreview markdown="# Test" options={DEFAULT_EXPORT_OPTIONS} />);

    await waitFor(() => {
      const iframe = screen.getByTitle("Markdown preview") as HTMLIFrameElement;
      expect(iframe).toHaveAttribute("sandbox", "");
    });
  });
});
