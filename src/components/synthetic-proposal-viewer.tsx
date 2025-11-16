"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { exportProposalsToCSV, downloadCSV } from "@/lib/csv-export";

interface SyntheticBatch {
  id: string;
  name: string;
  description?: string;
  count: number;
  createdAt: string;
  proposals?: SyntheticProposal[];
}

interface SyntheticProposal {
  id: string;
  batchId: string;
  characteristics: Record<string, string>;
  content: string;
  createdAt: string;
}

export function SyntheticProposalViewer() {
  const { session } = useAuth();
  const [batches, setBatches] = useState<SyntheticBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<SyntheticBatch | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    if (session) {
      loadBatches();
    }
  }, [session]);

  const loadBatches = async () => {
    if (!session?.access_token) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/synthetic-proposals/batches", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
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

  const loadBatchDetails = async (batchId: string) => {
    if (!session?.access_token) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/synthetic-proposals/batches/${batchId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load batch details");
      }

      const data = await response.json();
      setSelectedBatch(data.batch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load batch details");
    } finally {
      setIsLoading(false);
    }
  };

  const updateBatchName = async (batchId: string, newName: string) => {
    if (!session?.access_token || !newName.trim()) return;

    try {
      const response = await fetch(`/api/synthetic-proposals/batches/${batchId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: newName }),
      });

      if (!response.ok) {
        throw new Error("Failed to update batch name");
      }

      // Update local state
      setBatches(
        batches.map((b) => (b.id === batchId ? { ...b, name: newName } : b))
      );

      if (selectedBatch?.id === batchId) {
        setSelectedBatch({ ...selectedBatch, name: newName });
      }

      setEditingBatchId(null);
      setEditName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update batch name");
    }
  };

  const deleteBatch = async (batchId: string) => {
    if (!session?.access_token) return;
    if (!confirm("Are you sure you want to delete this batch? This cannot be undone.")) return;

    try {
      const response = await fetch(`/api/synthetic-proposals/batches/${batchId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete batch");
      }

      // Update local state
      setBatches(batches.filter((b) => b.id !== batchId));

      if (selectedBatch?.id === batchId) {
        setSelectedBatch(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete batch");
    }
  };

  const downloadBatchCSV = () => {
    if (!selectedBatch?.proposals) return;

    const filename = `${selectedBatch.name.replace(/[^a-z0-9]/gi, "_")}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    const csvContent = exportProposalsToCSV(selectedBatch.proposals);
    downloadCSV(csvContent, filename);
  };

  const sendToReviewer = () => {
    if (!selectedBatch?.proposals) return;

    // Store proposals in localStorage for the reviewer to pick up
    const reviewData = {
      source: "synthetic",
      batchId: selectedBatch.id,
      batchName: selectedBatch.name,
      proposals: selectedBatch.proposals.map((p) => ({
        filename: `${p.id}.txt`,
        content: p.content,
        characteristics: p.characteristics,
      })),
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem("proposal-suite-synthetic-for-review-v1", JSON.stringify(reviewData));

    // Navigate to the reviewer (assuming it's on the home page)
    window.location.href = "/#reviewer";
  };

  if (!session) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white/60 p-6 shadow-sm">
        <p className="text-sm text-slate-600">
          Please sign in to view your saved synthetic proposal batches.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Saved Batches</h2>
        <button
          type="button"
          onClick={loadBatches}
          disabled={isLoading}
          className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:bg-blue-300"
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Batch list */}
        <div className="md:col-span-1 space-y-2">
          {isLoading && batches.length === 0 ? (
            <p className="text-sm text-slate-500">Loading batches...</p>
          ) : batches.length === 0 ? (
            <p className="text-sm text-slate-500">No saved batches yet.</p>
          ) : (
            batches.map((batch) => (
              <div
                key={batch.id}
                className={`rounded-lg border p-4 cursor-pointer transition ${
                  selectedBatch?.id === batch.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
                onClick={() => loadBatchDetails(batch.id)}
              >
                {editingBatchId === batch.id ? (
                  <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="block w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateBatchName(batch.id, editName)}
                        className="text-xs text-blue-600 hover:text-blue-500"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingBatchId(null);
                          setEditName("");
                        }}
                        className="text-xs text-slate-600 hover:text-slate-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-slate-900 text-sm break-words">
                        {batch.name}
                      </h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingBatchId(batch.id);
                          setEditName(batch.name);
                        }}
                        className="text-slate-400 hover:text-slate-600 flex-shrink-0"
                        title="Edit name"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {batch.count} proposals • {new Date(batch.createdAt).toLocaleDateString()}
                    </p>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Batch details */}
        <div className="md:col-span-2">
          {selectedBatch ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {selectedBatch.name}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {selectedBatch.count} proposals • Created{" "}
                    {new Date(selectedBatch.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => deleteBatch(selectedBatch.id)}
                  className="text-red-600 hover:text-red-500 text-sm font-medium"
                >
                  Delete Batch
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={downloadBatchCSV}
                  className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
                >
                  Download CSV
                </button>
                <button
                  onClick={sendToReviewer}
                  className="inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500"
                >
                  Send to Reviewer
                </button>
              </div>

              {selectedBatch.proposals && selectedBatch.proposals.length > 0 ? (
                <div className="space-y-4 mt-6">
                  <h4 className="font-medium text-slate-700">Proposals</h4>
                  {selectedBatch.proposals.map((proposal, index) => (
                    <div
                      key={proposal.id}
                      className="rounded border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="mb-2">
                        <span className="text-xs font-medium text-slate-500">
                          Proposal {index + 1}
                        </span>
                      </div>
                      <div className="mb-3 space-y-1">
                        {Object.entries(proposal.characteristics).map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="font-medium text-slate-600">{key}:</span>{" "}
                            <span className="text-slate-700">{value}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-sm text-slate-800 whitespace-pre-wrap">
                        {proposal.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Loading proposals...</p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white/60 p-6 shadow-sm">
              <p className="text-sm text-slate-500">
                Select a batch from the list to view its details.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
