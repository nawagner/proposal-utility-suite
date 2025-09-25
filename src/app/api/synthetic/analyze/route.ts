import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { parseProposalFile } from "@/lib/file-parser";
import { createChatCompletion } from "@/lib/openrouter";
import type { ChatMessage } from "@/lib/openrouter";

export const runtime = "nodejs";

interface CharacteristicTuple {
  name: string;
  values: string[];
}

const MAX_PROMPT_CHARS = 7000;

const systemMessage: ChatMessage = {
  role: "system",
  content:
    "You analyze calls for proposals and extract structured knobs for generating synthetic proposals. Always answer with compact JSON following the given schema.",
};

function extractJsonPayload(content: string): unknown {
  const trimmed = content.trim();

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const jsonMatch = trimmed.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw error;
  }
}

function normalizeCharacteristic(tuple: CharacteristicTuple, index: number): CharacteristicTuple | null {
  const rawName = tuple.name ?? "";
  const normalizedName = rawName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || `characteristic_${index + 1}`;

  const uniqueValues = Array.from(
    new Set((tuple.values ?? []).map((value) => value.trim()).filter(Boolean)),
  );

  if (uniqueValues.length === 0) {
    return null;
  }

  return {
    name: normalizedName,
    values: uniqueValues,
  };
}

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch (error) {
    console.error("Failed to parse multipart form-data", error);
    return NextResponse.json(
      { error: "Unable to read upload payload. Ensure the file is below 5MB." },
      { status: 400 },
    );
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Request must include a file field" }, { status: 400 });
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const parsed = await parseProposalFile(buffer, file.name, file.type);

    const truncatedText = parsed.text.slice(0, MAX_PROMPT_CHARS);
    const wordCount = parsed.text.split(/\s+/).filter(Boolean).length;
    const preview = parsed.text.slice(0, 1200);

    const userPrompt = `Analyze this call for proposals. Provide me a list of tuple variables I can sample from to generate synthetic proposals. For example the "submitter institution type" could be ("university", "startup", "large industry player", "non-profit", "FFRDC", "Federal entities").

Return a strict JSON object with this exact schema:
{
  "characteristics": [
    {
      "name": "snake_case_identifier",
      "values": ["option one", "option two", "..."]
    }
  ]
}

Focus on the most relevant axes (5-10 items). Use concise option text. Do not include explanations.

Call for proposals text (truncated to ${MAX_PROMPT_CHARS.toLocaleString()} characters if necessary):
"""
${truncatedText}
"""`;

    const messages: ChatMessage[] = [systemMessage, { role: "user", content: userPrompt }];

    const response = await createChatCompletion({
      messages,
      temperature: 0.2,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "The language model returned an empty response." },
        { status: 500 },
      );
    }

    const parsedContent = extractJsonPayload(content);

    const tuples =
      (parsedContent && typeof parsedContent === "object" && "characteristics" in parsedContent
        ? (parsedContent as { characteristics?: CharacteristicTuple[] }).characteristics ?? []
        : Array.isArray(parsedContent)
          ? (parsedContent as CharacteristicTuple[])
          : []);

    const normalized = tuples
      .map((tuple, index) => normalizeCharacteristic(tuple, index))
      .filter((tuple): tuple is CharacteristicTuple => tuple !== null);

    if (normalized.length === 0) {
      return NextResponse.json(
        { error: "Unable to extract characteristic tuples from the model response." },
        { status: 422 },
      );
    }

    return NextResponse.json({
      characteristics: normalized,
      source: {
        filename: parsed.filename,
        mimetype: parsed.mimetype,
        wordCount,
        characterCount: parsed.text.length,
        preview,
      },
    });
  } catch (error) {
    console.error("Synthetic analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
