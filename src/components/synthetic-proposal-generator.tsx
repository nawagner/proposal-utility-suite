"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { exportProposalsToCSV, downloadCSV } from "@/lib/csv-export";

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

const DEFAULT_SYSTEM_PROMPT = "You are an AI that generates realistic synthetic proposal content for testing and training purposes. Create diverse, authentic-sounding proposals that naturally exhibit the specified characteristics without explicitly mentioning them.";

const DEFAULT_USER_PROMPT_TEMPLATE = `Generate a realistic synthetic proposal with the following characteristics:

{{CHARACTERISTICS_LIST}}

Reflect these characteristics authentically. Include:
- A brief project overview
- Key technical approaches or methodologies
- Expected outcomes or deliverables
- Team composition hints (if relevant)
- Budget considerations (if relevant)

Make it sound like a real proposal submission that would naturally exhibit these characteristics. Do not explicitly mention the characteristics themselves in the content.`;

const DEFAULT_CHARACTERISTICS: CharacteristicTuple[] = [
  {
    name: "proposal topic",
    values: [
      "Semiconductor advanced test, assembly, and packaging capability",
      "materials characterization, instrumentation and testing for next generation microelectronics",
      "Virtualization and automation of maintenance of semiconductor machinery",
      "Metrology for security and supply chain verification.",
      "next generation lithography",
      "semiconductor workforce development",
      "Semiconductor devices: next generation materials, process tools/flows, devices and architectures that may include digital, analog, mixed signal, power, radio-frequency, optoelectronic, sensors, or other.",
      "Next generation memory devices",
      "accelerating domestic manufacturing fabs",
      "Application of biotechnology and biomanufacturing technology for advanced microelectronics research and development",
      "commercialization of innovations",
      "standards development",
    ],
  },
  {
    name: "proposal length",
    values: [
      "1 page",
      "5 pages",
      "7 pages",
    ],
  },
  {
    name: "technical depth",
    values: [
      "superficial overview only",
      "moderate technical detail",
      "comprehensive technical analysis",
    ],
  },
  {
    name: "budget justification",
    values: [
      "vague budget estimates",
      "partially detailed costs",
      "fully itemized budget breakdown",
    ],
  },
  {
    name: "team qualifications",
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
  const { session } = useAuth();
  const [characteristics, setCharacteristics] = useState<CharacteristicState[]>(
    toCharacteristicStateArray(DEFAULT_CHARACTERISTICS),
  );
  const [count, setCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [proposals, setProposals] = useState<SyntheticProposal[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [userPromptTemplate, setUserPromptTemplate] = useState(DEFAULT_USER_PROMPT_TEMPLATE);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const [saveToDB, setSaveToDB] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [savedBatchInfo, setSavedBatchInfo] = useState<{ id: string; name: string } | null>(null);

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


  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsGenerating(true);
    setError(null);
    setSavedBatchInfo(null);

    try {
      const filtered = characteristics
        .map((tuple, index) => normalizeCharacteristic(tuple, index))
        .filter(isCharacteristic);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Add authorization header if saving to DB and user is authenticated
      if (saveToDB && session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch("/api/synthetic", {
        method: "POST",
        headers,
        body: JSON.stringify({
          count,
          characteristics: filtered,
          systemPrompt,
          userPromptTemplate,
          saveToDB: saveToDB && !!session,
          batchName: batchName || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Generation failed");
      }

      const data = await response.json();
      setProposals(data.proposals ?? []);

      if (data.savedBatch) {
        setSavedBatchInfo(data.savedBatch);
      }

      if (data.saveError) {
        setError(`Generated proposals, but save failed: ${data.saveError}`);
      }
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

    const filename = `synthetic-proposals-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
    const csvContent = exportProposalsToCSV(proposals);
    downloadCSV(csvContent, filename);
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl">
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
              <div>
                <h3 className="text-lg font-medium text-slate-900">Characteristics</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Random combinations of these will be selected to create synthetic proposals.
                </p>
              </div>
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
                    placeholder="Characteristic name (e.g., Proposal topic)"
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

          <div className="border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              <span className={`transition-transform ${showAdvancedSettings ? 'rotate-90' : ''}`}>▶</span>
              Advanced Settings: Customize Generation Prompts
            </button>

            {showAdvancedSettings && (
              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="system-prompt" className="mb-2 block text-sm font-medium text-slate-700">
                    System Message
                  </label>
                  <textarea
                    id="system-prompt"
                    rows={3}
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="System instructions for the AI..."
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Sets the behavior and role for the AI when generating proposals.
                  </p>
                </div>

                <div>
                  <label htmlFor="user-prompt-template" className="mb-2 block text-sm font-medium text-slate-700">
                    User Prompt Template
                  </label>
                  <textarea
                    id="user-prompt-template"
                    rows={10}
                    value={userPromptTemplate}
                    onChange={(e) => setUserPromptTemplate(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono"
                    placeholder="Template for generating each proposal..."
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Use <code className="rounded bg-slate-100 px-1 py-0.5">{"{{CHARACTERISTICS_LIST}}"}</code> as a placeholder where the selected characteristic values should be inserted.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
                    setUserPromptTemplate(DEFAULT_USER_PROMPT_TEMPLATE);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  Reset to Defaults
                </button>
              </div>
            )}
          </div>

          {session && (
            <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="saveToDB"
                  checked={saveToDB}
                  onChange={(e) => setSaveToDB(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-200"
                />
                <label htmlFor="saveToDB" className="ml-2 text-sm font-medium text-slate-700">
                  Save to database
                </label>
              </div>

              {saveToDB && (
                <div>
                  <label htmlFor="batchName" className="mb-1 block text-xs font-medium text-slate-600">
                    Batch name (optional)
                  </label>
                  <input
                    type="text"
                    id="batchName"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    placeholder="Leave empty for auto-generated name"
                    className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isGenerating}
            className="w-full inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-green-300"
          >
            {isGenerating ? "Generating..." : "Generate Synthetic Proposals"}
          </button>

          {savedBatchInfo && (
            <div className="rounded-md bg-green-50 p-4">
              <p className="text-sm text-green-800">
                ✓ Batch saved successfully: <strong>{savedBatchInfo.name}</strong>
              </p>
            </div>
          )}

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
              Download CSV
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
