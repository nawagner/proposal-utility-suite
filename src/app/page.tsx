import { ChatPlayground } from "@/components/chat-playground";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-slate-50 to-slate-100 px-6 py-16 sm:px-12">
      <div className="flex w-full max-w-5xl flex-col items-center gap-10 text-center">
        <div className="flex flex-col gap-4">
          <span className="inline-flex self-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
            Proposal Utility Suite
          </span>
          <h1 className="text-balance text-4xl font-semibold text-slate-900 sm:text-5xl">
            Kickstart proposal drafts with OpenRouter powered AI
          </h1>
          <p className="text-pretty text-base text-slate-600 sm:text-lg">
            Connect your Vercel deployment to OpenRouter and iterate on proposal outlines, executive
            summaries, and polished copy using a built-in serverless function.
          </p>
        </div>

        <ChatPlayground />
      </div>
    </main>
  );
}
