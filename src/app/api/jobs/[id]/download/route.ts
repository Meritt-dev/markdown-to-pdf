import fs from "node:fs/promises";

import { getJobById } from "@/lib/db/jobs";
import { getPool } from "@/lib/db/pool";
import { createLogger } from "@/lib/logger";
import { getPdfPathForJob } from "@/lib/paths";

const log = createLogger("api.job.download");

export const runtime = "nodejs";

interface RouteParams {
  readonly params: Promise<{ id: string }>;
}

/**
 * Streams the completed PDF for a job.
 */
export async function GET(_request: Request, { params }: RouteParams): Promise<Response> {
  try {
    const { id } = await params;
    const pool = await getPool();
    const job = await getJobById(pool, id);

    if (!job) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (job.status !== "completed") {
      return Response.json({ error: "Not ready" }, { status: 409 });
    }

    const filePath = getPdfPathForJob(id);
    try {
      const buffer = await fs.readFile(filePath);
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="document-${id}.pdf"`,
        },
      });
    } catch {
      log.error({ jobId: id }, "PDF missing on disk");
      return Response.json({ error: "File missing" }, { status: 500 });
    }
  } catch (error: unknown) {
    log.error({ err: error }, "GET /api/jobs/[id]/download failed");
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
