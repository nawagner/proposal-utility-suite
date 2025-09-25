"use client";

import { ChangeEvent, FormEvent, useState } from "react";

interface CharacteristicTuple {
  name: string;
  values: string[];
}

interface CharacteristicState extends CharacteristicTuple {
  id: string;
}

interface SyntheticProposal {
  id: string;
  characteristics: Record<string, string>;
  content: string;
}

interface AnalyzedSource {
  filename: string;
  mimetype: string;
  wordCount: number;
  characterCount: number;
  preview: string;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const DEFAULT_CHARACTERISTICS: CharacteristicTuple[] = [
  {
    name: "responsiveness_to_proposal_requirements",
    values: [
      "totally ignores proposal requirements",
      "misses one requirement",
      "fully addresses all requirements",
    ],
  },
  {
    name: "proposal_topic",
    values: [
      "semiconductor workforce development",
      "next generation materials",
      "accelerating domestic manufacturing fabs",
    ],
  },
  {
    name: "technical_depth",
    values: [
      "superficial overview only",
      "moderate technical detail",
      "comprehensive technical analysis",
    ],
  },
  {
    name: "budget_justification",
    values: [
      "vague budget estimates",
      "partially detailed costs",
      "fully itemized budget breakdown",
    ],
  },
  {
    name: "team_qualifications",
    values: [
      "minimal relevant experience",
      "some relevant background",
      "highly qualified expert team",
    ],
  },
];

function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `char-${Math.random().toString(36).slice(2, 9)}`;
}

function createCharacteristicState(tuple?: Partial<CharacteristicTuple>): CharacteristicState {
  const values = tuple?.values ? [...tuple.values] : [""];

  if (values.length === 0) {
    values.push("");
  }

  return {
    id: generateId(),
    name: tuple?.name ?? "",
    values,
  };
}

function toCharacteristicStateArray(tuples: CharacteristicTuple[]): CharacteristicState[] {
  return tuples.map((tuple) =>
    createCharacteristicState({
      name: tuple.name,
      values: [...tuple.values],
    }),
  );
}

function normalizeName(name: string, fallback: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || fallback;
}

function normalizeCharacteristic(tuple: CharacteristicTuple, index: number): CharacteristicTuple | null {
  const name = normalizeName(tuple.name ?? "", `characteristic_${index + 1}`);
  const values = Array.from(
    new Set((tuple.values ?? []).map((value) => value.trim()).filter(Boolean)),
  );

  if (values.length === 0) {
    return null;
  }

  return { name, values };
}

function isCharacteristic(
  tuple: CharacteristicTuple | null | undefined,
): tuple is CharacteristicTuple {
  return Boolean(tuple);
}

