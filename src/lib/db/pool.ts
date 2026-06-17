import { Pool } from "pg";
import { runMigrations } from "@/lib/db/migrate";

let pool: Pool | null = null;
let migrated: Promise<void> | null = null;

/**
 * Returns a shared `pg` pool and runs DDL migrations once per process.
 *
 * @returns Postgres connection pool.
 * @throws Error if `DATABASE_URL` is not set.
 */
export async function getPool(): Promise<Pool> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  if (!migrated) {
    migrated = runMigrations(pool);
  }
  await migrated;
  return pool;
}
