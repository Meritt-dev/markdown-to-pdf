import { JobConsole } from "@/components/job-console";

export default function Home(): React.ReactElement {
  return (
    <div className="flex min-h-full flex-col bg-gradient-to-b from-zinc-50 to-zinc-100 text-zinc-900 dark:from-zinc-950 dark:to-black dark:text-zinc-50">
      <header className="border-b border-zinc-200/80 bg-white/90 px-6 py-8 backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/90">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">Markdown to PDF</h1>
          <p className="max-w-lg text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Write or upload your document, export a clean PDF, and download when it’s ready.
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <JobConsole />
      </main>
    </div>
  );
}
