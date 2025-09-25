import { ChatPlayground } from "@/components/chat-playground";
import { ProposalUpload } from "@/components/proposal-upload";

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

        <div className="grid w-full gap-8 md:grid-cols-2">
          <ProposalUpload />
          <ChatPlayground />
        </div>
      </div>
    </main>
  );
}
