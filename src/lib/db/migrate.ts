import type { Pool } from "pg";

const ddl = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  markdown TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs (status, created_at);
`;

/**
 * Applies idempotent schema migrations required for the job queue.
 *
 * @param pool - Postgres pool.
 * @returns Promise that resolves when migrations finish.
 */
export async function runMigrations(pool: Pool): Promise<void> {
  await pool.query(ddl);
}
