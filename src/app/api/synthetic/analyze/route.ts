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
const CALL_TEXT_PLACEHOLDER = "{{CALL_TEXT}}";
const DEFAULT_PROMPT_TEMPLATE = `Analyze this call for proposals. Provide me a list of tuple variables I can sample from to generate synthetic proposals. For example the "submitter institution type" could be ("university", "startup", "large industry player", "non-profit", "FFRDC", "Federal entity").

Return a strict JSON object with this exact schema:
{
  "characteristics": [
    {
      "name": "identifier",
      "values": ["option one", "option two", "..."]
    }
  ]
}

Be sure to extract all possible proposal topics. Also be sure to include anything that would to a proposal "not be evaluated". Use concise option text. All characteristics should have only at least two options. Do not include explanations.

Call for proposals text (truncated if necessary):
"""
${CALL_TEXT_PLACEHOLDER}
"""`;

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

  const uploaded = formData.getAll("file").filter((item): item is File => item instanceof File);

  if (uploaded.length === 0) {
    return NextResponse.json({ error: "Request must include at least one file" }, { status: 400 });
  }

  const promptField = formData.get("promptTemplate");
  const promptTemplate = typeof promptField === "string" && promptField.trim().length > 0 ? promptField : DEFAULT_PROMPT_TEMPLATE;

  try {
    const parsedDocuments = await Promise.all(
      uploaded.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const parsed = await parseProposalFile(buffer, file.name, file.type);
        const preview = parsed.text.slice(0, 1200);
        const wordCount = parsed.text.split(/\s+/).filter(Boolean).length;

        return {
          text: parsed.text,
          metadata: {
            filename: parsed.filename,
            mimetype: parsed.mimetype,
            wordCount,
            characterCount: parsed.text.length,
            preview,
          },
        };
      }),
    );

    const combinedText = parsedDocuments
      .map((document, index) => {
        const header = `Document ${index + 1}: ${document.metadata.filename} (${document.metadata.mimetype})`;
        return `${header}\n\n${document.text}`;
      })
      .join("\n\n-----\n\n");

    if (!combinedText.trim()) {
      return NextResponse.json(
        { error: "Uploaded document(s) did not contain any readable text." },
        { status: 422 },
      );
    }

    const truncatedText = combinedText.slice(0, MAX_PROMPT_CHARS);
    const promptWithText = promptTemplate.includes(CALL_TEXT_PLACEHOLDER)
      ? promptTemplate.replace(CALL_TEXT_PLACEHOLDER, truncatedText)
      : `${promptTemplate.trim()}\n\nCall for proposals text (truncated to ${MAX_PROMPT_CHARS.toLocaleString()} characters if necessary):\n"""\n${truncatedText}\n"""`;

    const messages: ChatMessage[] = [systemMessage, { role: "user", content: promptWithText }];

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

    const sources = parsedDocuments.map((document) => document.metadata);

    return NextResponse.json({
      characteristics: normalized,
      sources,
      source: sources[0] ?? null,
    });
  } catch (error) {
    console.error("Synthetic analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
