import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JobConsole } from "./job-console";

const mockFetch = vi.fn<typeof fetch>();
const mockEventSource = vi.fn<typeof EventSource>();

describe("JobConsole", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockEventSource.mockReset();
    vi.stubGlobal("fetch", mockFetch);
    vi.stubGlobal("EventSource", mockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should render with default sample markdown", () => {
    render(<JobConsole />);

    expect(screen.getByRole("textbox", { name: /markdown source/i })).toBeInTheDocument();
    expect(screen.getByText(/export pdf/i)).toBeInTheDocument();
  });

  it("should switch between edit and preview tabs", () => {
    render(<JobConsole />);

    const editTab = screen.getByRole("tab", { name: /edit/i });
    const previewTab = screen.getByRole("tab", { name: /preview/i });

    expect(editTab).toHaveAttribute("aria-selected", "true");
    expect(previewTab).toHaveAttribute("aria-selected", "false");

    fireEvent.click(previewTab);

    expect(editTab).toHaveAttribute("aria-selected", "false");
    expect(previewTab).toHaveAttribute("aria-selected", "true");
  });

  it("should disable export button when markdown is empty", () => {
    render(<JobConsole />);

    const textarea = screen.getByRole("textbox", { name: /markdown source/i }) as HTMLTextAreaElement;
    const exportButton = screen.getByRole("button", { name: /export pdf/i });

    fireEvent.change(textarea, { target: { value: "" } });

    expect(exportButton).toBeDisabled();
  });

  it("should disable export button when markdown is only whitespace", () => {
    render(<JobConsole />);

    const textarea = screen.getByRole("textbox", { name: /markdown source/i }) as HTMLTextAreaElement;
    const exportButton = screen.getByRole("button", { name: /export pdf/i });

    fireEvent.change(textarea, { target: { value: "   \n\n  " } });

    expect(exportButton).toBeDisabled();
  });

  it("should enable export button when markdown has content", () => {
    render(<JobConsole />);

    const textarea = screen.getByRole("textbox", { name: /markdown source/i }) as HTMLTextAreaElement;
    const exportButton = screen.getByRole("button", { name: /export pdf/i });

    fireEvent.change(textarea, { target: { value: "# Test" } });

    expect(exportButton).not.toBeDisabled();
  });

  it("should update character count when typing", () => {
    render(<JobConsole />);

    const textarea = screen.getByRole("textbox", { name: /markdown source/i }) as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "# Test" } });

    expect(screen.getByText(/6 chars/i)).toBeInTheDocument();
  });

  it("should show upload button", () => {
    render(<JobConsole />);

    expect(screen.getByRole("button", { name: /upload/i })).toBeInTheDocument();
  });

  it("should clear loaded file name when editing markdown", () => {
    render(<JobConsole />);

    const textarea = screen.getByRole("textbox", { name: /markdown source/i }) as HTMLTextAreaElement;
    const originalValue = textarea.value;

    fireEvent.change(textarea, { target: { value: originalValue + "\n# New content" } });

    expect(screen.queryByText(/\.md/i)).not.toBeInTheDocument();
  });

  it("should render export options panel", () => {
    render(<JobConsole />);

    expect(screen.getByText(/export options/i)).toBeInTheDocument();
  });

  it("should render job history section", () => {
    render(<JobConsole />);

    expect(screen.getByText(/recent exports/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refresh export history/i })).toBeInTheDocument();
  });

  it("should show split tab on large screens", () => {
    render(<JobConsole />);

    const splitTab = screen.getByRole("tab", { name: /split/i });
    expect(splitTab).toBeInTheDocument();
  });

  it("should switch to split view", () => {
    render(<JobConsole />);

    const splitTab = screen.getByRole("tab", { name: /split/i });
    fireEvent.click(splitTab);

    expect(splitTab).toHaveAttribute("aria-selected", "true");
  });

  it("should render markdown preview component", () => {
    render(<JobConsole />);

    const previewTab = screen.getByRole("tab", { name: /preview/i });
    fireEvent.click(previewTab);

    expect(screen.getByText(/live preview/i)).toBeInTheDocument();
  });

  it("should have file input with correct accept attribute", () => {
    render(<JobConsole />);

    const fileInput = screen.getByLabelText(/upload markdown file/i) as HTMLInputElement;
    expect(fileInput).toHaveAttribute("accept", ".md,.markdown,text/markdown");
  });

  it("should show sample markdown by default", () => {
    render(<JobConsole />);

    const textarea = screen.getByRole("textbox", { name: /markdown source/i }) as HTMLTextAreaElement;
    expect(textarea.value).toContain("Professional Markdown to PDF");
    expect(textarea.value).toContain("## Table of Contents");
  });
});
