import { NextResponse } from "next/server";
import {
  getBatchById,
  updateBatch,
  deleteBatch,
  type SyntheticBatchRecord,
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      {
        error: "Authentication required. Please sign in.",
      },
      { status: 401 },
    );
  }

  const { id } = await params;

  try {
    const batch = await getBatchById(id, accessToken);
    if (!batch) {
      return NextResponse.json(
        {
          error: "Batch not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      batch: serializeBatch(batch),
    });
  } catch (error) {
    console.error("Failed to fetch batch", error);
    const message = error instanceof Error ? error.message : "Unable to load batch.";
    const status = message.includes("Authentication") ? 401 : 500;
    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      {
        error: "Authentication required. Please sign in.",
      },
      { status: 401 },
    );
  }

  const { id } = await params;

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

  if (typeof nameField !== "string" || !nameField.trim()) {
    return NextResponse.json(
      {
        error: "Batch name is required.",
      },
      { status: 400 },
    );
  }

  try {
    const updated = await updateBatch(
      id,
      nameField,
      typeof descriptionField === "string" ? descriptionField : undefined,
      accessToken
    );
    return NextResponse.json({
      batch: serializeBatch(updated),
    });
  } catch (error) {
    console.error("Failed to update batch", error);
    const message = error instanceof Error ? error.message : "Unable to update batch.";
    const status = message.includes("Authentication") ? 401 : 400;
    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      {
        error: "Authentication required. Please sign in.",
      },
      { status: 401 },
    );
  }

  const { id } = await params;

  try {
    await deleteBatch(id, accessToken);
    return NextResponse.json(
      {
        message: "Batch deleted successfully.",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to delete batch", error);
    const message = error instanceof Error ? error.message : "Unable to delete batch.";
    const status = message.includes("Authentication") ? 401 : 500;
    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}
