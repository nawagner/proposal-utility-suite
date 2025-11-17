"use client";

import { useEffect, useState } from "react";

interface Batch {
  id: string;
  name: string;
  description?: string;
  count: number;
  createdAt: string;
}

interface SelectedBatch {
  id: string;
  name: string;
  count: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (batches: SelectedBatch[]) => void;
  initialSelected?: string[];
  accessToken?: string;
}

export function SyntheticBatchPicker({ isOpen, onClose, onSelect, initialSelected = [], accessToken }: Props) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelected));
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && accessToken) {
      loadBatches();
    }
  }, [isOpen, accessToken]);

  const loadBatches = async () => {
    if (!accessToken) {
      setError("Authentication required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/synthetic-proposals/batches", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load batches");
      }

      const data = await response.json();
      setBatches(data.batches ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load batches");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredBatches = batches.filter((batch) =>
    batch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    batch.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleBatch = (batchId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(batchId)) {
      newSelected.delete(batchId);
    } else {
      newSelected.add(batchId);
    }
    setSelectedIds(newSelected);
  };

  const handleSelect = () => {
    const selectedBatches = batches
      .filter((batch) => selectedIds.has(batch.id))
      .map((batch) => ({
        id: batch.id,
        name: batch.name,
        count: batch.count,
      }));
    onSelect(selectedBatches);
    onClose();
  };

  const handleCancel = () => {
    setSelectedIds(new Set(initialSelected));
    setSearchQuery("");
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Select Synthetic Batches</h2>
            <p className="text-sm text-slate-600">Choose one or more batches to review</p>
          </div>
          <button
            onClick={handleCancel}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-slate-200 px-6 py-4">
          <input
            type="text"
            placeholder="Search batches..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-slate-500">Loading batches...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-slate-500">
                {searchQuery ? "No batches found matching your search" : "No synthetic batches available"}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {filteredBatches.map((batch) => (
                <li key={batch.id}>
                  <label className="flex cursor-pointer items-start gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition hover:border-blue-300 hover:bg-blue-50/30">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(batch.id)}
                      onChange={() => toggleBatch(batch.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-200"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900">{batch.name}</p>
                        <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                          {batch.count} {batch.count === 1 ? "proposal" : "proposals"}
                        </span>
                      </div>
                      {batch.description && (
                        <p className="mt-1 text-sm text-slate-600">{batch.description}</p>
                      )}
                      <p className="mt-1 text-xs text-slate-500">
                        Created {new Date(batch.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <p className="text-sm text-slate-600">
            {selectedIds.size} {selectedIds.size === 1 ? "batch" : "batches"} selected
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSelect}
              disabled={selectedIds.size === 0}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              Select {selectedIds.size > 0 && `(${selectedIds.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
