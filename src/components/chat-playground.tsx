"use client";

import { FormEvent, useState } from "react";
import type { ChatMessage } from "@/lib/openrouter";

interface ChatResponse {
  message: ChatMessage | null;
  error?: string;
}

const systemPrompt: ChatMessage = {
  role: "system",
  content:
    "You are an AI assistant that helps draft proposal content, brainstorm outlines, and polish language.",
};

export function ChatPlayground() {
  const [messages, setMessages] = useState<ChatMessage[]>([systemPrompt]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();

    if (!trimmed) {
      return;
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: trimmed,
    };

    const previousMessages = messages;
    const optimisticMessages = [...messages, userMessage];
    const requestMessages = optimisticMessages;

    setMessages(optimisticMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: requestMessages,
        }),
      });

      const payload = (await response.json()) as ChatResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Request failed");
      }

      if (payload.message) {
        setMessages([...optimisticMessages, payload.message]);
      }
    } catch (err) {
      setMessages(previousMessages);
      setInput(trimmed);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl">
      <div className="rounded-lg border border-slate-200 bg-white/40 shadow-sm">
        <div className="flex flex-col gap-4 p-6 max-h-[420px] overflow-y-auto">
          {messages
            .filter((message) => message.role !== "system")
            .map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={
                  message.role === "assistant"
                    ? "self-start rounded-2xl bg-slate-100 px-4 py-3"
                    : "self-end rounded-2xl bg-blue-500 px-4 py-3 text-white"
                }
              >
                <p className="text-sm leading-6 whitespace-pre-wrap">{message.content}</p>
              </div>
            ))}
          {messages.filter((message) => message.role !== "system").length === 0 ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Start the conversation by asking for an outline, rewrite, or idea for your proposal.
            </div>
          ) : null}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white/60 p-4 shadow-sm"
      >
        <label htmlFor="prompt" className="text-sm font-medium text-slate-700">
          Ask something
        </label>
        <textarea
          id="prompt"
          name="prompt"
          className="h-28 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          placeholder="E.g. Draft an executive summary for a compliance proposal..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={isLoading}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            The request runs through your serverless function at `/api/chat`.
          </p>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
            disabled={isLoading}
          >
            {isLoading ? "Sending…" : "Send"}
          </button>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </div>
  );
}
