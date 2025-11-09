"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import {
  RUBRIC_SELECTION_KEY,
  type StoredRubricSelection,
} from "@/lib/storage-keys";

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

export function RubricSelector() {
  const { session } = useAuth();
  const [rubrics, setRubrics] = useState<RubricOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRubricId, setSelectedRubricId] = useState<string>("");

  const fetchRubrics = useCallback(async () => {
    if (!session?.access_token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/rubrics", {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
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
    } catch (err) {
      console.error("Failed to load rubrics", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setRubrics([]);
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void fetchRubrics();
  }, [fetchRubrics]);

  useEffect(() => {
    // Load saved selection from localStorage
    if (typeof window !== "undefined") {
      const storedSelectionRaw = window.localStorage.getItem(RUBRIC_SELECTION_KEY);
      if (storedSelectionRaw) {
        try {
          const storedSelection = JSON.parse(storedSelectionRaw) as StoredRubricSelection;
          if (storedSelection?.rubricId) {
            setSelectedRubricId(storedSelection.rubricId);
          }
        } catch (err) {
          console.error("Failed to parse stored rubric selection", err);
        }
      }
    }
  }, []);

  useEffect(() => {
    // Listen for rubric updates from other components
    const handleRubricUpdate = () => {
      void fetchRubrics();
    };

    window.addEventListener("proposal-suite:rubric-updated", handleRubricUpdate);

    return () => {
      window.removeEventListener("proposal-suite:rubric-updated", handleRubricUpdate);
    };
  }, [fetchRubrics]);

  const handleRubricChange = (rubricId: string) => {
    setSelectedRubricId(rubricId);

    // Save selection to localStorage
    if (typeof window !== "undefined") {
      const selection: StoredRubricSelection = {
        rubricId,
        savedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(RUBRIC_SELECTION_KEY, JSON.stringify(selection));
      // Notify other components that rubric selection changed
      window.dispatchEvent(new CustomEvent("proposal-suite:rubric-updated"));
    }
  };

  const selectedRubric = rubrics.find((r) => r.id === selectedRubricId);

  if (!session) {
    return (
      <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
        <header className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-slate-900">Select a rubric</h2>
          <p className="text-sm text-slate-600">
            Choose which rubric to use for reviewing proposals.
          </p>
        </header>
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-center">
          <p className="text-sm text-amber-800 mb-3">
            You need to sign in to use rubrics.
          </p>
          <Link
            href="/auth/sign-in"
            className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700"
          >
            Sign In
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-slate-900">Select a rubric</h2>
        <p className="text-sm text-slate-600">
          Choose which rubric to use for reviewing proposals below.
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading rubrics...</p>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      ) : rubrics.length === 0 ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-center">
          <p className="text-sm text-blue-800 mb-3">
            No rubrics found. Create one to get started.
          </p>
          <Link
            href="/rubrics"
            className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700"
          >
            Create Rubric
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <label htmlFor="rubric-select" className="text-sm font-medium text-slate-700">
              Active rubric
            </label>
            <select
              id="rubric-select"
              value={selectedRubricId}
              onChange={(e) => handleRubricChange(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">Select a rubric...</option>
              {rubrics.map((rubric) => (
                <option key={rubric.id} value={rubric.id}>
                  {rubric.name} ({rubric.criteria.length} criteria)
                </option>
              ))}
            </select>
          </div>

          {selectedRubric && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                {selectedRubric.name}
              </h3>
              <p className="text-sm text-slate-600 mb-3">
                {selectedRubric.description}
              </p>
              <ul className="flex flex-col gap-1 text-xs text-slate-600">
                {selectedRubric.criteria
                  .sort((a, b) => a.position - b.position)
                  .map((criterion, index) => (
                    <li key={criterion.id} className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-700">
                        {index + 1}. {criterion.label}
                      </span>
                      <span className="font-semibold text-slate-500">{criterion.weight}%</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="text-center">
            <Link
              href="/rubrics"
              className="inline-block text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Manage rubrics →
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
