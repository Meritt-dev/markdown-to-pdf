import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { runMigrations } from "./migrate";

describe("db migrations", () => {
  let mockPool: Partial<Pool>;

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should run all migration DDL statements", async () => {
    await runMigrations(mockPool as Pool);

    expect(mockPool.query).toHaveBeenCalledTimes(3);

    const calls = (mockPool.query as any).mock.calls;

    expect(calls[0][0]).toContain("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    expect(calls[0][0]).toContain("CREATE TABLE IF NOT EXISTS jobs");

    expect(calls[1][0]).toContain("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS options");

    expect(calls[2][0]).toContain("CREATE OR REPLACE FUNCTION notify_job_status_change()");
    expect(calls[2][0]).toContain("CREATE TRIGGER job_status_change_trigger");
  });

  it("should be idempotent (can run multiple times)", async () => {
    await runMigrations(mockPool as Pool);
    await runMigrations(mockPool as Pool);

    expect(mockPool.query).toHaveBeenCalledTimes(6);
  });

  it("should handle database errors", async () => {
    vi.mocked(mockPool.query as any).mockRejectedValue(new Error("Database connection failed"));

    await expect(runMigrations(mockPool as Pool)).rejects.toThrow("Database connection failed");
  });

  it("should create jobs table with correct columns", async () => {
    await runMigrations(mockPool as Pool);

    const createTableCall = (mockPool.query as any).mock.calls[0][0];

    expect(createTableCall).toContain("id UUID PRIMARY KEY");
    expect(createTableCall).toContain("status TEXT NOT NULL");
    expect(createTableCall).toContain("markdown TEXT NOT NULL");
    expect(createTableCall).toContain("error TEXT");
    expect(createTableCall).toContain("created_at TIMESTAMPTZ");
    expect(createTableCall).toContain("updated_at TIMESTAMPTZ");
  });

  it("should create status check constraint", async () => {
    await runMigrations(mockPool as Pool);

    const createTableCall = (mockPool.query as any).mock.calls[0][0];

    expect(createTableCall).toContain(
      "CHECK (status IN ('pending', 'running', 'completed', 'failed'))"
    );
  });

  it("should create index on status and created_at", async () => {
    await runMigrations(mockPool as Pool);

    const createTableCall = (mockPool.query as any).mock.calls[0][0];

    expect(createTableCall).toContain("CREATE INDEX IF NOT EXISTS idx_jobs_status_created");
    expect(createTableCall).toContain("ON jobs (status, created_at)");
  });

  it("should add options column with JSONB type", async () => {
    await runMigrations(mockPool as Pool);

    const alterTableCall = (mockPool.query as any).mock.calls[1][0];

    expect(alterTableCall).toContain("options JSONB NOT NULL DEFAULT '{}'::jsonb");
  });

  it("should create notify trigger function", async () => {
    await runMigrations(mockPool as Pool);

    const triggerCall = (mockPool.query as any).mock.calls[2][0];

    expect(triggerCall).toContain("CREATE OR REPLACE FUNCTION notify_job_status_change()");
    expect(triggerCall).toContain("pg_notify('job_status', NEW.id::text)");
  });

  it("should create trigger on status updates", async () => {
    await runMigrations(mockPool as Pool);

    const triggerCall = (mockPool.query as any).mock.calls[2][0];

    expect(triggerCall).toContain("CREATE TRIGGER job_status_change_trigger");
    expect(triggerCall).toContain("AFTER UPDATE OF status ON jobs");
    expect(triggerCall).toContain("WHEN (OLD.status IS DISTINCT FROM NEW.status)");
  });

  it("should drop existing trigger before recreating", async () => {
    await runMigrations(mockPool as Pool);

    const triggerCall = (mockPool.query as any).mock.calls[2][0];

    expect(triggerCall).toContain("DROP TRIGGER IF EXISTS job_status_change_trigger ON jobs");
  });
});
