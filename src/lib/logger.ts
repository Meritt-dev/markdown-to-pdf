import pino from "pino";

/**
 * Creates a named pino logger for server-side code (API routes, worker).
 *
 * @param name - Logical subsystem name (e.g. `api`, `worker`).
 * @returns Configured logger instance.
 *
 * @example
 * const log = createLogger("worker");
 * log.info({ jobId }, "claimed job");
 */
export function createLogger(name: string): pino.Logger {
  return pino({
    name,
    level: process.env.LOG_LEVEL ?? "info",
  });
}
