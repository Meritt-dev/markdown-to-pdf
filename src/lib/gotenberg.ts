/**
 * Converts an HTML document to PDF bytes using a Gotenberg 8 Chromium route.
 *
 * @param html - Full HTML document (with embedded CSS recommended).
 * @returns PDF binary.
 * @throws Error when Gotenberg is unreachable or returns a non-OK response.
 *
 * @example
 * const pdf = await convertHtmlToPdf("<!DOCTYPE html><html>...</html>");
 */
export async function convertHtmlToPdf(html: string): Promise<Buffer> {
  const baseUrl = process.env.GOTENBERG_URL ?? "http://localhost:3030";
  const url = new URL("/forms/chromium/convert/html", baseUrl).toString();

  const form = new FormData();
  const blob = new Blob([html], { type: "text/html" });
  form.append("files", blob, "index.html");

  form.append("emulatedMediaType", "print");
  form.append("printBackground", "true");
  form.append("preferCssPageSize", "true");
  form.append("paperWidth", "8.27");
  form.append("paperHeight", "11.7");
  form.append("marginTop", "0");
  form.append("marginBottom", "0");
  form.append("marginLeft", "0");
  form.append("marginRight", "0");

  const response = await fetch(url, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gotenberg HTTP ${response.status}: ${detail.slice(0, 500)}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
