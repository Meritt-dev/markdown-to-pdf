import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool, PoolClient } from "pg";
import { GET } from "./route";
import type { Job } from "@/lib/db/jobs";
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

describe("GET /api/jobs/[id]/stream", () => {
  let mockPool: Partial<Pool>;
  let mockClient: Partial<PoolClient>;

  beforeEach(async () => {
    mockClient = {
      query: vi.fn(),
      on: vi.fn(),
      release: vi.fn(),
    };

    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    };

    const { getPool } = await import("@/lib/db/pool");
    vi.mocked(getPool).mockResolvedValue(mockPool as Pool);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return 404 when job not found", async () => {
    const { getJobById } = await import("@/lib/db/jobs");
    vi.mocked(getJobById).mockResolvedValue(null);

    const request = new Request("http://localhost/api/jobs/job-123/stream");
    const response = await GET(request, {
      params: Promise.resolve({ id: "job-123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ error: "Job not found" });
  });

  it("should return text/event-stream content-type", async () => {
    const mockJob: Job = {
      id: "job-123",
      status: "pending",
      markdown: "# Test",
      error: null,
      options: DEFAULT_EXPORT_OPTIONS,
      createdAt: new Date("2026-06-17T12:00:00Z"),
      updatedAt: new Date("2026-06-17T12:00:00Z"),
    };

    const { getJobById } = await import("@/lib/db/jobs");
    vi.mocked(getJobById).mockResolvedValue(mockJob);

    const request = new Request("http://localhost/api/jobs/job-123/stream");
    const response = await GET(request, {
      params: Promise.resolve({ id: "job-123" }),
    });

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    expect(response.headers.get("Connection")).toBe("keep-alive");
  });

  it("should send initial status event for pending job", async () => {
    const mockJob: Job = {
      id: "job-123",
      status: "pending",
      markdown: "# Test",
      error: null,
      options: DEFAULT_EXPORT_OPTIONS,
      createdAt: new Date("2026-06-17T12:00:00Z"),
      updatedAt: new Date("2026-06-17T12:00:00Z"),
    };

    const { getJobById } = await import("@/lib/db/jobs");
    vi.mocked(getJobById).mockResolvedValue(mockJob);

    const request = new Request("http://localhost/api/jobs/job-123/stream");
    const response = await GET(request, {
      params: Promise.resolve({ id: "job-123" }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    expect(reader).toBeDefined();
    if (!reader) return;

    const { value } = await reader.read();
    const chunk = decoder.decode(value);

    expect(chunk).toContain("event: status");
    expect(chunk).toContain('"status":"pending"');
    expect(chunk).toContain('"downloadUrl":null');

    reader.cancel();
  });

  it("should complete immediately when job is completed", async () => {
    const mockJob: Job = {
      id: "job-123",
      status: "completed",
      markdown: "# Test",
      error: null,
      options: DEFAULT_EXPORT_OPTIONS,
      createdAt: new Date("2026-06-17T12:00:00Z"),
      updatedAt: new Date("2026-06-17T12:01:00Z"),
    };

    const { getJobById } = await import("@/lib/db/jobs");
    vi.mocked(getJobById).mockResolvedValue(mockJob);

    const request = new Request("http://localhost/api/jobs/job-123/stream");
    const response = await GET(request, {
      params: Promise.resolve({ id: "job-123" }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    expect(reader).toBeDefined();
    if (!reader) return;

    const { value, done } = await reader.read();
    const chunk = decoder.decode(value);

    expect(chunk).toContain("event: status");
    expect(chunk).toContain('"status":"completed"');
    expect(chunk).toContain('"/api/jobs/job-123/download"');

    const secondRead = await reader.read();
    expect(secondRead.done).toBe(true);
  });

  it("should complete immediately when job is failed", async () => {
    const mockJob: Job = {
      id: "job-123",
      status: "failed",
      markdown: "# Test",
      error: "Conversion failed",
      options: DEFAULT_EXPORT_OPTIONS,
      createdAt: new Date("2026-06-17T12:00:00Z"),
      updatedAt: new Date("2026-06-17T12:01:00Z"),
    };

    const { getJobById } = await import("@/lib/db/jobs");
    vi.mocked(getJobById).mockResolvedValue(mockJob);

    const request = new Request("http://localhost/api/jobs/job-123/stream");
    const response = await GET(request, {
      params: Promise.resolve({ id: "job-123" }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    expect(reader).toBeDefined();
    if (!reader) return;

    const { value } = await reader.read();
    const chunk = decoder.decode(value);

    expect(chunk).toContain("event: status");
    expect(chunk).toContain('"status":"failed"');
    expect(chunk).toContain('"error":"Conversion failed"');

    const secondRead = await reader.read();
    expect(secondRead.done).toBe(true);
  });

  it("should set up LISTEN on pg client for running job", async () => {
    const mockJob: Job = {
      id: "job-123",
      status: "running",
      markdown: "# Test",
      error: null,
      options: DEFAULT_EXPORT_OPTIONS,
      createdAt: new Date("2026-06-17T12:00:00Z"),
      updatedAt: new Date("2026-06-17T12:00:00Z"),
    };

    const { getJobById } = await import("@/lib/db/jobs");
    vi.mocked(getJobById).mockResolvedValue(mockJob);

    const request = new Request("http://localhost/api/jobs/job-123/stream");
    const response = await GET(request, {
      params: Promise.resolve({ id: "job-123" }),
    });

    const reader = response.body?.getReader();
    await reader?.read();

    expect(mockPool.connect).toHaveBeenCalled();
    expect(mockClient.query).toHaveBeenCalledWith("LISTEN job_status");
    expect(mockClient.on).toHaveBeenCalledWith("notification", expect.any(Function));

    reader?.cancel();
  });
});
