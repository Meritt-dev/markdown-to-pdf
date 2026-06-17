import { z } from "zod";

import { exportOptionsSchema, resolveExportOptions } from "@/lib/export-options";
import { createLogger } from "@/lib/logger";
import { renderMarkdownToHtmlDocument } from "@/lib/md/render-markdown";

const log = createLogger("api.preview");

const previewBodySchema = z.object({
  markdown: z.string().max(2_000_000),
  options: exportOptionsSchema.optional(),
});

export const runtime = "nodejs";

/**
 * Renders Markdown to a full HTML document for live preview (no job created).
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const json: unknown = await request.json();
    const parsed = previewBodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
    }

    const options = resolveExportOptions(parsed.data.options);
    const docLang = process.env.DOCUMENT_LOCALE ?? "en";
    const html = await renderMarkdownToHtmlDocument(parsed.data.markdown || " ", docLang, options);

    return Response.json({ html });
  } catch (error: unknown) {
    log.error({ err: error }, "POST /api/preview failed");
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
