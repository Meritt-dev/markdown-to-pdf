import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { GET, POST } from "./route";
import type { JobSummary } from "@/lib/db/jobs";
import { DEFAULT_EXPORT_OPTIONS, type ExportOptions } from "@/lib/export-options";

vi.mock("@/lib/db/pool");
vi.mock("@/lib/db/jobs");
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("GET /api/jobs", () => {
  let mockPool: Partial<Pool>;

  beforeEach(async () => {
    mockPool = {
      query: vi.fn(),
    };

    const { getPool } = await import("@/lib/db/pool");
    vi.mocked(getPool).mockResolvedValue(mockPool as Pool);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return jobs list with default limit", async () => {
    const mockJobs: JobSummary[] = [
      {
        id: "job-1",
        status: "completed",
        error: null,
        options: DEFAULT_EXPORT_OPTIONS,
        createdAt: "2026-06-17T12:00:00Z",
        updatedAt: "2026-06-17T12:01:00Z",
        downloadUrl: "/api/jobs/job-1/download",
      },
    ];

    const { listRecentJobs } = await import("@/lib/db/jobs");
    vi.mocked(listRecentJobs).mockResolvedValue(mockJobs);

    const request = new Request("http://localhost/api/jobs");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ jobs: mockJobs });
    expect(listRecentJobs).toHaveBeenCalledWith(mockPool, 20);
  });

  it("should respect limit query parameter", async () => {
    const mockJobs: JobSummary[] = [];

    const { listRecentJobs } = await import("@/lib/db/jobs");
    vi.mocked(listRecentJobs).mockResolvedValue(mockJobs);

    const request = new Request("http://localhost/api/jobs?limit=10");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ jobs: [] });
    expect(listRecentJobs).toHaveBeenCalledWith(mockPool, 10);
  });

  it("should handle invalid limit gracefully", async () => {
    const mockJobs: JobSummary[] = [];

    const { listRecentJobs } = await import("@/lib/db/jobs");
    vi.mocked(listRecentJobs).mockResolvedValue(mockJobs);

    const request = new Request("http://localhost/api/jobs?limit=invalid");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(listRecentJobs).toHaveBeenCalledWith(mockPool, 20);
  });

  it("should return 500 on database error", async () => {
    const { listRecentJobs } = await import("@/lib/db/jobs");
    vi.mocked(listRecentJobs).mockRejectedValue(new Error("Database error"));

    const request = new Request("http://localhost/api/jobs");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Server error" });
  });
});

describe("POST /api/jobs", () => {
  let mockPool: Partial<Pool>;

  beforeEach(async () => {
    mockPool = {
      query: vi.fn(),
    };

    const { getPool } = await import("@/lib/db/pool");
    vi.mocked(getPool).mockResolvedValue(mockPool as Pool);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should create job and return 201 with job id", async () => {
    const jobId = "123e4567-e89b-12d3-a456-426614174000";

    const { insertJob } = await import("@/lib/db/jobs");
    vi.mocked(insertJob).mockResolvedValue(jobId);

    const request = new Request("http://localhost/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: "# Test" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toEqual({ id: jobId });
    expect(insertJob).toHaveBeenCalledWith(mockPool, "# Test", expect.any(Object));
  });

  it("should create job with custom options", async () => {
    const jobId = "123e4567-e89b-12d3-a456-426614174000";
    const options: Partial<ExportOptions> = {
      theme: "minimal",
      paperSize: "letter",
      showPageNumbers: true,
    };

    const { insertJob } = await import("@/lib/db/jobs");
    vi.mocked(insertJob).mockResolvedValue(jobId);

    const request = new Request("http://localhost/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: "# Test", options }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toEqual({ id: jobId });
    expect(insertJob).toHaveBeenCalledWith(mockPool, "# Test", expect.objectContaining(options));
  });

  it("should return 400 on empty markdown", async () => {
    const request = new Request("http://localhost/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: "" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty("error", "Invalid body");
    expect(data).toHaveProperty("details");
  });

  it("should return 400 on missing markdown field", async () => {
    const request = new Request("http://localhost/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty("error", "Invalid body");
  });

  it("should return 400 when markdown exceeds max length", async () => {
    const longMarkdown = "x".repeat(2_000_001);

    const request = new Request("http://localhost/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: longMarkdown }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty("error", "Invalid body");
  });

  it("should return 400 on invalid export options", async () => {
    const request = new Request("http://localhost/api/jobs", {
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

  it("should return 500 on database error", async () => {
    const { insertJob } = await import("@/lib/db/jobs");
    vi.mocked(insertJob).mockRejectedValue(new Error("Database error"));

    const request = new Request("http://localhost/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: "# Test" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Server error" });
  });
});
