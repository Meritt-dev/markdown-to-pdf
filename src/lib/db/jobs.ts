import type { Pool } from "pg";
import fs from "node:fs";

import type { ExportOptions } from "@/lib/export-options";
import { parseExportOptions, serializeExportOptions } from "@/lib/export-options";
import { getPdfPathForJob } from "@/lib/paths";

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface JobRecord {
  readonly id: string;
  readonly status: JobStatus;
  readonly markdown: string;
  readonly error: string | null;
  readonly options: ExportOptions;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface JobSummary {
  readonly id: string;
  readonly status: JobStatus;
  readonly error: string | null;
  readonly options: ExportOptions;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly downloadUrl: string | null;
}

function mapRow(row: {
  id: string;
  status: string;
  markdown: string;
  error: string | null;
  options?: unknown;
  created_at: string;
  updated_at: string;
}): JobRecord {
  return {
    id: row.id,
    status: row.status as JobStatus,
    markdown: row.markdown,
    error: row.error,
    options: parseExportOptions(row.options),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSummaryRow(row: {
  id: string;
  status: string;
  error: string | null;
  options?: unknown;
  created_at: string;
  updated_at: string;
}): JobSummary {
  const status = row.status as JobStatus;
  return {
    id: row.id,
    status,
    error: row.error,
    options: parseExportOptions(row.options),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    downloadUrl: status === "completed" ? `/api/jobs/${row.id}/download` : null,
  };
}

/**
 * Inserts a new conversion job with pending status.
 *
 * @param pool - Postgres pool.
 * @param markdown - Raw Markdown source.
 * @param options - Export options for PDF rendering.
 * @returns The new job id.
 */
export async function insertJob(pool: Pool, markdown: string, options: ExportOptions): Promise<string> {
  const res = await pool.query<{ id: string }>(
    `INSERT INTO jobs (markdown, options) VALUES ($1, $2::jsonb) RETURNING id`,
    [markdown, serializeExportOptions(options)],
  );
  const id = res.rows[0]?.id;
  if (!id) {
    throw new Error("Failed to create job");
  }
  return id;
}

/**
 * Loads a job by id.
 *
 * @param pool - Postgres pool.
 * @param id - Job UUID.
 * @returns The job, or `null` if missing.
 */
export async function getJobById(pool: Pool, id: string): Promise<JobRecord | null> {
  const res = await pool.query(
    `SELECT id, status, markdown, error, options, created_at, updated_at FROM jobs WHERE id = $1`,
    [id],
  );
  const row = res.rows[0];
  return row ? mapRow(row) : null;
}

/**
 * Lists recent jobs for the history panel.
 *
 * @param pool - Postgres pool.
 * @param limit - Maximum number of jobs to return.
 * @returns Recent jobs ordered by creation time (newest first).
 */
export async function listRecentJobs(pool: Pool, limit: number): Promise<readonly JobSummary[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const res = await pool.query(
    `SELECT id, status, error, options, created_at, updated_at
     FROM jobs
     ORDER BY created_at DESC
     LIMIT $1`,
    [safeLimit],
  );
  return res.rows.map((row) => mapSummaryRow(row));
}

/**
 * Marks a job as failed with an error message.
 *
 * @param pool - Postgres pool.
 * @param id - Job id.
 * @param message - Human-readable error (truncated server-side).
 */
export async function markJobFailed(pool: Pool, id: string, message: string): Promise<void> {
  const truncated = message.length > 4000 ? `${message.slice(0, 4000)}…` : message;
  await pool.query(
    `UPDATE jobs SET status = 'failed', error = $2, updated_at = NOW() WHERE id = $1`,
    [id, truncated],
  );
}

/**
 * Marks a job completed after the PDF was written to disk.
 *
 * @param pool - Postgres pool.
 * @param id - Job id.
 */
export async function markJobCompleted(pool: Pool, id: string): Promise<void> {
  await pool.query(
    `UPDATE jobs SET status = 'completed', error = NULL, updated_at = NOW() WHERE id = $1`,
    [id],
  );
}

export interface ClaimedJob {
  readonly id: string;
  readonly markdown: string;
  readonly options: ExportOptions;
}

/**
 * Atomically claims the next pending job using `SKIP LOCKED`.
 *
 * @param pool - Postgres pool.
 * @returns Claimed job payload, or `null` when queue is empty.
 */
export async function claimNextPendingJob(pool: Pool): Promise<ClaimedJob | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const res = await client.query<{ id: string; markdown: string; options: unknown }>(
      `
      WITH next_job AS (
        SELECT id
        FROM jobs
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE jobs j
      SET status = 'running', updated_at = NOW()
      FROM next_job nj
      WHERE j.id = nj.id
      RETURNING j.id, j.markdown, j.options
      `,
    );
    await client.query("COMMIT");
    const row = res.rows[0];
    return row
      ? {
          id: row.id,
          markdown: row.markdown,
          options: parseExportOptions(row.options),
        }
      : null;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Resets stale jobs stuck in "running" status back to "failed".
 *
 * A job is considered stale if it has been running for longer than the specified threshold.
 * This function is designed to be called periodically by the worker to recover from
 * crashed or hung jobs that never completed.
 *
 * @param pool - Postgres pool.
 * @param staleMinutes - Number of minutes before a running job is considered stale.
 * @returns The count of jobs recovered.
 * @example
 * const recovered = await recoverStaleJobs(pool, 10);
 * log.info({ count: recovered }, "recovered stale jobs");
 */
export async function recoverStaleJobs(pool: Pool, staleMinutes: number): Promise<number> {
  const result = await pool.query(
    `
    UPDATE jobs
    SET status = 'failed',
        error = 'Job timed out after being stuck in running state',
        updated_at = NOW()
    WHERE status = 'running'
      AND updated_at < NOW() - INTERVAL '1 minute' * $1
    RETURNING id
    `,
    [staleMinutes],
  );
  return result.rowCount ?? 0;
}

/**
 * Deletes jobs and their associated PDF files older than the specified number of days.
 *
 * This function removes completed and failed jobs from the database and attempts to
 * delete their corresponding PDF files from disk. It should be called periodically
 * to prevent unbounded growth of storage and database rows.
 *
 * @param pool - Postgres pool.
 * @param retentionDays - Number of days to retain jobs and PDFs.
 * @returns Object containing count of deleted jobs and PDF files.
 * @example
 * const result = await cleanupOldJobs(pool, 7);
 * log.info({ jobs: result.jobsDeleted, pdfs: result.pdfsDeleted }, "cleanup completed");
 */
export async function cleanupOldJobs(
  pool: Pool,
  retentionDays: number,
): Promise<{ jobsDeleted: number; pdfsDeleted: number; pdfsErrored: number }> {
  const res = await pool.query<{ id: string }>(
    `
    DELETE FROM jobs
    WHERE created_at < NOW() - INTERVAL '1 day' * $1
    RETURNING id
    `,
    [retentionDays],
  );

  const deletedIds = res.rows.map((row) => row.id);
  let pdfsDeleted = 0;
  let pdfsErrored = 0;

  for (const id of deletedIds) {
    try {
      const pdfPath = getPdfPathForJob(id);
      await fs.promises.unlink(pdfPath);
      pdfsDeleted++;
    } catch (error: unknown) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        continue;
      }
      pdfsErrored++;
    }
  }

  return {
    jobsDeleted: deletedIds.length,
    pdfsDeleted,
    pdfsErrored,
  };
}
