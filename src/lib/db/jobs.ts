import type { Pool } from "pg";

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface JobRecord {
  readonly id: string;
  readonly status: JobStatus;
  readonly markdown: string;
  readonly error: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function mapRow(row: {
  id: string;
  status: string;
  markdown: string;
  error: string | null;
  created_at: string;
  updated_at: string;
}): JobRecord {
  return {
    id: row.id,
    status: row.status as JobStatus,
    markdown: row.markdown,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Inserts a new conversion job with pending status.
 *
 * @param pool - Postgres pool.
 * @param markdown - Raw Markdown source.
 * @returns The new job id.
 */
export async function insertJob(pool: Pool, markdown: string): Promise<string> {
  const res = await pool.query<{ id: string }>(
    `INSERT INTO jobs (markdown) VALUES ($1) RETURNING id`,
    [markdown],
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
    `SELECT id, status, markdown, error, created_at, updated_at FROM jobs WHERE id = $1`,
    [id],
  );
  const row = res.rows[0];
  return row ? mapRow(row) : null;
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
    const res = await client.query<{ id: string; markdown: string }>(
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
      RETURNING j.id, j.markdown
      `,
    );
    await client.query("COMMIT");
    const row = res.rows[0];
    return row ? { id: row.id, markdown: row.markdown } : null;
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
