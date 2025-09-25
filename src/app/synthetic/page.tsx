import Link from "next/link";
import { SyntheticProposalGenerator } from "@/components/synthetic-proposal-generator";

export default function SyntheticPage() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-slate-50 to-slate-100 px-6 py-16 sm:px-12">
      <div className="flex w-full max-w-5xl flex-col items-center gap-10 text-center">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-slate-600 hover:text-slate-900 underline"
            >
              ← Back to Home
            </Link>
            <span className="inline-flex rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-green-700">
              Synthetic Data Generation
            </span>
          </div>
          <h1 className="text-balance text-4xl font-semibold text-slate-900 sm:text-5xl">
            Generate Synthetic Proposals
          </h1>
          <p className="text-pretty text-base text-slate-600 sm:text-lg">
            Create varied synthetic proposal data by defining characteristic tuples and sampling combinations.
          </p>
        </div>

        <SyntheticProposalGenerator />
      </div>
    </main>
  );
}