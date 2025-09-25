"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

type Mode = "upload" | "manual";

interface UploadSuccess {
  filename: string;
  mimetype: string;
  wordCount: number;
  characterCount: number;
  preview: string;
}

interface ManualResult {
  source: "manual";
  wordCount: number;
  characterCount: number;
  preview: string;
}

type Result = UploadSuccess | ManualResult;

export function RubricIntake() {
  const [mode, setMode] = useState<Mode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [manualText, setManualText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const manualStats = useMemo(() => {
    if (!manualText.trim()) {
      return null;
    }

    const tokens = manualText.trim().split(/\s+/).filter(Boolean);

    return {
      wordCount: tokens.length,
      characterCount: manualText.trim().length,
    };
  }, [manualText]);

  const resetState = () => {
    setResult(null);
    setError(null);
  };

  const handleModeChange = (nextMode: Mode) => {
    setMode(nextMode);
    resetState();
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    resetState();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (mode === "upload") {
      if (!file) {
        setError("Choose a rubric file before uploading");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      setIsProcessing(true);

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const contentType = response.headers.get("content-type") ?? "";

        if (!contentType.includes("application/json")) {
          await response.text();
          throw new Error("Upload failed. The server returned an unexpected response.");
        }

        const payload = (await response.json()) as UploadSuccess & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Upload failed");
        }

        setResult(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown upload error");
      } finally {
        setIsProcessing(false);
      }

      return;
    }

    const trimmed = manualText.trim();

    if (!trimmed) {
      setError("Enter rubric instructions before continuing");
      return;
    }

    setIsProcessing(true);

    try {
      const preview = trimmed.slice(0, 1200);
      const tokens = trimmed.split(/\s+/).filter(Boolean);

      setResult({
        source: "manual",
        wordCount: tokens.length,
        characterCount: trimmed.length,
        preview,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section className="flex w-full max-w-3xl flex-col gap-6 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
      <header className="flex flex-col gap-1 text-left">
        <h2 className="text-2xl font-semibold text-slate-900">Add a rubric</h2>
        <p className="text-sm text-slate-600">
          Upload a rubric document or paste the criteria manually. The rubric remains private to your workspace.
        </p>
      </header>

      <div className="flex gap-2 rounded-md bg-slate-100 p-1 text-sm font-medium text-slate-600">
        <button
          type="button"
          onClick={() => handleModeChange("upload")}
          className={`flex-1 rounded-md px-3 py-2 transition ${
            mode === "upload" ? "bg-white text-slate-900 shadow" : "hover:text-slate-900"
          }`}
        >
          Upload file
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("manual")}
          className={`flex-1 rounded-md px-3 py-2 transition ${
            mode === "manual" ? "bg-white text-slate-900 shadow" : "hover:text-slate-900"
          }`}
        >
          Enter text
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {mode === "upload" ? (
          <label
            htmlFor="rubric-file"
            className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center transition hover:border-blue-300 hover:bg-blue-50/60"
          >
            <span className="text-base font-semibold text-slate-800">
              {file ? file.name : "Drag a rubric here or browse"}
            </span>
            <span className="text-xs text-slate-500">PDF • DOCX • TXT · max 5MB</span>
            <input
              id="rubric-file"
              name="rubric-file"
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              className="hidden"
              onChange={onFileChange}
              disabled={isProcessing}
            />
          </label>
        ) : (
          <textarea
            id="rubric-text"
            name="rubric-text"
            className="min-h-[220px] w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Paste your rubric criteria or scoring guide..."
            value={manualText}
            onChange={(event) => setManualText(event.target.value)}
            disabled={isProcessing}
          />
        )}

        {mode === "manual" && manualStats ? (
          <p className="text-xs text-slate-500">
            {manualStats.wordCount.toLocaleString()} words · {manualStats.characterCount.toLocaleString()} characters
          </p>
        ) : null}

        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Accepted formats: PDF, DOCX, or plain text.
          </p>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
            disabled={isProcessing}
          >
            {isProcessing ? (mode === "upload" ? "Uploading…" : "Processing…") : "Save rubric"}
          </button>
        </div>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {result ? (
        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-left shadow-inner">
          <h3 className="text-base font-semibold text-slate-900">
            {"filename" in result ? result.filename : "Manual entry"}
          </h3>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {"mimetype" in result ? result.mimetype : "text/plain"} · {result.wordCount.toLocaleString()} words · {result.characterCount.toLocaleString()} characters
          </p>
          <div className="h-px bg-slate-200" aria-hidden />
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {result.preview}
            {result.preview.length < result.characterCount ? "\n\n…(truncated preview)" : ""}
          </p>
        </section>
      ) : null}
    </section>
  );
}
