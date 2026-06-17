import fs from "node:fs";
import path from "node:path";

/**
 * Resolves the directory used to store generated PDF files.
 *
 * @returns Absolute path to the PDF storage root.
 */
export function getPdfStorageRoot(): string {
  const cwd = /* turbopackIgnore: true */ process.cwd();
  const raw = process.env.PDF_STORAGE_PATH ?? path.join(cwd, "data", "pdfs");
  return path.isAbsolute(raw) ? raw : path.resolve(cwd, raw);
}

/**
 * Ensures the PDF storage directory exists.
 */
export function ensurePdfStorageDir(): void {
  const root = getPdfStorageRoot();
  fs.mkdirSync(root, { recursive: true });
}

/**
 * Returns the absolute filesystem path for a job's PDF file.
 *
 * @param jobId - Job identifier (UUID).
 * @returns Absolute path to `{jobId}.pdf` under the storage root.
 */
export function getPdfPathForJob(jobId: string): string {
  const safe = jobId.replace(/[^a-f0-9-]/gi, "");
  if (safe !== jobId) {
    throw new Error("Invalid job id");
  }
  return path.join(getPdfStorageRoot(), `${safe}.pdf`);
}
