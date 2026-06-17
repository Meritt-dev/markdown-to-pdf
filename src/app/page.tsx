import { JobConsole } from "@/components/job-console";

const STEPS = [
  { step: "1", label: "Write", detail: "Paste or upload Markdown" },
  { step: "2", label: "Preview", detail: "Check layout & options" },
  { step: "3", label: "Export", detail: "Download print-ready PDF" },
] as const;

export default function Home(): React.ReactElement {
  return (
    <div className="bg-app-pattern flex min-h-dvh flex-col text-foreground">
      <header className="border-b border-border-subtle bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-muted px-3 py-1 text-xs font-medium text-text-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground" aria-hidden />
                Self-hosted · GFM · Print-ready
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Markdown to PDF
              </h1>
              <p className="mt-2 text-base leading-relaxed text-text-secondary">
                Write or upload your document, preview the layout, tune export options, and download a polished PDF.
              </p>
            </div>
          </div>

          <ol className="grid gap-3 sm:grid-cols-3" aria-label="How it works">
            {STEPS.map((item) => (
              <li
                key={item.step}
                className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-muted/60 px-4 py-3"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground text-sm font-bold text-background">
                  {item.step}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="text-xs text-text-tertiary">{item.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
        <JobConsole />
      </main>

      <footer className="mt-auto border-t border-border-subtle bg-surface/50">
        <div className="mx-auto flex w-full max-w-screen-2xl flex-col items-center justify-between gap-3 px-4 py-6 text-center text-sm text-text-secondary sm:flex-row sm:px-6 sm:text-left lg:px-8">
          <p>
            A product of{" "}
            <a
              href="https://github.com/Meritt-dev"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline-offset-4 transition-colors hover:underline"
            >
              Meritt Dev
            </a>
            . Self-hosted Markdown to PDF conversion.
          </p>
          <a
            href="https://github.com/Meritt-dev/markdown-to-pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-text-tertiary underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            View source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
