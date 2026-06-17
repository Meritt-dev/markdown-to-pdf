import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { GET } from "./route";
import type { JobRecord } from "@/lib/db/jobs";
import { DEFAULT_EXPORT_OPTIONS } from "@/lib/export-options";

vi.mock("@/lib/db/pool");
vi.mock("@/lib/db/jobs");
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("GET /api/jobs/[id]", () => {
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

  it("should return 200 with job data when completed", async () => {
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

    const request = new Request("http://localhost/api/jobs/test-job-id");
    const params = Promise.resolve({ id: "test-job-id" });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      id: "test-job-id",
      status: "completed",
      error: null,
      options: DEFAULT_EXPORT_OPTIONS,
      createdAt: "2026-06-17T12:00:00Z",
      updatedAt: "2026-06-17T12:01:00Z",
      downloadUrl: "/api/jobs/test-job-id/download",
    });
  });

  it("should return 200 without downloadUrl when pending", async () => {
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

    const request = new Request("http://localhost/api/jobs/test-job-id");
    const params = Promise.resolve({ id: "test-job-id" });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("pending");
    expect(data.downloadUrl).toBeNull();
  });

  it("should return 200 without downloadUrl when running", async () => {
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

    const request = new Request("http://localhost/api/jobs/test-job-id");
    const params = Promise.resolve({ id: "test-job-id" });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("running");
    expect(data.downloadUrl).toBeNull();
  });

  it("should return 200 with error message when failed", async () => {
    const mockJob: JobRecord = {
      id: "test-job-id",
      status: "failed",
      markdown: "# Test",
      error: "Render error occurred",
      options: DEFAULT_EXPORT_OPTIONS,
      createdAt: "2026-06-17T12:00:00Z",
      updatedAt: "2026-06-17T12:01:00Z",
    };

    const { getJobById } = await import("@/lib/db/jobs");
    vi.mocked(getJobById).mockResolvedValue(mockJob);

    const request = new Request("http://localhost/api/jobs/test-job-id");
    const params = Promise.resolve({ id: "test-job-id" });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("failed");
    expect(data.error).toBe("Render error occurred");
    expect(data.downloadUrl).toBeNull();
  });

  it("should return 404 when job not found", async () => {
    const { getJobById } = await import("@/lib/db/jobs");
    vi.mocked(getJobById).mockResolvedValue(null);

    const request = new Request("http://localhost/api/jobs/nonexistent");
    const params = Promise.resolve({ id: "nonexistent" });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ error: "Not found" });
  });

  it("should return 500 on database error", async () => {
    const { getJobById } = await import("@/lib/db/jobs");
    vi.mocked(getJobById).mockRejectedValue(new Error("Database error"));

    const request = new Request("http://localhost/api/jobs/test-job-id");
    const params = Promise.resolve({ id: "test-job-id" });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Server error" });
  });
});
