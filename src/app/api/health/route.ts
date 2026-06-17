import { getPool } from "@/lib/db/pool";
import { createLogger } from "@/lib/logger";

const log = createLogger("api.health");

export const runtime = "nodejs";

interface HealthResponse {
  readonly status: "ok" | "degraded";
  readonly postgres: boolean;
  readonly gotenberg: boolean;
}

/**
 * Checks Postgres connectivity with a simple query.
 *
 * @returns True if Postgres is accessible, false otherwise.
 */
async function checkPostgres(): Promise<boolean> {
  try {
    const pool = await getPool();
    const result = await pool.query("SELECT 1 AS health");
    return result.rows[0]?.health === 1;
  } catch (error: unknown) {
    log.error({ err: error }, "postgres health check failed");
    return false;
  }
}

/**
 * Checks Gotenberg availability by fetching its base URL.
 *
 * @returns True if Gotenberg is accessible, false otherwise.
 */
async function checkGotenberg(): Promise<boolean> {
  try {
    const gotenbergUrl = process.env.GOTENBERG_URL;
    if (!gotenbergUrl) {
      log.warn("GOTENBERG_URL not configured");
      return false;
    }

    const response = await fetch(`${gotenbergUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    return response.ok;
  } catch (error: unknown) {
    log.error({ err: error }, "gotenberg health check failed");
    return false;
  }
}

/**
 * Health check endpoint to verify system dependencies.
 *
 * Returns 200 if all services are healthy, 503 if any are degraded.
 *
 * @example
 * GET /api/health
 * {
 *   "status": "ok",
 *   "postgres": true,
 *   "gotenberg": true
 * }
 */
export async function GET(): Promise<Response> {
  const [postgres, gotenberg] = await Promise.all([checkPostgres(), checkGotenberg()]);

  const status = postgres && gotenberg ? "ok" : "degraded";
  const statusCode = status === "ok" ? 200 : 503;

  const response: HealthResponse = {
    status,
    postgres,
    gotenberg,
  };

  log.info({ status, postgres, gotenberg }, "health check");

  return Response.json(response, { status: statusCode });
}
