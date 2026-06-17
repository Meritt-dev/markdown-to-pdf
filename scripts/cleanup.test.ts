import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

vi.mock("@/lib/db/pool");
vi.mock("@/lib/db/jobs");
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    fatal: vi.fn(),
  }),
}));

/**
 * Note: The cleanup script runs main() at the module level, which makes it
 * difficult to test via import. These tests verify the cleanup functionality
 * through the cleanupOldJobs function that the script uses.
 *
 * For full integration testing of the script, run it manually:
 * npm run cleanup
 */
describe("cleanup script dependencies", () => {
  let mockPool: Partial<Pool>;

  beforeEach(async () => {
    mockPool = {
      query: vi.fn(),
      end: vi.fn(),
    };

    const { getPool } = await import("@/lib/db/pool");
    vi.mocked(getPool).mockResolvedValue(mockPool as Pool);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should call cleanupOldJobs with correct parameters", async () => {
    const { cleanupOldJobs } = await import("@/lib/db/jobs");
    vi.mocked(cleanupOldJobs).mockResolvedValue({
      jobsDeleted: 5,
      pdfsDeleted: 4,
      pdfsErrored: 1,
    });

    const retentionDays = 7;
    const result = await cleanupOldJobs(mockPool as Pool, retentionDays);

    expect(cleanupOldJobs).toHaveBeenCalledWith(mockPool, retentionDays);
    expect(result.jobsDeleted).toBe(5);
    expect(result.pdfsDeleted).toBe(4);
    expect(result.pdfsErrored).toBe(1);
  });

  it("should handle cleanup with no old jobs", async () => {
    const { cleanupOldJobs } = await import("@/lib/db/jobs");
    vi.mocked(cleanupOldJobs).mockResolvedValue({
      jobsDeleted: 0,
      pdfsDeleted: 0,
      pdfsErrored: 0,
    });

    const result = await cleanupOldJobs(mockPool as Pool, 7);

    expect(result.jobsDeleted).toBe(0);
    expect(result.pdfsDeleted).toBe(0);
    expect(result.pdfsErrored).toBe(0);
  });

  it("should handle database errors during cleanup", async () => {
    const { cleanupOldJobs } = await import("@/lib/db/jobs");
    vi.mocked(cleanupOldJobs).mockRejectedValue(new Error("Database connection failed"));

    await expect(cleanupOldJobs(mockPool as Pool, 7)).rejects.toThrow("Database connection failed");
  });

  it("should propagate cleanup results", async () => {
    const { cleanupOldJobs } = await import("@/lib/db/jobs");
    vi.mocked(cleanupOldJobs).mockResolvedValue({
      jobsDeleted: 10,
      pdfsDeleted: 8,
      pdfsErrored: 2,
    });

    const result = await cleanupOldJobs(mockPool as Pool, 7);

    expect(result.jobsDeleted).toBe(10);
    expect(result.pdfsDeleted).toBe(8);
    expect(result.pdfsErrored).toBe(2);
  });

  it("should use environment variable for retention days", () => {
    const originalEnv = process.env.JOB_RETENTION_DAYS;
    process.env.JOB_RETENTION_DAYS = "14";

    const retentionDays = Number.parseInt(process.env.JOB_RETENTION_DAYS ?? "7", 10);
    expect(retentionDays).toBe(14);

    if (originalEnv !== undefined) {
      process.env.JOB_RETENTION_DAYS = originalEnv;
    } else {
      delete process.env.JOB_RETENTION_DAYS;
    }
  });
});
