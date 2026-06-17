import fs from "node:fs";

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

import { createLogger } from "@/lib/logger";
import type { ExportOptions } from "@/lib/export-options";
import { claimNextPendingJob, markJobCompleted, markJobFailed, recoverStaleJobs } from "@/lib/db/jobs";
import { getPool } from "@/lib/db/pool";
import { convertHtmlToPdf } from "@/lib/gotenberg";
import { renderMarkdownToHtmlDocument } from "@/lib/md/render-markdown";
import { ensurePdfStorageDir, getPdfPathForJob } from "@/lib/paths";

const log = createLogger("worker");

const STALE_JOB_MINUTES = Number.parseInt(process.env.STALE_JOB_MINUTES ?? "10", 10);
const RECOVERY_INTERVAL_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function processOneJob(
  jobId: string,
  markdown: string,
  options: ExportOptions,
  pool: Awaited<ReturnType<typeof getPool>>,
) {
  ensurePdfStorageDir();
  const docLang = process.env.DOCUMENT_LOCALE ?? "en";
  const result = await renderMarkdownToHtmlDocument(markdown, docLang, options);
  const pdf = await convertHtmlToPdf(result.html, options, {
    title: result.metadata.title,
    author: result.metadata.author,
  });
  const outPath = getPdfPathForJob(jobId);
  await fs.promises.writeFile(outPath, pdf);
  await markJobCompleted(pool, jobId);
  log.info({ jobId, bytes: pdf.length, title: result.metadata.title }, "job completed");
}

async function main(): Promise<void> {
  const pool = await getPool();
  log.info({ staleMinutes: STALE_JOB_MINUTES }, "worker started; polling for jobs");

  try {
    const recovered = await recoverStaleJobs(pool, STALE_JOB_MINUTES);
    if (recovered > 0) {
      log.info({ count: recovered }, "recovered stale jobs on startup");
    }
  } catch (error: unknown) {
    log.error({ err: error }, "failed to recover stale jobs on startup");
  }

  let lastRecoveryTime = Date.now();

  for (;;) {
    try {
      if (Date.now() - lastRecoveryTime >= RECOVERY_INTERVAL_MS) {
        try {
          const recovered = await recoverStaleJobs(pool, STALE_JOB_MINUTES);
          if (recovered > 0) {
            log.info({ count: recovered }, "recovered stale jobs");
          }
          lastRecoveryTime = Date.now();
        } catch (error: unknown) {
          log.error({ err: error }, "periodic stale job recovery failed");
        }
      }

      const claimed = await claimNextPendingJob(pool);
      if (!claimed) {
        await sleep(750);
        continue;
      }

      log.info({ jobId: claimed.id }, "claimed job");
      try {
        await processOneJob(claimed.id, claimed.markdown, claimed.options, pool);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        log.error({ jobId: claimed.id, err: error }, "job failed");
        await markJobFailed(pool, claimed.id, message);
      }
    } catch (error: unknown) {
      log.error({ err: error }, "worker loop error");
      await sleep(2000);
    }
  }
}

main().catch((error: unknown) => {
  log.fatal({ err: error }, "worker crashed");
  process.exitCode = 1;
});
