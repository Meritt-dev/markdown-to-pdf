import { z } from "zod";

import { insertJob, listRecentJobs } from "@/lib/db/jobs";
import { getPool } from "@/lib/db/pool";
import { exportOptionsSchema, resolveExportOptions } from "@/lib/export-options";
import { createLogger } from "@/lib/logger";

const log = createLogger("api.jobs");

const createBodySchema = z.object({
  markdown: z.string().min(1).max(2_000_000),
  options: exportOptionsSchema.optional(),
});

export const runtime = "nodejs";

/**
 * Lists recent conversion jobs for the history panel.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 20;
    const pool = await getPool();
    const jobs = await listRecentJobs(pool, Number.isFinite(limit) ? limit : 20);
    return Response.json({ jobs });
  } catch (error: unknown) {
    log.error({ err: error }, "GET /api/jobs failed");
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * Creates a new Markdown → PDF conversion job.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const json: unknown = await request.json();
    const parsed = createBodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
    }

    const options = resolveExportOptions(parsed.data.options);
    const pool = await getPool();
    const id = await insertJob(pool, parsed.data.markdown, options);
    log.info({ jobId: id, options }, "job created");

    return Response.json({ id }, { status: 201 });
  } catch (error: unknown) {
    log.error({ err: error }, "POST /api/jobs failed");
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
