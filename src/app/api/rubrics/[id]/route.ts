import { NextResponse } from "next/server";
import {
  getRubricById,
  updateRubric,
  deleteRubric,
  type RubricRecord,
  type RubricInput,
} from "@/lib/rubric-store";

function serializeRubric(record: RubricRecord) {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    criteria: record.criteria
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((criterion) => ({
        id: criterion.id,
        label: criterion.label,
        weight: criterion.weight,
        position: criterion.position,
      })),
  };
}

function normalizeCriteria(criteria: unknown): RubricInput["criteria"] {
  if (!Array.isArray(criteria)) {
    return [];
  }

  return criteria
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const label = typeof (item as { label?: string }).label === "string" ? (item as { label?: string }).label!.trim() : "";
      const weightRaw = (item as { weight?: unknown }).weight;
      const weight = typeof weightRaw === "number" ? weightRaw : Number.parseFloat(String(weightRaw ?? 0));

      if (!label) {
        return null;
      }

      return {
        label,
        weight: Number.isFinite(weight) ? weight : 0,
      };
    })
    .filter((item): item is RubricInput["criteria"][number] => Boolean(item));
}

function getAccessToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      {
        error: "Authentication required. Please sign in.",
      },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  try {
    const rubric = await getRubricById(id, accessToken);
    if (!rubric) {
      return NextResponse.json(
        {
          error: "Rubric not found",
        },
        { status: 404 },
      );
    }
    return NextResponse.json({
      rubric: serializeRubric(rubric),
    });
  } catch (error) {
    console.error("Failed to fetch rubric", error);
    const message = error instanceof Error ? error.message : "Unable to fetch rubric.";
    const status = message.includes("Authentication") ? 401 : 500;
    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      {
        error: "Authentication required. Please sign in.",
      },
      { status: 401 },
    );
  }

  const { id } = await context.params;

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
        error: "Provide rubric details in the request body.",
      },
      { status: 400 },
    );
  }

  const nameField = (payload as { name?: string }).name;
  const descriptionField = (payload as { description?: string }).description;
  const criteriaField = (payload as { criteria?: unknown }).criteria;

  const criteria = normalizeCriteria(criteriaField);
  const rubricInput: RubricInput = {
    name: typeof nameField === "string" ? nameField : "",
    description: typeof descriptionField === "string" ? descriptionField : "",
    criteria,
  };

  try {
    const updated = await updateRubric(id, rubricInput, accessToken);
    return NextResponse.json({
      rubric: serializeRubric(updated),
    });
  } catch (error) {
    console.error("Failed to update rubric", error);
    const message = error instanceof Error ? error.message : "Unable to update rubric.";
    const status = message.includes("Authentication") ? 401 : 400;
    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      {
        error: "Authentication required. Please sign in.",
      },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  try {
    await deleteRubric(id, accessToken);
    return NextResponse.json(
      {
        success: true,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to delete rubric", error);
    const message = error instanceof Error ? error.message : "Unable to delete rubric.";
    const status = message.includes("Authentication") ? 401 : 500;
    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}
