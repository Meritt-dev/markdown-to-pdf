import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JobHistory } from "./job-history";

const mockFetch = vi.fn<typeof fetch>();

describe("JobHistory", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should load jobs list on mount", async () => {
    const mockJobs = [
      {
        id: "job-1",
        status: "completed",
        error: null,
        options: { theme: "default", paperSize: "a4", marginPreset: "normal", showPageNumbers: false },
        createdAt: new Date().toISOString(),
        downloadUrl: "/api/jobs/job-1/download",
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: mockJobs }),
    } as Response);

    render(<JobHistory refreshKey={0} />);

    expect(screen.getByText(/loading history/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /download/i })).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/jobs?limit=15");
  });

  it("should show empty state when no jobs", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: [] }),
    } as Response);

    render(<JobHistory refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText(/no exports yet/i)).toBeInTheDocument();
      expect(screen.getByText(/your completed pdfs will appear here/i)).toBeInTheDocument();
    });
  });

  it("should display error message when fetch fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Server error" }),
    } as Response);

    render(<JobHistory refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Could not load history.");
    });
  });

  it("should reload jobs when refresh button is clicked", async () => {
    const mockJobs = [
      {
        id: "job-1",
        status: "completed",
        error: null,
        options: { theme: "default", paperSize: "a4", marginPreset: "normal", showPageNumbers: false },
        createdAt: new Date().toISOString(),
        downloadUrl: "/api/jobs/job-1/download",
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: mockJobs }),
    } as Response);

    render(<JobHistory refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const refreshButton = screen.getByRole("button", { name: /refresh export history/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  it("should reload jobs when refreshKey changes", async () => {
    const mockJobs = [
      {
        id: "job-1",
        status: "completed",
        error: null,
        options: { theme: "default", paperSize: "a4", marginPreset: "normal", showPageNumbers: false },
        createdAt: new Date().toISOString(),
        downloadUrl: "/api/jobs/job-1/download",
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: mockJobs }),
    } as Response);

    const { rerender } = render(<JobHistory refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);

    rerender(<JobHistory refreshKey={1} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  it("should call onSelectJob when job id is clicked", async () => {
    const mockJobs = [
      {
        id: "job-123",
        status: "completed",
        error: null,
        options: { theme: "default", paperSize: "a4", marginPreset: "normal", showPageNumbers: false },
        createdAt: new Date().toISOString(),
        downloadUrl: "/api/jobs/job-123/download",
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: mockJobs }),
    } as Response);

    const onSelectJob = vi.fn();
    render(<JobHistory refreshKey={0} onSelectJob={onSelectJob} />);

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeInTheDocument();
    });

    const jobIdButton = screen.getByText("job-123");
    fireEvent.click(jobIdButton);

    expect(onSelectJob).toHaveBeenCalledWith("job-123");
  });

  it("should display job error message", async () => {
    const mockJobs = [
      {
        id: "job-1",
        status: "failed",
        error: "Conversion failed: invalid markdown",
        options: { theme: "default", paperSize: "a4", marginPreset: "normal", showPageNumbers: false },
        createdAt: new Date().toISOString(),
        downloadUrl: null,
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: mockJobs }),
    } as Response);

    render(<JobHistory refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Failed")).toBeInTheDocument();
      expect(screen.getByText(/conversion failed: invalid markdown/i)).toBeInTheDocument();
    });
  });

  it("should display job with pending status", async () => {
    const mockJobs = [
      {
        id: "job-1",
        status: "pending",
        error: null,
        options: { theme: "default", paperSize: "a4", marginPreset: "normal", showPageNumbers: false },
        createdAt: new Date().toISOString(),
        downloadUrl: null,
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: mockJobs }),
    } as Response);

    render(<JobHistory refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Queued")).toBeInTheDocument();
    });
  });

  it("should display job with running status", async () => {
    const mockJobs = [
      {
        id: "job-1",
        status: "running",
        error: null,
        options: { theme: "default", paperSize: "a4", marginPreset: "normal", showPageNumbers: false },
        createdAt: new Date().toISOString(),
        downloadUrl: null,
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: mockJobs }),
    } as Response);

    render(<JobHistory refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Generating")).toBeInTheDocument();
    });
  });

  it("should show download button only for completed jobs", async () => {
    const mockJobs = [
      {
        id: "job-1",
        status: "completed",
        error: null,
        options: { theme: "default", paperSize: "a4", marginPreset: "normal", showPageNumbers: false },
        createdAt: new Date().toISOString(),
        downloadUrl: "/api/jobs/job-1/download",
      },
      {
        id: "job-2",
        status: "pending",
        error: null,
        options: { theme: "default", paperSize: "a4", marginPreset: "normal", showPageNumbers: false },
        createdAt: new Date().toISOString(),
        downloadUrl: null,
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: mockJobs }),
    } as Response);

    render(<JobHistory refreshKey={0} />);

    await waitFor(() => {
      const downloadButtons = screen.getAllByText(/download/i);
      expect(downloadButtons).toHaveLength(1);
    });
  });
});
