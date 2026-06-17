import { getJobById } from "@/lib/db/jobs";
import { getPool } from "@/lib/db/pool";
import { createLogger } from "@/lib/logger";

const log = createLogger("api.job");

export const runtime = "nodejs";

interface RouteParams {
  readonly params: Promise<{ id: string }>;
}

/**
 * Returns job metadata and a relative download URL when completed.
 */
export async function GET(_request: Request, { params }: RouteParams): Promise<Response> {
  try {
    const { id } = await params;
    const pool = await getPool();
    const job = await getJobById(pool, id);

    if (!job) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({
      id: job.id,
      status: job.status,
      error: job.error,
      options: job.options,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      downloadUrl: job.status === "completed" ? `/api/jobs/${job.id}/download` : null,
    });
  } catch (error: unknown) {
    log.error({ err: error }, "GET /api/jobs/[id] failed");
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
