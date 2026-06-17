import type { PoolClient } from "pg";

import { getJobById } from "@/lib/db/jobs";
import { getPool } from "@/lib/db/pool";
import { createLogger } from "@/lib/logger";

const log = createLogger("api.jobs.stream");

export const runtime = "nodejs";

interface StreamParams {
  readonly params: Promise<{
    readonly id: string;
  }>;
}

/**
 * Server-Sent Events endpoint for real-time job status updates.
 *
 * Streams job status changes using Postgres LISTEN/NOTIFY until the job
 * reaches a terminal state (completed or failed).
 *
 * @example
 * const eventSource = new EventSource('/api/jobs/[id]/stream');
 * eventSource.addEventListener('status', (e) => {
 *   const data = JSON.parse(e.data);
 *   console.log(data.status);
 * });
 */
export async function GET(_request: Request, { params }: StreamParams): Promise<Response> {
  const { id: jobId } = await params;

  const pool = await getPool();

  const job = await getJobById(pool, jobId);
  if (!job) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }

  const initialStatus = job.status;
  const initialError = job.error;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function sendEvent(eventData: { status: string; error: string | null; downloadUrl: string | null }): void {
        const data = JSON.stringify(eventData);
        controller.enqueue(encoder.encode(`event: status\ndata: ${data}\n\n`));
      }

      function sendInitial(): void {
        sendEvent({
          status: initialStatus,
          error: initialError,
          downloadUrl: initialStatus === "completed" ? `/api/jobs/${jobId}/download` : null,
        });
      }

      let client: PoolClient | null = null;
      let timeoutId: NodeJS.Timeout | null = null;

      try {
        sendInitial();

        if (initialStatus === "completed" || initialStatus === "failed") {
          controller.close();
          return;
        }

        client = await pool.connect();
        await client.query("LISTEN job_status");

        const handleNotification = async (): Promise<void> => {
          try {
            const updated = await getJobById(pool, jobId);
            if (!updated) {
              controller.close();
              return;
            }

            sendEvent({
              status: updated.status,
              error: updated.error,
              downloadUrl: updated.status === "completed" ? `/api/jobs/${jobId}/download` : null,
            });

            if (updated.status === "completed" || updated.status === "failed") {
              controller.close();
            }
          } catch (error: unknown) {
            log.error({ err: error, jobId }, "failed to fetch updated job status");
            controller.close();
          }
        };

        client.on("notification", (msg) => {
          if (msg.channel === "job_status" && msg.payload === jobId) {
            void handleNotification();
          }
        });

        timeoutId = setTimeout(() => {
          log.info({ jobId }, "SSE connection timeout reached");
          controller.close();
        }, 300_000);
      } catch (error: unknown) {
        log.error({ err: error, jobId }, "SSE stream error");
        controller.error(error);
      }

      return async (): Promise<void> => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
        if (client !== null) {
          try {
            await client.query("UNLISTEN job_status");
            client.release();
          } catch (error: unknown) {
            log.error({ err: error }, "failed to cleanup SSE client");
          }
        }
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
