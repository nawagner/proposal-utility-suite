"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  RUBRIC_STORAGE_KEY,
  RUBRIC_SELECTION_KEY,
  type StoredRubric,
  type StoredRubricSelection,
} from "@/lib/storage-keys";

interface RubricCriterionDto {
  id: string;
  label: string;
  weight: number;
  position: number;
}

interface RubricDto {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  criteria: RubricCriterionDto[];
}

interface FormCriterion {
  id: string;
  label: string;
  weight: number;
}

interface FormState {
  name: string;
  description: string;
  criteria: FormCriterion[];
}

const emptyCriterion = (): FormCriterion => ({
  id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2),
  label: "",
  weight: 0,
});

const defaultFormState: FormState = {
  name: "",
  description: "",
  criteria: [emptyCriterion()],
};

function normalizeNumber(value: string | number): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeWeightTotal(criteria: FormCriterion[]): number {
  return criteria.reduce((sum, criterion) => sum + (Number.isFinite(criterion.weight) ? criterion.weight : 0), 0);
}

export function RubricManager() {
  const [rubrics, setRubrics] = useState<RubricDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  const [formState, setFormState] = useState<FormState>(defaultFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [legacyRubricPreview, setLegacyRubricPreview] = useState<string | null>(null);

  useEffect(() => {
    void loadRubrics();
    if (typeof window !== "undefined") {
      const storedLegacy = window.localStorage.getItem(RUBRIC_STORAGE_KEY);
      if (storedLegacy) {
        try {
          const parsed = JSON.parse(storedLegacy) as StoredRubric;
          if (parsed?.text) {
            setLegacyRubricPreview(parsed.text.slice(0, 400));
            setFormState((previous) => ({
              ...previous,
              description: previous.description || parsed.text.trim(),
            }));
          }
        } catch (error) {
          console.warn("Failed to read legacy rubric from localStorage", error);
        }
      }
    }
  }, []);

  const weightTotal = useMemo(() => Math.round(computeWeightTotal(formState.criteria) * 100) / 100, [formState.criteria]);
  const weightIsBalanced = weightTotal === 100;

  async function loadRubrics() {
    setIsLoading(true);
    setLoadingError(null);

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

      const payload = (await response.json()) as { rubrics: RubricDto[] };
      setRubrics(Array.isArray(payload.rubrics) ? payload.rubrics : []);
    } catch (error) {
      console.error("Failed to load rubrics", error);
      setLoadingError(error instanceof Error ? error.message : "Unknown rubric load error");
    } finally {
      setIsLoading(false);
    }
  }

  function updateCriterion(id: string, updates: Partial<FormCriterion>) {
    setFormState((previous) => ({
      ...previous,
      criteria: previous.criteria.map((criterion) =>
        criterion.id === id ? { ...criterion, ...updates, weight: normalizeNumber(updates.weight ?? criterion.weight) } : criterion,
      ),
    }));
  }

  function removeCriterion(id: string) {
    setFormState((previous) => {
      const nextCriteria = previous.criteria.filter((criterion) => criterion.id !== id);
      return {
        ...previous,
        criteria: nextCriteria.length > 0 ? nextCriteria : [emptyCriterion()],
      };
    });
  }

  function addCriterion() {
    setFormState((previous) => ({
      ...previous,
      criteria: [...previous.criteria, emptyCriterion()],
    }));
  }

  function resetForm() {
    setFormState(defaultFormState);
  }

  function validateForm(state: FormState): string | null {
    const name = state.name.trim();
    const description = state.description.trim();
    if (!name) {
      return "Provide a name for this rubric.";
    }
    if (!description) {
      return "Add a short description to explain the rubric context.";
    }

    const normalizedCriteria = state.criteria.map((criterion) => ({
      id: criterion.id,
      label: criterion.label.trim(),
      weight: Number.isFinite(criterion.weight) ? Math.round(criterion.weight) : 0,
    }));

    if (normalizedCriteria.length === 0) {
      return "Add at least one criterion.";
    }

    for (const criterion of normalizedCriteria) {
      if (!criterion.label) {
        return "Each criterion needs a label.";
      }
      if (criterion.weight <= 0) {
        return "Criterion weights must be positive integers.";
      }
      if (!Number.isInteger(criterion.weight)) {
        return "Criterion weights must be whole numbers.";
      }
    }

    const total = normalizedCriteria.reduce((sum, item) => sum + item.weight, 0);
    if (total !== 100) {
      return "Criterion weights must sum to 100.";
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const validationError = validateForm(formState);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: formState.name.trim(),
        description: formState.description.trim(),
        criteria: formState.criteria.map((criterion, index) => ({
          label: criterion.label.trim(),
          weight: Math.round(criterion.weight),
          position: index,
        })),
      };

      const response = await fetch("/api/rubrics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message = data?.error ?? "Unable to save rubric.";
        throw new Error(message);
      }

      const created = (data?.rubric ?? null) as RubricDto | null;
      if (created) {
        setRubrics((previous) => {
          const next = [created, ...previous.filter((rubric) => rubric.id !== created.id)];
          return next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        });
      } else {
        void loadRubrics();
      }

      setFormSuccess("Rubric saved. You can now select it when reviewing proposals.");
      resetForm();

      if (typeof window !== "undefined") {
        const selection: StoredRubricSelection = {
          rubricId: created?.id ?? "",
          savedAt: new Date().toISOString(),
        };
        if (selection.rubricId) {
          window.localStorage.setItem(RUBRIC_SELECTION_KEY, JSON.stringify(selection));
        }
        window.dispatchEvent(new CustomEvent("proposal-suite:rubric-updated"));
      }
    } catch (error) {
      console.error("Failed to save rubric", error);
      setFormError(error instanceof Error ? error.message : "Unknown rubric save error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-slate-50 to-slate-100 px-6 py-16 sm:px-12">
      <div className="flex w-full max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-3 text-center sm:text-left">
          <h1 className="text-4xl font-semibold text-slate-900">Rubric workspace</h1>
          <p className="text-base text-slate-600 sm:text-lg">
            Define reusable, binary rubrics with weighted criteria. Saved rubrics stay available for proposal reviews.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-start">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600"
            >
              ← Back to home
            </Link>
          </div>
        </header>

        {legacyRubricPreview ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-amber-900">Legacy rubric detected</h2>
            <p className="mt-2 text-sm text-amber-800">
              We found rubric text saved from the previous workflow. The description field has been pre-filled to help you recreate it with structured criteria.
            </p>
            <pre className="mt-3 max-h-40 overflow-y-auto rounded-md bg-white/70 px-4 py-3 text-xs text-amber-900 shadow-inner">
              {legacyRubricPreview}
              {legacyRubricPreview.length >= 400 ? "… (truncated)" : ""}
            </pre>
          </section>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
          <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
            <header className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold text-slate-900">Saved rubrics</h2>
              <p className="text-sm text-slate-600">
                Newly created rubrics appear here. Pick one inside the reviewer to evaluate proposals.
              </p>
            </header>

            {isLoading ? (
              <p className="text-sm text-slate-500">Loading rubrics…</p>
            ) : loadingError ? (
              <p className="text-sm text-red-600">{loadingError}</p>
            ) : rubrics.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-500">
                No rubrics yet. Add one using the builder on the right.
              </div>
            ) : (
              <ul className="flex flex-col gap-4">
                {rubrics.map((rubric) => (
                  <li key={rubric.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{rubric.name}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(rubric.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-slate-500">
                        {rubric.criteria.length} {rubric.criteria.length === 1 ? "criterion" : "criteria"}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">{rubric.description}</p>
                    <ul className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-600">
                      {rubric.criteria.map((criterion, index) => (
                        <li key={criterion.id} className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-700">
                            {index + 1}. {criterion.label}
                          </span>
                          <span className="font-semibold text-slate-500">{criterion.weight}%</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
            <header className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold text-slate-900">Build a new rubric</h2>
              <p className="text-sm text-slate-600">
                Criteria should represent binary pass/fail checks. Make sure the combined weight adds up to 100.
              </p>
            </header>

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                <span className="font-medium">Rubric name</span>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(event) => setFormState((previous) => ({ ...previous, name: event.target.value }))}
                  placeholder="STEM Grant Evaluation"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-slate-700">
                <span className="font-medium">Description</span>
                <textarea
                  value={formState.description}
                  onChange={(event) => setFormState((previous) => ({ ...previous, description: event.target.value }))}
                  placeholder="Describe the programs, goals, or compliance requirements this rubric captures."
                  rows={4}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={isSubmitting}
                  required
                />
              </label>

              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">Criteria</p>
                  <button
                    type="button"
                    onClick={addCriterion}
                    className="inline-flex items-center justify-center rounded-md border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-600 shadow-sm transition hover:bg-blue-50"
                    disabled={isSubmitting}
                  >
                    Add criterion
                  </button>
                </div>
                <ul className="flex flex-col gap-3">
                  {formState.criteria.map((criterion, index) => (
                    <li key={criterion.id} className="flex flex-col gap-2 rounded-lg border border-white bg-white/60 px-3 py-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Criterion {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCriterion(criterion.id)}
                          className="text-xs font-semibold text-rose-600 transition hover:text-rose-500"
                          disabled={isSubmitting || formState.criteria.length === 1}
                        >
                          Remove
                        </button>
                      </div>
                      <label className="flex flex-col gap-1 text-sm text-slate-700">
                        <span className="font-medium">Label</span>
                        <input
                          type="text"
                          value={criterion.label}
                          onChange={(event) => updateCriterion(criterion.id, { label: event.target.value })}
                          placeholder="Proposes evidence-backed solution"
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          disabled={isSubmitting}
                          required
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm text-slate-700">
                        <span className="font-medium">Weight (%)</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={criterion.weight}
                          onChange={(event) => updateCriterion(criterion.id, { weight: Number.parseInt(event.target.value, 10) || 0 })}
                          className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          disabled={isSubmitting}
                          required
                        />
                      </label>
                    </li>
                  ))}
                </ul>
                <p className={`text-xs font-semibold ${weightIsBalanced ? "text-emerald-600" : "text-amber-600"}`}>
                  Total weight: {weightTotal}% {weightIsBalanced ? "(balanced)" : "(must total 100)"}
                </p>
              </div>

              {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
              {formSuccess ? <p className="text-sm text-emerald-600">{formSuccess}</p> : null}

              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving…" : "Save rubric"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
