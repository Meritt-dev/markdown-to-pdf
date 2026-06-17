import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { GET } from "./route";
import type { JobRecord } from "@/lib/db/jobs";
import { DEFAULT_EXPORT_OPTIONS } from "@/lib/export-options";

vi.mock("node:fs/promises", () => {
  const mockReadFile = vi.fn();
  return {
    default: {
      readFile: mockReadFile,
    },
    readFile: mockReadFile,
  };
});

vi.mock("@/lib/db/pool");
vi.mock("@/lib/db/jobs");
vi.mock("@/lib/paths");
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("GET /api/jobs/[id]/download", () => {
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

  it("should return 200 with PDF bytes when job completed and file exists", async () => {
    const mockJob: JobRecord = {
      id: "test-job-id",
      status: "completed",
      markdown: "# Test",
      error: null,
      options: DEFAULT_EXPORT_OPTIONS,
      createdAt: "2026-06-17T12:00:00Z",
      updatedAt: "2026-06-17T12:01:00Z",
    };

    const { getJobById } = await import("@/lib/db/jobs");
    vi.mocked(getJobById).mockResolvedValue(mockJob);

    const { getPdfPathForJob } = await import("@/lib/paths");
    vi.mocked(getPdfPathForJob).mockReturnValue("/tmp/test-job-id.pdf");

    const fs = await import("node:fs/promises");
    const mockPdfBuffer = Buffer.from("fake-pdf-content");
    vi.mocked(fs.readFile).mockResolvedValue(mockPdfBuffer);

    const request = new Request("http://localhost/api/jobs/test-job-id/download");
    const params = Promise.resolve({ id: "test-job-id" });

    const response = await GET(request, { params });
    const buffer = await response.arrayBuffer();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="document-test-job-id.pdf"');
    expect(Buffer.from(buffer).toString()).toBe("fake-pdf-content");
  });

  it("should return 404 when job not found", async () => {
    const { getJobById } = await import("@/lib/db/jobs");
    vi.mocked(getJobById).mockResolvedValue(null);

    const request = new Request("http://localhost/api/jobs/nonexistent/download");
    const params = Promise.resolve({ id: "nonexistent" });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ error: "Not found" });
  });

  it("should return 409 when job is pending", async () => {
    const mockJob: JobRecord = {
      id: "test-job-id",
      status: "pending",
      markdown: "# Test",
      error: null,
      options: DEFAULT_EXPORT_OPTIONS,
      createdAt: "2026-06-17T12:00:00Z",
      updatedAt: "2026-06-17T12:00:00Z",
    };

    const { getJobById } = await import("@/lib/db/jobs");
    vi.mocked(getJobById).mockResolvedValue(mockJob);

    const request = new Request("http://localhost/api/jobs/test-job-id/download");
    const params = Promise.resolve({ id: "test-job-id" });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data).toEqual({ error: "Not ready" });
  });

  it("should return 409 when job is running", async () => {
    const mockJob: JobRecord = {
      id: "test-job-id",
      status: "running",
      markdown: "# Test",
      error: null,
      options: DEFAULT_EXPORT_OPTIONS,
      createdAt: "2026-06-17T12:00:00Z",
      updatedAt: "2026-06-17T12:00:00Z",
    };

    const { getJobById } = await import("@/lib/db/jobs");
    vi.mocked(getJobById).mockResolvedValue(mockJob);

    const request = new Request("http://localhost/api/jobs/test-job-id/download");
    const params = Promise.resolve({ id: "test-job-id" });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data).toEqual({ error: "Not ready" });
  });

  it("should return 409 when job failed", async () => {
    const mockJob: JobRecord = {
      id: "test-job-id",
      status: "failed",
      markdown: "# Test",
      error: "Conversion failed",
      options: DEFAULT_EXPORT_OPTIONS,
      createdAt: "2026-06-17T12:00:00Z",
      updatedAt: "2026-06-17T12:01:00Z",
    };

    const { getJobById } = await import("@/lib/db/jobs");
    vi.mocked(getJobById).mockResolvedValue(mockJob);

    const request = new Request("http://localhost/api/jobs/test-job-id/download");
    const params = Promise.resolve({ id: "test-job-id" });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data).toEqual({ error: "Not ready" });
  });

  it("should return 500 when PDF file is missing on disk", async () => {
    const mockJob: JobRecord = {
      id: "test-job-id",
      status: "completed",
      markdown: "# Test",
      error: null,
      options: DEFAULT_EXPORT_OPTIONS,
      createdAt: "2026-06-17T12:00:00Z",
      updatedAt: "2026-06-17T12:01:00Z",
    };

    const { getJobById } = await import("@/lib/db/jobs");
    vi.mocked(getJobById).mockResolvedValue(mockJob);

    const { getPdfPathForJob } = await import("@/lib/paths");
    vi.mocked(getPdfPathForJob).mockReturnValue("/tmp/test-job-id.pdf");

    const fs = await import("node:fs/promises");
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT: no such file"));

    const request = new Request("http://localhost/api/jobs/test-job-id/download");
    const params = Promise.resolve({ id: "test-job-id" });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "File missing" });
  });

  it("should return 500 on database error", async () => {
    const { getJobById } = await import("@/lib/db/jobs");
    vi.mocked(getJobById).mockRejectedValue(new Error("Database error"));

    const request = new Request("http://localhost/api/jobs/test-job-id/download");
    const params = Promise.resolve({ id: "test-job-id" });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Server error" });
  });
});
