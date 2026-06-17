import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool, PoolClient, QueryResult } from "pg";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  cleanupOldJobs,
  claimNextPendingJob,
  getJobById,
  insertJob,
  listRecentJobs,
  markJobCompleted,
  markJobFailed,
  recoverStaleJobs,
  type JobRecord,
  type JobSummary,
} from "./jobs";
import { DEFAULT_EXPORT_OPTIONS, type ExportOptions } from "../export-options";

describe("jobs", () => {
  let mockPool: Partial<Pool>;
  let tempDir: string;

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
      connect: vi.fn(),
    };
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "jobs-test-"));
    process.env.PDF_STORAGE_PATH = tempDir;
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("insertJob", () => {
    it("should insert a new job and return its id", async () => {
      const jobId = "123e4567-e89b-12d3-a456-426614174000";
      const mockResult: QueryResult<{ id: string }> = {
        rows: [{ id: jobId }],
        command: "INSERT",
        rowCount: 1,
        oid: 0,
        fields: [],
      };

      (mockPool.query as any).mockResolvedValue(mockResult);

      const markdown = "# Test";
      const result = await insertJob(mockPool as Pool, markdown, DEFAULT_EXPORT_OPTIONS);

      expect(result).toBe(jobId);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO jobs"),
        expect.arrayContaining([markdown, expect.any(String)])
      );
    });

    it("should serialize export options as JSONB", async () => {
      const jobId = "test-id";
      const mockResult: QueryResult<{ id: string }> = {
        rows: [{ id: jobId }],
        command: "INSERT",
        rowCount: 1,
        oid: 0,
        fields: [],
      };

      (mockPool.query as any).mockResolvedValue(mockResult);

      const options: ExportOptions = {
        theme: "minimal",
        paperSize: "letter",
        marginPreset: "wide",
        showPageNumbers: true,
      };

      await insertJob(mockPool as Pool, "# Test", options);

      const call = (mockPool.query as any).mock.calls[0];
      const serializedOptions = call[1][1];
      expect(JSON.parse(serializedOptions)).toEqual(options);
    });

    it("should throw error when insert fails", async () => {
      const mockResult: QueryResult<{ id: string }> = {
        rows: [],
        command: "INSERT",
        rowCount: 0,
        oid: 0,
        fields: [],
      };

      (mockPool.query as any).mockResolvedValue(mockResult);

      await expect(insertJob(mockPool as Pool, "# Test", DEFAULT_EXPORT_OPTIONS)).rejects.toThrow(
        "Failed to create job"
      );
    });
  });

  describe("getJobById", () => {
    it("should return job record when found", async () => {
      const mockRow = {
        id: "test-id",
        status: "completed",
        markdown: "# Test",
        error: null,
        options: JSON.stringify(DEFAULT_EXPORT_OPTIONS),
        created_at: "2026-06-17T12:00:00Z",
        updated_at: "2026-06-17T12:01:00Z",
      };

      const mockResult: QueryResult = {
        rows: [mockRow],
        command: "SELECT",
        rowCount: 1,
        oid: 0,
        fields: [],
      };

      (mockPool.query as any).mockResolvedValue(mockResult);

      const result = await getJobById(mockPool as Pool, "test-id");

      expect(result).toEqual({
        id: "test-id",
        status: "completed",
        markdown: "# Test",
        error: null,
        options: DEFAULT_EXPORT_OPTIONS,
        createdAt: "2026-06-17T12:00:00Z",
        updatedAt: "2026-06-17T12:01:00Z",
      });
    });

    it("should return null when job not found", async () => {
      const mockResult: QueryResult = {
        rows: [],
        command: "SELECT",
        rowCount: 0,
        oid: 0,
        fields: [],
      };

      (mockPool.query as any).mockResolvedValue(mockResult);

      const result = await getJobById(mockPool as Pool, "nonexistent");

      expect(result).toBeNull();
    });

    it("should parse export options from database", async () => {
      const options: ExportOptions = {
        theme: "docs",
        paperSize: "letter",
        marginPreset: "narrow",
        showPageNumbers: true,
      };

      const mockRow = {
        id: "test-id",
        status: "pending",
        markdown: "# Test",
        error: null,
        options: JSON.stringify(options),
        created_at: "2026-06-17T12:00:00Z",
        updated_at: "2026-06-17T12:00:00Z",
      };

      const mockResult: QueryResult = {
        rows: [mockRow],
        command: "SELECT",
        rowCount: 1,
        oid: 0,
        fields: [],
      };

      (mockPool.query as any).mockResolvedValue(mockResult);

      const result = await getJobById(mockPool as Pool, "test-id");

      expect(result?.options).toEqual(options);
    });
  });

  describe("listRecentJobs", () => {
    it("should return list of job summaries", async () => {
      const mockRows = [
        {
          id: "job-1",
          status: "completed",
          error: null,
          options: JSON.stringify(DEFAULT_EXPORT_OPTIONS),
          created_at: "2026-06-17T12:00:00Z",
          updated_at: "2026-06-17T12:01:00Z",
        },
        {
          id: "job-2",
          status: "failed",
          error: "Error message",
          options: JSON.stringify(DEFAULT_EXPORT_OPTIONS),
          created_at: "2026-06-17T11:00:00Z",
          updated_at: "2026-06-17T11:01:00Z",
        },
      ];

      const mockResult: QueryResult = {
        rows: mockRows,
        command: "SELECT",
        rowCount: 2,
        oid: 0,
        fields: [],
      };

      (mockPool.query as any).mockResolvedValue(mockResult);

      const result = await listRecentJobs(mockPool as Pool, 10);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("job-1");
      expect(result[0].status).toBe("completed");
      expect(result[0].downloadUrl).toBe("/api/jobs/job-1/download");
      expect(result[1].id).toBe("job-2");
      expect(result[1].status).toBe("failed");
      expect(result[1].downloadUrl).toBeNull();
    });

    it("should clamp limit to valid range", async () => {
      const mockResult: QueryResult = {
        rows: [],
        command: "SELECT",
        rowCount: 0,
        oid: 0,
        fields: [],
      };

      (mockPool.query as any).mockResolvedValue(mockResult);

      await listRecentJobs(mockPool as Pool, 100);

      const call = (mockPool.query as any).mock.calls[0];
      expect(call[1][0]).toBe(50); // max limit

      await listRecentJobs(mockPool as Pool, 0);

      const call2 = (mockPool.query as any).mock.calls[1];
      expect(call2[1][0]).toBe(1); // min limit
    });

    it("should include download URL only for completed jobs", async () => {
      const mockRows = [
        {
          id: "completed-job",
          status: "completed",
          error: null,
          options: JSON.stringify(DEFAULT_EXPORT_OPTIONS),
          created_at: "2026-06-17T12:00:00Z",
          updated_at: "2026-06-17T12:01:00Z",
        },
        {
          id: "pending-job",
          status: "pending",
          error: null,
          options: JSON.stringify(DEFAULT_EXPORT_OPTIONS),
          created_at: "2026-06-17T12:00:00Z",
          updated_at: "2026-06-17T12:00:00Z",
        },
      ];

      const mockResult: QueryResult = {
        rows: mockRows,
        command: "SELECT",
        rowCount: 2,
        oid: 0,
        fields: [],
      };

      (mockPool.query as any).mockResolvedValue(mockResult);

      const result = await listRecentJobs(mockPool as Pool, 10);

      expect(result[0].downloadUrl).toBe("/api/jobs/completed-job/download");
      expect(result[1].downloadUrl).toBeNull();
    });
  });

  describe("markJobFailed", () => {
    it("should update job status to failed with error message", async () => {
      const mockResult: QueryResult = {
        rows: [],
        command: "UPDATE",
        rowCount: 1,
        oid: 0,
        fields: [],
      };

      (mockPool.query as any).mockResolvedValue(mockResult);

      await markJobFailed(mockPool as Pool, "test-id", "Error occurred");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE jobs"),
        ["test-id", "Error occurred"]
      );
    });

    it("should truncate long error messages", async () => {
      const mockResult: QueryResult = {
        rows: [],
        command: "UPDATE",
        rowCount: 1,
        oid: 0,
        fields: [],
      };

      (mockPool.query as any).mockResolvedValue(mockResult);

      const longError = "x".repeat(5000);
      await markJobFailed(mockPool as Pool, "test-id", longError);

      const call = (mockPool.query as any).mock.calls[0];
      const errorArg = call[1][1];
      expect(errorArg.length).toBeLessThanOrEqual(4001); // 4000 + "…"
      expect(errorArg).toContain("…");
    });
  });

  describe("markJobCompleted", () => {
    it("should update job status to completed", async () => {
      const mockResult: QueryResult = {
        rows: [],
        command: "UPDATE",
        rowCount: 1,
        oid: 0,
        fields: [],
      };

      (mockPool.query as any).mockResolvedValue(mockResult);

      await markJobCompleted(mockPool as Pool, "test-id");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE jobs"),
        ["test-id"]
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'completed'"),
        expect.any(Array)
      );
    });
  });

  describe("claimNextPendingJob", () => {
    it("should claim next pending job atomically", async () => {
      const mockClient: Partial<PoolClient> = {
        query: vi.fn(),
        release: vi.fn(),
      };

      const jobRow = {
        id: "pending-job",
        markdown: "# Test",
        options: JSON.stringify(DEFAULT_EXPORT_OPTIONS),
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [], command: "BEGIN" })
        .mockResolvedValueOnce({ rows: [jobRow], command: "UPDATE" })
        .mockResolvedValueOnce({ rows: [], command: "COMMIT" });

      (mockPool.connect as any).mockResolvedValue(mockClient);

      const result = await claimNextPendingJob(mockPool as Pool);

      expect(result).toEqual({
        id: "pending-job",
        markdown: "# Test",
        options: DEFAULT_EXPORT_OPTIONS,
      });
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining("SKIP LOCKED"));
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should return null when no pending jobs", async () => {
      const mockClient: Partial<PoolClient> = {
        query: vi.fn(),
        release: vi.fn(),
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [], command: "BEGIN" })
        .mockResolvedValueOnce({ rows: [], command: "UPDATE" })
        .mockResolvedValueOnce({ rows: [], command: "COMMIT" });

      (mockPool.connect as any).mockResolvedValue(mockClient);

      const result = await claimNextPendingJob(mockPool as Pool);

      expect(result).toBeNull();
    });

    it("should rollback on error", async () => {
      const mockClient: Partial<PoolClient> = {
        query: vi.fn(),
        release: vi.fn(),
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [], command: "BEGIN" })
        .mockRejectedValueOnce(new Error("Database error"));

      (mockPool.connect as any).mockResolvedValue(mockClient);

      await expect(claimNextPendingJob(mockPool as Pool)).rejects.toThrow("Database error");
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("recoverStaleJobs", () => {
    it("should mark stale running jobs as failed", async () => {
      const mockResult: QueryResult<{ id: string }> = {
        rows: [{ id: "stale-1" }, { id: "stale-2" }],
        command: "UPDATE",
        rowCount: 2,
        oid: 0,
        fields: [],
      };

      (mockPool.query as any).mockResolvedValue(mockResult);

      const count = await recoverStaleJobs(mockPool as Pool, 10);

      expect(count).toBe(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE jobs"),
        [10]
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'running'"),
        expect.any(Array)
      );
    });

    it("should return 0 when no stale jobs", async () => {
      const mockResult: QueryResult<{ id: string }> = {
        rows: [],
        command: "UPDATE",
        rowCount: 0,
        oid: 0,
        fields: [],
      };

      (mockPool.query as any).mockResolvedValue(mockResult);

      const count = await recoverStaleJobs(mockPool as Pool, 10);

      expect(count).toBe(0);
    });

    it("should handle null rowCount", async () => {
      const mockResult: QueryResult<{ id: string }> = {
        rows: [],
        command: "UPDATE",
        rowCount: null,
        oid: 0,
        fields: [],
      };

      (mockPool.query as any).mockResolvedValue(mockResult);

      const count = await recoverStaleJobs(mockPool as Pool, 10);

      expect(count).toBe(0);
    });
  });

  describe("cleanupOldJobs", () => {
    it("should delete old jobs and their PDF files", async () => {
      const jobId1 = "550e8400-e29b-41d4-a716-446655440000";
      const jobId2 = "550e8400-e29b-41d4-a716-446655440001";

      // Create test PDF files
      const pdf1Path = path.join(tempDir, `${jobId1}.pdf`);
      const pdf2Path = path.join(tempDir, `${jobId2}.pdf`);
      fs.writeFileSync(pdf1Path, "fake-pdf-1");
      fs.writeFileSync(pdf2Path, "fake-pdf-2");

      const mockResult: QueryResult<{ id: string }> = {
        rows: [{ id: jobId1 }, { id: jobId2 }],
        command: "DELETE",
        rowCount: 2,
        oid: 0,
        fields: [],
      };

      (mockPool.query as any).mockResolvedValue(mockResult);

      const result = await cleanupOldJobs(mockPool as Pool, 7);

      expect(result.jobsDeleted).toBe(2);
      expect(result.pdfsDeleted).toBe(2);
      expect(result.pdfsErrored).toBe(0);
      expect(fs.existsSync(pdf1Path)).toBe(false);
      expect(fs.existsSync(pdf2Path)).toBe(false);
    });

    it("should handle missing PDF files gracefully", async () => {
      const jobId = "550e8400-e29b-41d4-a716-446655440000";

      const mockResult: QueryResult<{ id: string }> = {
        rows: [{ id: jobId }],
        command: "DELETE",
        rowCount: 1,
        oid: 0,
        fields: [],
      };

      (mockPool.query as any).mockResolvedValue(mockResult);

      const result = await cleanupOldJobs(mockPool as Pool, 7);

      expect(result.jobsDeleted).toBe(1);
      expect(result.pdfsDeleted).toBe(0);
      expect(result.pdfsErrored).toBe(0);
    });

    it("should track PDF deletion errors", async () => {
      const jobId = "550e8400-e29b-41d4-a716-446655440000";
      const pdfPath = path.join(tempDir, `${jobId}.pdf`);
      
      // Create a directory instead of file to cause error
      fs.mkdirSync(pdfPath);

      const mockResult: QueryResult<{ id: string }> = {
        rows: [{ id: jobId }],
        command: "DELETE",
        rowCount: 1,
        oid: 0,
        fields: [],
      };

      (mockPool.query as any).mockResolvedValue(mockResult);

      const result = await cleanupOldJobs(mockPool as Pool, 7);

      expect(result.jobsDeleted).toBe(1);
      expect(result.pdfsDeleted).toBe(0);
      expect(result.pdfsErrored).toBe(1);
    });

    it("should return zeros when no jobs to delete", async () => {
      const mockResult: QueryResult<{ id: string }> = {
        rows: [],
        command: "DELETE",
        rowCount: 0,
        oid: 0,
        fields: [],
      };

      (mockPool.query as any).mockResolvedValue(mockResult);

      const result = await cleanupOldJobs(mockPool as Pool, 7);

      expect(result.jobsDeleted).toBe(0);
      expect(result.pdfsDeleted).toBe(0);
      expect(result.pdfsErrored).toBe(0);
    });
  });
});
