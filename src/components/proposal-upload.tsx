"use client";

import { ChangeEvent, FormEvent, useState } from "react";

interface UploadSuccess {
  filename: string;
  mimetype: string;
  wordCount: number;
  characterCount: number;
  preview: string;
}

interface UploadError {
  error: string;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

export function ProposalUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<UploadSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    setResult(null);
    setError(null);
    setFile(selected ?? null);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file) {
      setError("Choose a file before uploading");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.includes("application/json")) {
        console.error("Unexpected response content-type", contentType);
        await response.text();
        throw new Error("Upload failed. The server returned an unexpected response.");
      }

      const payload = (await response.json()) as UploadSuccess | UploadError;

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Upload failed");
      }

      setResult(payload as UploadSuccess);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown upload error");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
      <header className="flex flex-col gap-1">
        <h2 className="text-left text-xl font-semibold text-slate-900">Upload a call for proposals</h2>
        <p className="text-sm text-slate-600">
          Supported formats: PDF, Word (.docx), or plain text up to 5MB. The file remains on the server and
          is not shared with OpenRouter automatically.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label
          htmlFor="proposal-file"
          className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-6 py-8 text-center transition hover:border-blue-300 hover:bg-blue-50/50"
        >
          <span className="text-sm font-medium text-slate-700">
            {file ? file.name : "Drag a file here or browse"}
          </span>
          <span className="text-xs text-slate-500">PDF • DOCX • TXT · max 5MB</span>
          <input
            id="proposal-file"
            name="proposal-file"
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={onFileChange}
            disabled={isUploading}
          />
        </label>

        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
          disabled={isUploading}
        >
          {isUploading ? "Uploading…" : "Upload"}
        </button>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {result ? (
        <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-inner">
          <h3 className="text-base font-semibold text-slate-900">{result.filename}</h3>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {result.mimetype} · {result.wordCount.toLocaleString()} words · {result.characterCount.toLocaleString()} characters
          </p>
          <div className="h-px bg-slate-200" aria-hidden />
          <p className="text-sm leading-6 whitespace-pre-wrap text-slate-700">
            {result.preview}
            {result.preview.length < result.characterCount ? "\n\n…(truncated preview)" : ""}
          </p>
        </section>
      ) : null}
    </div>
  );
}
