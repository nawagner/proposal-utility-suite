"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { SyntheticBatchPicker } from "@/components/synthetic-batch-picker";
import {
  REVIEW_STATE_STORAGE_KEY,
  RUBRIC_STORAGE_KEY,
  StoredReviewState,
  StoredRubric,
  ProposalReviewResult,
} from "@/lib/storage-keys";

interface SelectedBatch {
  id: string;
  name: string;
  count: number;
}

const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
];

const ACCEPT_ATTRIBUTE = [
  ".pdf",
  ".docx",
  ".zip",
  ...ACCEPTED_MIME_TYPES,
].join(",");

export function ProposalReviewer() {
  const { session } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<SelectedBatch[]>([]);
  const [showBatchPicker, setShowBatchPicker] = useState(false);
  const [rubric, setRubric] = useState<StoredRubric | null>(null);
  const [submissionContext, setSubmissionContext] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ProposalReviewResult[]>([]);
  const [partialErrors, setPartialErrors] = useState<{ filename: string; message: string }[]>([]);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [lastRunFiles, setLastRunFiles] = useState<{ name: string; size: number }[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedRubricRaw = window.localStorage.getItem(RUBRIC_STORAGE_KEY);

    if (storedRubricRaw) {
      try {
        const storedRubric = JSON.parse(storedRubricRaw) as StoredRubric;
        if (storedRubric?.text) {
          setRubric(storedRubric);
        }
      } catch (storageError) {
        console.error("Failed to parse stored rubric", storageError);
      }
    }

    const storedReviewRaw = window.localStorage.getItem(REVIEW_STATE_STORAGE_KEY);

    if (storedReviewRaw) {
      try {
        const storedReview = JSON.parse(storedReviewRaw) as StoredReviewState;
        if (storedReview?.reviews) {
          setReviews(storedReview.reviews);
          setSubmissionContext(storedReview.submissionContext ?? "");
          setLastRunAt(storedReview.lastRunAt ?? null);
          setLastRunFiles(storedReview.files ?? []);
        }
      } catch (storageError) {
        console.error("Failed to parse stored review state", storageError);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleRubricUpdated = (event: Event) => {
      const detail = (event as CustomEvent<StoredRubric | undefined>).detail;
      if (detail?.text) {
        setRubric(detail);
      } else {
        const storedRubricRaw = window.localStorage.getItem(RUBRIC_STORAGE_KEY);
        if (storedRubricRaw) {
          try {
            const storedRubric = JSON.parse(storedRubricRaw) as StoredRubric;
            if (storedRubric?.text) {
              setRubric(storedRubric);
            }
          } catch (storageError) {
            console.error("Failed to parse stored rubric", storageError);
          }
        }
      }
    };

    window.addEventListener("proposal-suite:rubric-updated", handleRubricUpdated as EventListener);

    return () => {
      window.removeEventListener("proposal-suite:rubric-updated", handleRubricUpdated as EventListener);
    };
  }, []);

  const rubricSummary = useMemo(() => {
    if (!rubric) {
      return null;
    }

    const label = rubric.source === "upload"
      ? rubric.filename ?? "Uploaded rubric"
      : "Manual rubric";

    const savedAt = rubric.savedAt ? new Date(rubric.savedAt) : null;
    const formatted = savedAt ? savedAt.toLocaleString() : null;

    return {
      label,
      savedAt: formatted,
      wordCount: rubric.wordCount.toLocaleString(),
    };
  }, [rubric]);

  const lastRunSummary = useMemo(() => {
    if (!lastRunAt) {
      return null;
    }

    const timestamp = new Date(lastRunAt);
    const formatted = Number.isNaN(timestamp.getTime()) ? null : timestamp.toLocaleString();

    return {
      timestamp: formatted,
      files: lastRunFiles,
    };
  }, [lastRunAt, lastRunFiles]);

  const onFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles) {
      return;
    }

    const nextFiles = Array.from(selectedFiles);
    setFiles(nextFiles);
    setError(null);
  };

  const clearFiles = () => {
    setFiles([]);
    setError(null);
  };

  const handleBatchSelect = (batches: SelectedBatch[]) => {
    setSelectedBatches(batches);
    setError(null);
  };

  const removeBatch = (batchId: string) => {
    setSelectedBatches((prev) => prev.filter((batch) => batch.id !== batchId));
  };

  const totalProposalCount = useMemo(() => {
    return selectedBatches.reduce((sum, batch) => sum + batch.count, 0);
  }, [selectedBatches]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPartialErrors([]);

    if (!rubric) {
      setError("Add a rubric before requesting a review.");
      return;
    }

    if (files.length === 0 && selectedBatches.length === 0) {
      setError("Choose at least one proposal file or synthetic batch to review.");
      return;
    }

    const formData = new FormData();
    formData.append("rubricText", rubric.text);
    formData.append("submissionContext", submissionContext);

    // Add uploaded files
    files.forEach((file) => {
      formData.append("files", file);
    });

    // Add synthetic batch IDs
    if (selectedBatches.length > 0) {
      formData.append("syntheticBatchIds", JSON.stringify(selectedBatches.map((b) => b.id)));
    }

    setIsReviewing(true);

    try {
      const response = await fetch("/api/review", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        const message = payload?.error ?? "Review request failed";
        throw new Error(message);
      }

      const nextReviews = Array.isArray(payload?.reviews) ? (payload.reviews as ProposalReviewResult[]) : [];
      const nextErrors = Array.isArray(payload?.errors) ? (payload.errors as { filename: string; message: string }[]) : [];
      const timestamp = new Date().toISOString();

      setReviews(nextReviews);
      setPartialErrors(nextErrors);
      setLastRunAt(timestamp);
      setLastRunFiles(files.map((file) => ({ name: file.name, size: file.size })));

      if (typeof window !== "undefined") {
        const toStore: StoredReviewState = {
          submissionContext,
          reviews: nextReviews,
          lastRunAt: timestamp,
          files: files.map((file) => ({ name: file.name, size: file.size })),
        };
        window.localStorage.setItem(REVIEW_STATE_STORAGE_KEY, JSON.stringify(toStore));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown review error");
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <section className="flex w-full max-w-3xl flex-col gap-6 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
      <header className="flex flex-col gap-1 text-left">
        <h2 className="text-2xl font-semibold text-slate-900">Review proposals</h2>
        <p className="text-sm text-slate-600">
          Upload DOCX, PDF, or a ZIP containing proposals. Reviews compare each submission against your binary rubric criteria.
        </p>
        {rubricSummary ? (
          <p className="text-xs text-slate-500">
            Using {rubricSummary.label}
            {rubricSummary.savedAt ? ` (saved ${rubricSummary.savedAt})` : ""} · {rubricSummary.wordCount} words.
          </p>
        ) : (
          <p className="text-xs text-amber-600">Add a rubric first so GPT-5 knows what to evaluate.</p>
        )}
        {lastRunSummary?.timestamp ? (
          <p className="text-xs text-slate-400">
            Last review ran {lastRunSummary.timestamp}
            {lastRunSummary.files.length > 0
              ? ` for ${lastRunSummary.files.length} file${lastRunSummary.files.length === 1 ? "" : "s"}`
              : ""}
            .
          </p>
        ) : null}
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-2 text-left">
          <span className="text-sm font-medium text-slate-700">Submission context (optional)</span>
          <textarea
            value={submissionContext}
            onChange={(event) => setSubmissionContext(event.target.value)}
            rows={4}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Share any context for the reviewer (program goals, stakeholder notes, etc.)."
            disabled={isReviewing}
          />
        </label>

        <div className="flex flex-col gap-3">
          <label
            htmlFor="proposal-files"
            className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center transition hover:border-blue-300 hover:bg-blue-50/60"
          >
            <span className="text-base font-semibold text-slate-800">
              {files.length > 0
                ? `${files.length} file${files.length === 1 ? "" : "s"} selected`
                : "Drag proposals here or browse"}
            </span>
            <span className="text-xs text-slate-500">PDF • DOCX • ZIP · max 12 proposals per run</span>
            <input
              id="proposal-files"
              name="proposal-files"
              type="file"
              multiple
              accept={ACCEPT_ATTRIBUTE}
              className="hidden"
              onChange={onFileSelect}
              disabled={isReviewing}
            />
          </label>
          {files.length > 0 ? (
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              {files.map((file) => (
                <span key={file.name} className="rounded-full bg-slate-100 px-3 py-1">
                  {file.name}
                </span>
              ))}
              <button
                type="button"
                className="text-xs font-semibold text-blue-600 hover:text-blue-500"
                onClick={clearFiles}
                disabled={isReviewing}
              >
                Clear list
              </button>
            </div>
          ) : null}

          {/* Synthetic batch selection */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Or select from synthetic proposals</span>
              <button
                type="button"
                onClick={() => setShowBatchPicker(true)}
                disabled={isReviewing || !session}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Select Batches
              </button>
            </div>
            {!session && (
              <p className="text-xs text-amber-600">Sign in to access synthetic proposals</p>
            )}
            {selectedBatches.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-purple-200 bg-purple-50/50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-purple-900">
                    {selectedBatches.length} batch{selectedBatches.length === 1 ? "" : "es"} selected
                    {totalProposalCount > 0 && ` (${totalProposalCount} proposals)`}
                  </p>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {selectedBatches.map((batch) => (
                    <li
                      key={batch.id}
                      className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-slate-900">
                        {batch.name} <span className="text-slate-500">({batch.count})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeBatch(batch.id)}
                        disabled={isReviewing}
                        className="text-rose-600 transition hover:text-rose-500"
                        aria-label={`Remove ${batch.name}`}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between text-xs text-slate-500">
          <p>Accepted formats: PDF, DOCX, or ZIP of PDFs/DOCXs.</p>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
            disabled={isReviewing}
          >
            {isReviewing ? "Reviewing…" : "Review proposals"}
          </button>
        </div>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {partialErrors.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800">
          <p className="font-semibold">Some reviews failed:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {partialErrors.map((item) => (
              <li key={`${item.filename}-${item.message}`}>{item.filename}: {item.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {reviews.length > 0 ? (
        <div className="flex flex-col gap-4">
          {reviews.map((review) => (
            <article
              key={review.id}
              className={`flex flex-col gap-3 rounded-xl border px-5 py-4 text-left shadow-inner ${
                review.isSynthetic
                  ? "border-purple-200 bg-purple-50/30"
                  : "border-slate-200 bg-white"
              }`}
            >
              <header className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      {review.filename}
                    </h3>
                    {review.isSynthetic && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        Synthetic
                      </span>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                      review.overallVerdict === "pass"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {review.overallVerdict === "pass" ? "Pass" : "Fail"}
                  </span>
                </div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {review.wordCount.toLocaleString()} words evaluated
                </p>
              </header>

              {review.isSynthetic && review.characteristics && Object.keys(review.characteristics).length > 0 && (
                <details className="group rounded-lg border border-purple-200 bg-white/80 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-purple-900 select-none">
                    <span className="inline-flex items-center gap-2">
                      <svg className="h-4 w-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Generation Characteristics
                    </span>
                  </summary>
                  <div className="mt-2 space-y-1 pl-6">
                    {Object.entries(review.characteristics).map(([key, value]) => (
                      <div key={key} className="flex items-start gap-2 text-xs">
                        <span className="font-medium capitalize text-slate-700">{key.replace(/_/g, " ")}:</span>
                        <span className="text-slate-600">{value}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <p className="text-sm leading-6 text-slate-700">{review.overallFeedback}</p>

              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold text-slate-800">Criteria</h4>
                <ul className="flex flex-col gap-2">
                  {review.criteria.map((criterion) => (
                    <li key={`${review.id}-${criterion.name}`} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-900">{criterion.name}</span>
                        <span
                          className={`text-xs font-semibold uppercase ${
                            criterion.result === "pass" ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {criterion.result === "pass" ? "Pass" : "Fail"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{criterion.explanation}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3">
                  <h4 className="text-sm font-semibold text-emerald-800">Notable strengths</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-emerald-900">
                    {review.notableStrengths.length > 0 ? (
                      review.notableStrengths.map((item, index) => (
                        <li key={`${review.id}-strength-${index}`}>{item}</li>
                      ))
                    ) : (
                      <li>No specific strengths highlighted.</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-lg border border-rose-100 bg-rose-50/70 p-3">
                  <h4 className="text-sm font-semibold text-rose-800">Recommended improvements</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-900">
                    {review.recommendedImprovements.length > 0 ? (
                      review.recommendedImprovements.map((item, index) => (
                        <li key={`${review.id}-improvement-${index}`}>{item}</li>
                      ))
                    ) : (
                      <li>No immediate improvements identified.</li>
                    )}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {/* Synthetic Batch Picker Modal */}
      <SyntheticBatchPicker
        isOpen={showBatchPicker}
        onClose={() => setShowBatchPicker(false)}
        onSelect={handleBatchSelect}
        initialSelected={selectedBatches.map((b) => b.id)}
        accessToken={session?.access_token}
      />
    </section>
  );
}
