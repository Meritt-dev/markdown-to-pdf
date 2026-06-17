import { z } from "zod";

import { insertJob } from "@/lib/db/jobs";
import { getPool } from "@/lib/db/pool";
import { createLogger } from "@/lib/logger";

const log = createLogger("api.jobs");

const createBodySchema = z.object({
  markdown: z.string().min(1).max(2_000_000),
});

export const runtime = "nodejs";

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

    const pool = await getPool();
    const id = await insertJob(pool, parsed.data.markdown);
    log.info({ jobId: id }, "job created");

    return Response.json({ id }, { status: 201 });
  } catch (error: unknown) {
    log.error({ err: error }, "POST /api/jobs failed");
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
