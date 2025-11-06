"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  REVIEW_STATE_STORAGE_KEY,
  RUBRIC_SELECTION_KEY,
  ProposalReviewResult,
  StoredReviewState,
  StoredRubricSelection,
} from "@/lib/storage-keys";

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

interface RubricOption {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  criteria: {
    id: string;
    label: string;
    weight: number;
    position: number;
  }[];
}

export function ProposalReviewer() {
  const [files, setFiles] = useState<File[]>([]);
  const [submissionContext, setSubmissionContext] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ProposalReviewResult[]>([]);
  const [partialErrors, setPartialErrors] = useState<{ filename: string; message: string }[]>([]);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [lastRunFiles, setLastRunFiles] = useState<{ name: string; size: number }[]>([]);

  const [rubrics, setRubrics] = useState<RubricOption[]>([]);
  const [rubricsLoading, setRubricsLoading] = useState(true);
  const [rubricsError, setRubricsError] = useState<string | null>(null);
  const [selectedRubricId, setSelectedRubricId] = useState<string>("");
  const [pendingSelectionId, setPendingSelectionId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let desiredRubricId: string | null = null;

    const storedReviewRaw = window.localStorage.getItem(REVIEW_STATE_STORAGE_KEY);
    if (storedReviewRaw) {
      try {
        const storedReview = JSON.parse(storedReviewRaw) as StoredReviewState;
        if (storedReview?.reviews) {
          setReviews(storedReview.reviews);
          setSubmissionContext(storedReview.submissionContext ?? "");
          setLastRunAt(storedReview.lastRunAt ?? null);
          setLastRunFiles(storedReview.files ?? []);
          if (storedReview.rubricId) {
            desiredRubricId = storedReview.rubricId;
          }
        }
      } catch (storageError) {
        console.error("Failed to parse stored review state", storageError);
      }
    }

    if (!desiredRubricId) {
      const storedSelectionRaw = window.localStorage.getItem(RUBRIC_SELECTION_KEY);
      if (storedSelectionRaw) {
        try {
          const storedSelection = JSON.parse(storedSelectionRaw) as StoredRubricSelection;
          if (storedSelection?.rubricId) {
            desiredRubricId = storedSelection.rubricId;
          }
        } catch (storageError) {
          console.error("Failed to parse stored rubric selection", storageError);
        }
      }
    }

    if (desiredRubricId) {
      setPendingSelectionId(desiredRubricId);
    }
  }, []);

  const fetchRubrics = useCallback(async () => {
    setRubricsLoading(true);
    setRubricsError(null);

    try {
      const response = await fetch("/api/rubrics", {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload?.error ?? "Unable to load rubrics.";
        throw new Error(message);
      }

      const payload = (await response.json()) as { rubrics: RubricOption[] };
      setRubrics(Array.isArray(payload.rubrics) ? payload.rubrics : []);
    } catch (loadError) {
      console.error("Failed to load rubrics", loadError);
      setRubricsError(loadError instanceof Error ? loadError.message : "Unknown rubric load error");
      setRubrics([]);
    } finally {
      setRubricsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRubrics();
  }, [fetchRubrics]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleRubricUpdate = () => {
      void fetchRubrics();
    };

    window.addEventListener("proposal-suite:rubric-updated", handleRubricUpdate);

    return () => {
      window.removeEventListener("proposal-suite:rubric-updated", handleRubricUpdate);
    };
  }, [fetchRubrics]);

  useEffect(() => {
    if (rubrics.length === 0) {
      setSelectedRubricId("");
      return;
    }

    if (pendingSelectionId) {
      const found = rubrics.find((rubric) => rubric.id === pendingSelectionId);
      if (found) {
        setSelectedRubricId(found.id);
        setPendingSelectionId(null);
        return;
      }
    }

    setSelectedRubricId((current) => {
      if (current && rubrics.some((rubric) => rubric.id === current)) {
        return current;
      }
      return rubrics[0]?.id ?? "";
    });
  }, [rubrics, pendingSelectionId]);

  const selectedRubric = useMemo(
    () => rubrics.find((rubric) => rubric.id === selectedRubricId) ?? null,
    [rubrics, selectedRubricId],
  );

  const rubricSummary = useMemo(() => {
    if (!selectedRubric) {
      return null;
    }

    const updatedAt = new Date(selectedRubric.updatedAt);
    const formatted = Number.isNaN(updatedAt.getTime()) ? null : updatedAt.toLocaleString();

    return {
      label: selectedRubric.name,
      savedAt: formatted,
      criteriaCount: selectedRubric.criteria.length,
      totalWeight: selectedRubric.criteria.reduce((sum, criterion) => sum + criterion.weight, 0),
    };
  }, [selectedRubric]);

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

  const handleRubricChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedRubricId(value);
    setPendingSelectionId(null);

    if (typeof window !== "undefined") {
      if (value) {
        const toStore: StoredRubricSelection = {
          rubricId: value,
          savedAt: new Date().toISOString(),
        };
        window.localStorage.setItem(RUBRIC_SELECTION_KEY, JSON.stringify(toStore));
      } else {
        window.localStorage.removeItem(RUBRIC_SELECTION_KEY);
      }
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPartialErrors([]);

    if (!selectedRubric) {
      setError("Select a saved rubric before requesting a review.");
      return;
    }

    if (files.length === 0) {
      setError("Choose at least one proposal file to review.");
      return;
    }

    const formData = new FormData();
    formData.append("rubricId", selectedRubric.id);
    formData.append("submissionContext", submissionContext);

    files.forEach((file) => {
      formData.append("files", file);
    });

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
          rubricId: selectedRubric.id,
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
          Upload DOCX, PDF, or a ZIP containing proposals. Reviews compare each submission against your structured rubric criteria.
        </p>
        {rubricsLoading ? (
          <p className="text-xs text-slate-500">Loading saved rubrics…</p>
        ) : rubricsError ? (
          <p className="text-xs text-rose-600">{rubricsError}</p>
        ) : selectedRubric && rubricSummary ? (
          <p className="text-xs text-slate-500">
            Using {rubricSummary.label}
            {rubricSummary.savedAt ? ` (updated ${rubricSummary.savedAt})` : ""} · {rubricSummary.criteriaCount} criteria · total weight {rubricSummary.totalWeight}%.
          </p>
        ) : (
          <p className="text-xs text-amber-600">
            Create a rubric first so GPT-5 knows what to evaluate.{" "}
            <Link href="/rubrics" className="font-semibold text-blue-600 hover:text-blue-500">
              Open rubric workspace
            </Link>
            .
          </p>
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
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="font-medium">Select rubric</span>
            <select
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={selectedRubricId}
              onChange={handleRubricChange}
              disabled={rubricsLoading || rubrics.length === 0 || isReviewing}
              required
            >
              {rubrics.length === 0 ? (
                <option value="">No rubrics available</option>
              ) : (
                <>
                  <option value="" disabled>
                    Choose a rubric…
                  </option>
                  {rubrics.map((rubric) => (
                    <option key={rubric.id} value={rubric.id}>
                      {rubric.name} · {rubric.criteria.length} criteria
                    </option>
                  ))}
                </>
              )}
            </select>
          </label>
          {selectedRubric ? (
            <div className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-xs text-slate-600">
              <p className="font-semibold text-slate-700">{selectedRubric.description}</p>
              <ul className="mt-2 space-y-1">
                {selectedRubric.criteria.map((criterion, index) => (
                  <li key={criterion.id} className="flex justify-between gap-3">
                    <span>{index + 1}. {criterion.label}</span>
                    <span className="font-semibold text-slate-500">{criterion.weight}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

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
        </div>

        <div className="flex justify-between text-xs text-slate-500">
          <p>Accepted formats: PDF, DOCX, or ZIP of PDFs/DOCXs.</p>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
            disabled={isReviewing || !selectedRubric || rubrics.length === 0}
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
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-left shadow-inner"
            >
              <header className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900">
                    {review.filename}
                  </h3>
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
    </section>
  );
}
