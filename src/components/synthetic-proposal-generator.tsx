"use client";

import { FormEvent, useState } from "react";

interface CharacteristicTuple {
  name: string;
  values: string[];
}

interface SyntheticProposal {
  id: string;
  characteristics: Record<string, string>;
  content: string;
}

const DEFAULT_CHARACTERISTICS: CharacteristicTuple[] = [
  {
    name: "responsiveness_to_proposal_requirements",
    values: [
      "totally ignores proposal requirements",
      "misses one requirement",
      "fully addresses all requirements"
    ]
  },
  {
    name: "proposal_topic",
    values: [
      "semiconductor workforce development",
      "next generation materials",
      "accelerating domestic manufacturing fabs"
    ]
  },
  {
    name: "technical_depth",
    values: [
      "superficial overview only",
      "moderate technical detail",
      "comprehensive technical analysis"
    ]
  },
  {
    name: "budget_justification",
    values: [
      "vague budget estimates",
      "partially detailed costs",
      "fully itemized budget breakdown"
    ]
  },
  {
    name: "team_qualifications",
    values: [
      "minimal relevant experience",
      "some relevant background",
      "highly qualified expert team"
    ]
  }
];

export function SyntheticProposalGenerator() {
  const [characteristics, setCharacteristics] = useState<CharacteristicTuple[]>(DEFAULT_CHARACTERISTICS);
  const [count, setCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [proposals, setProposals] = useState<SyntheticProposal[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addCharacteristic = () => {
    setCharacteristics([...characteristics, { name: "", values: [""] }]);
  };

  const removeCharacteristic = (index: number) => {
    setCharacteristics(characteristics.filter((_, i) => i !== index));
  };

  const updateCharacteristicName = (index: number, name: string) => {
    const updated = [...characteristics];
    updated[index].name = name;
    setCharacteristics(updated);
  };

  const updateCharacteristicValue = (charIndex: number, valueIndex: number, value: string) => {
    const updated = [...characteristics];
    updated[charIndex].values[valueIndex] = value;
    setCharacteristics(updated);
  };

  const addValue = (charIndex: number) => {
    const updated = [...characteristics];
    updated[charIndex].values.push("");
    setCharacteristics(updated);
  };

  const removeValue = (charIndex: number, valueIndex: number) => {
    const updated = [...characteristics];
    updated[charIndex].values = updated[charIndex].values.filter((_, i) => i !== valueIndex);
    setCharacteristics(updated);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/synthetic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          count,
          characteristics: characteristics.filter(c => c.name && c.values.some(v => v.trim()))
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Generation failed");
      }

      const data = await response.json();
      setProposals(data.proposals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl">
      <div className="rounded-lg border border-slate-200 bg-white/60 p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="count" className="block text-sm font-medium text-slate-700 mb-2">
              Number of proposals to generate
            </label>
            <input
              type="number"
              id="count"
              min="1"
              max="20"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 1)}
              className="block w-32 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-900">Characteristics</h3>
              <button
                type="button"
                onClick={addCharacteristic}
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
              >
                Add Characteristic
              </button>
            </div>

            {characteristics.map((characteristic, charIndex) => (
              <div key={charIndex} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 mb-3">
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
                    className="text-red-600 hover:text-red-500 p-1"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Possible values:</label>
                  {characteristic.values.map((value, valueIndex) => (
                    <div key={valueIndex} className="flex items-center gap-2">
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
                          className="text-red-600 hover:text-red-500 p-1"
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

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </form>
      </div>

      {proposals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Generated Proposals</h2>
          {proposals.map((proposal, index) => (
            <div key={proposal.id} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  Proposal {index + 1}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {Object.entries(proposal.characteristics).map(([key, value]) => (
                    <div key={key} className="flex flex-col">
                      <span className="font-medium text-slate-600">{key.replace(/_/g, ' ')}:</span>
                      <span className="text-slate-800">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-slate-200 pt-4">
                <h4 className="font-medium text-slate-900 mb-2">Generated Content:</h4>
                <div className="bg-slate-50 rounded-md p-4 max-h-96 overflow-y-auto">
                  <pre className="text-sm text-slate-800 whitespace-pre-wrap">{proposal.content}</pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
