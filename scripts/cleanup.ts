import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

import { createLogger } from "@/lib/logger";
import { cleanupOldJobs } from "@/lib/db/jobs";
import { getPool } from "@/lib/db/pool";

const log = createLogger("cleanup");

const JOB_RETENTION_DAYS = Number.parseInt(process.env.JOB_RETENTION_DAYS ?? "7", 10);

/**
 * Standalone cleanup script to delete old jobs and their PDF files.
 *
 * This script is designed to be run as a cron job or manually via `npm run cleanup`.
 * It removes jobs and PDFs older than JOB_RETENTION_DAYS (default: 7 days).
 *
 * @example
 * npm run cleanup
 */
async function main(): Promise<void> {
  const pool = await getPool();

  log.info({ retentionDays: JOB_RETENTION_DAYS }, "starting cleanup");

  try {
    const result = await cleanupOldJobs(pool, JOB_RETENTION_DAYS);

    log.info(
      {
        jobsDeleted: result.jobsDeleted,
        pdfsDeleted: result.pdfsDeleted,
        pdfsErrored: result.pdfsErrored,
      },
      "cleanup completed",
    );

    if (result.jobsDeleted === 0) {
      log.info("no jobs found older than retention period");
    }

    if (result.pdfsErrored > 0) {
      log.warn({ count: result.pdfsErrored }, "some PDF files could not be deleted");
    }
  } catch (error: unknown) {
    log.error({ err: error }, "cleanup failed");
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  log.fatal({ err: error }, "cleanup script crashed");
  process.exitCode = 1;
});
