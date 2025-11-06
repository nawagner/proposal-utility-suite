import Link from "next/link";
import { ProposalReviewer } from "@/components/proposal-reviewer";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-slate-50 to-slate-100 px-6 py-16 sm:px-12">
      <div className="flex w-full max-w-5xl flex-col items-center gap-10 text-center">
        <div className="flex flex-col gap-4">
          <span className="inline-flex self-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
            Proposal Utility Suite
          </span>
          <h1 className="text-balance text-4xl font-semibold text-slate-900 sm:text-5xl">
            Analyze concept outlines with AI models
          </h1>
          <p className="text-pretty text-base text-slate-600 sm:text-lg">
            Compare submitted documents against rubrics, generate synthetic data, and add tags.
          </p>
        </div>

        <div className="flex justify-center">
          <Link
            href="/synthetic"
            className="inline-flex items-center justify-center rounded-md bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500"
          >
            Generate Synthetic Proposals →
          </Link>
        </div>

        <div className="w-full max-w-4xl space-y-8">
          <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/80 p-6 text-left shadow-sm backdrop-blur">
            <header className="flex flex-col gap-1">
              <h2 className="text-2xl font-semibold text-slate-900">Manage rubrics</h2>
              <p className="text-sm text-slate-600">
                Create structured rubrics with binary criteria and weightings before running proposal reviews. Saved rubrics stay available for your next sessions.
              </p>
            </header>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">Define a name, description, and criteria set that totals 100%.</p>
              <Link
                href="/rubrics"
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
              >
                Open rubric workspace
              </Link>
            </div>
          </section>
          <ProposalReviewer />
        </div>
      </div>
    </main>
  );
}
