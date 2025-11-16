import { NextResponse } from "next/server";
import {
  listBatches,
  saveSyntheticBatch,
  type SyntheticBatchRecord,
  type SyntheticBatchInput,
  type SyntheticProposalInput,
} from "@/lib/synthetic-store";

function serializeBatch(record: SyntheticBatchRecord) {
  const base = {
    id: record.id,
    name: record.name,
    description: record.description,
    count: record.count,
    createdAt: record.createdAt.toISOString(),
  };

  if (record.proposals) {
    return {
      ...base,
      proposals: record.proposals.map((p) => ({
        id: p.id,
        batchId: p.batchId,
        characteristics: p.characteristics,
        content: p.content,
        systemPrompt: p.systemPrompt,
        userPromptTemplate: p.userPromptTemplate,
        rubricId: p.rubricId,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    };
  }

  return base;
}

function getAccessToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

export async function GET(request: Request) {
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      {
        error: "Authentication required. Please sign in.",
      },
      { status: 401 },
    );
  }

  try {
    const batches = await listBatches(accessToken);
    return NextResponse.json({
      batches: batches.map(serializeBatch),
    });
  } catch (error) {
    console.error("Failed to list batches", error);
    const message = error instanceof Error ? error.message : "Unable to load batches.";
    const status = message.includes("Authentication") ? 401 : 500;
    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}

export async function POST(request: Request) {
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      {
        error: "Authentication required. Please sign in.",
      },
      { status: 401 },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      {
        error: "Provide batch details in the request body.",
      },
      { status: 400 },
    );
  }

  const nameField = (payload as { name?: string }).name;
  const descriptionField = (payload as { description?: string }).description;
  const proposalsField = (payload as { proposals?: unknown }).proposals;

  if (!Array.isArray(proposalsField)) {
    return NextResponse.json(
      {
        error: "Proposals array is required.",
      },
      { status: 400 },
    );
  }

  const proposals: SyntheticProposalInput[] = proposalsField
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const characteristics = (item as { characteristics?: unknown }).characteristics;
      const content = (item as { content?: unknown }).content;
      const systemPrompt = (item as { systemPrompt?: unknown }).systemPrompt;
      const userPromptTemplate = (item as { userPromptTemplate?: unknown }).userPromptTemplate;
      const rubricId = (item as { rubricId?: unknown }).rubricId;

      if (
        typeof content !== "string" ||
        !characteristics ||
        typeof characteristics !== "object"
      ) {
        return null;
      }

      return {
        characteristics: characteristics as Record<string, string>,
        content,
        systemPrompt: typeof systemPrompt === "string" ? systemPrompt : undefined,
        userPromptTemplate: typeof userPromptTemplate === "string" ? userPromptTemplate : undefined,
        rubricId: typeof rubricId === "string" ? rubricId : undefined,
      } as SyntheticProposalInput;
    })
    .filter((item): item is SyntheticProposalInput => item !== null);

  const batchInput: SyntheticBatchInput = {
    name: typeof nameField === "string" ? nameField : undefined,
    description: typeof descriptionField === "string" ? descriptionField : undefined,
    proposals,
  };

  try {
    const saved = await saveSyntheticBatch(batchInput, accessToken);
    return NextResponse.json(
      {
        batch: serializeBatch(saved),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to save batch", error);
    const message = error instanceof Error ? error.message : "Unable to save batch.";
    const status = message.includes("Authentication") ? 401 : 400;
    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}