export function SyntheticProposalGenerator() {
  const [characteristics, setCharacteristics] = useState<CharacteristicState[]>(
    toCharacteristicStateArray(DEFAULT_CHARACTERISTICS),
  );
  const [count, setCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [proposals, setProposals] = useState<SyntheticProposal[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [callAnalysis, setCallAnalysis] = useState<AnalyzedSource | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const addCharacteristic = () => {
    setCharacteristics([...characteristics, createCharacteristicState()]);
  };

  const clearCharacteristics = () => {
    setCharacteristics([createCharacteristicState()]);
    setProposals([]);
  };

  const removeCharacteristic = (index: number) => {
    setCharacteristics(characteristics.filter((_, i) => i !== index));
  };

  const updateCharacteristicName = (index: number, name: string) => {
    const updated = [...characteristics];
    updated[index] = { ...updated[index], name };
    setCharacteristics(updated);
  };

  const updateCharacteristicValue = (charIndex: number, valueIndex: number, value: string) => {
    const updated = [...characteristics];
    const values = [...updated[charIndex].values];
    values[valueIndex] = value;
    updated[charIndex] = { ...updated[charIndex], values };
    setCharacteristics(updated);
  };

  const addValue = (charIndex: number) => {
    const updated = [...characteristics];
    const values = [...updated[charIndex].values, ""];
    updated[charIndex] = { ...updated[charIndex], values };
    setCharacteristics(updated);
  };

  const removeValue = (charIndex: number, valueIndex: number) => {
    const updated = [...characteristics];
    const values = updated[charIndex].values.filter((_, i) => i !== valueIndex);
    updated[charIndex] = { ...updated[charIndex], values: values.length > 0 ? values : [""] };
    setCharacteristics(updated);
  };

  const handleCallUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];

    if (!selected) {
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    const formData = new FormData();
    formData.append("file", selected);

    try {
      const response = await fetch("/api/synthetic/analyze", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Analysis failed");
      }

      const tuples = Array.isArray(payload.characteristics) ? payload.characteristics : [];
      const normalized = tuples
        .map((tuple: CharacteristicTuple, index: number) => normalizeCharacteristic(tuple, index))
        .filter(isCharacteristic);

      if (normalized.length === 0) {
        throw new Error("No usable characteristics were returned from the analysis.");
      }

      setCharacteristics(toCharacteristicStateArray(normalized));
      setCallAnalysis(payload.source ?? null);
      setProposals([]);
    } catch (err) {
      console.error("Call analysis error", err);
      setAnalysisError(err instanceof Error ? err.message : "Unknown analysis error");
    } finally {
      setIsAnalyzing(false);
      event.target.value = "";
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsGenerating(true);
    setError(null);

    try {
      const filtered = characteristics
        .map((tuple, index) => normalizeCharacteristic(tuple, index))
        .filter(isCharacteristic);

      const response = await fetch("/api/synthetic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          count,
          characteristics: filtered,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Generation failed");
      }

      const data = await response.json();
      setProposals(data.proposals ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadProposals = () => {
    if (proposals.length === 0) {
      return;
    }

    const filename = `synthetic-proposals-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const payload = JSON.stringify(proposals, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl">
      <section className="rounded-lg border border-slate-200 bg-white/80 p-6 shadow-sm">
        <header className="mb-4 space-y-2 text-left">
          <h2 className="text-lg font-semibold text-slate-900">Analyze a call for proposals</h2>
          <p className="text-sm text-slate-600">
            Upload a call for proposals to auto-suggest sampling characteristics for synthetic proposal generation.
          </p>
        </header>

        <label
          htmlFor="call-for-proposals"
          className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center transition hover:border-blue-300 hover:bg-blue-50/60"
        >
          <span className="text-base font-semibold text-slate-800">
            {isAnalyzing ? "Analyzing…" : "Drag a call for proposals here or browse"}
          </span>
          <span className="text-xs text-slate-500">PDF • DOCX • TXT · max 5MB</span>
          <input
            id="call-for-proposals"
            name="call-for-proposals"
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={handleCallUpload}
            disabled={isAnalyzing}
          />
        </label>

        {analysisError ? <p className="mt-3 text-sm text-red-600">{analysisError}</p> : null}

        {callAnalysis ? (
          <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-inner">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{callAnalysis.filename}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {callAnalysis.mimetype} · {callAnalysis.wordCount.toLocaleString()} words · {callAnalysis.characterCount.toLocaleString()} characters
                </p>
              </div>
              <span className="text-xs font-medium text-green-600">Characteristics updated</span>
            </div>
            <p className="text-xs text-slate-500">Preview:</p>
            <p className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
              {callAnalysis.preview}
              {callAnalysis.preview.length < callAnalysis.characterCount ? "\n\n…(truncated preview)" : ""}
            </p>
          </div>
        ) : null}
      </section>

      <div className="rounded-lg border border-slate-200 bg-white/60 p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="count" className="mb-2 block text-sm font-medium text-slate-700">
              Number of proposals to generate
            </label>
            <input
              type="number"
              id="count"
              min="1"
              max="20"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
              className="block w-32 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-900">Characteristics</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={clearCharacteristics}
                  className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900"
                >
                  Clear All
                </button>
                <button
                  type="button"
                  onClick={addCharacteristic}
                  className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                >
                  Add Characteristic
                </button>
              </div>
            </div>

            {characteristics.map((characteristic, charIndex) => (
              <div key={characteristic.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Characteristic name (e.g., responsiveness_to_proposal_requirements)"
                    value={characteristic.name}
                    onChange={(e) => updateCharacteristicName(charIndex, e.target.value)}
                    className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeCharacteristic(charIndex)}
                    className="p-1 text-red-600 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Possible values:</label>
                  {characteristic.values.map((value, valueIndex) => (
                    <div key={`${characteristic.id}-${valueIndex}`} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Value option"
                        value={value}
                        onChange={(e) => updateCharacteristicValue(charIndex, valueIndex, e.target.value)}
                        className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                      {characteristic.values.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeValue(charIndex, valueIndex)}
                          className="p-1 text-red-600 hover:text-red-500"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addValue(charIndex)}
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    + Add value
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={isGenerating}
            className="w-full inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-green-300"
          >
            {isGenerating ? "Generating..." : "Generate Synthetic Proposals"}
          </button>

          {error ? (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          ) : null}
        </form>
      </div>

      {proposals.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Generated Proposals</h2>
            <button
              type="button"
              onClick={downloadProposals}
              className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
            >
              Download JSON
            </button>
          </div>
          {proposals.map((proposal, index) => (
            <div key={proposal.id} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="mb-2 text-lg font-medium text-slate-900">Proposal {index + 1}</h3>
                <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                  {Object.entries(proposal.characteristics).map(([key, value]) => (
                    <div key={key} className="flex flex-col">
                      <span className="font-medium text-slate-600">{key.replace(/_/g, " ")}:</span>
                      <span className="text-slate-800">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-slate-200 pt-4">
                <h4 className="mb-2 font-medium text-slate-900">Generated Content:</h4>
                <div className="max-h-96 overflow-y-auto rounded-md bg-slate-50 p-4">
                  <pre className="whitespace-pre-wrap text-sm text-slate-800">{proposal.content}</pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
