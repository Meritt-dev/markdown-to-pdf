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

const optionsColumnDdl = `
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '{}'::jsonb;
`;

const notifyTriggerDdl = `
CREATE OR REPLACE FUNCTION notify_job_status_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('job_status', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS job_status_change_trigger ON jobs;

CREATE TRIGGER job_status_change_trigger
AFTER UPDATE OF status ON jobs
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION notify_job_status_change();
`;

/**
 * Applies idempotent schema migrations required for the job queue.
 *
 * @param pool - Postgres pool.
 * @returns Promise that resolves when migrations finish.
 */
export async function runMigrations(pool: Pool): Promise<void> {
  await pool.query(ddl);
  await pool.query(optionsColumnDdl);
  await pool.query(notifyTriggerDdl);
}
