import { NextResponse } from "next/server";
import {
  listRubrics,
  saveRubric,
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
    const rubrics = await listRubrics(accessToken);
    return NextResponse.json({
      rubrics: rubrics.map(serializeRubric),
    });
  } catch (error) {
    console.error("Failed to list rubrics", error);
    const message = error instanceof Error ? error.message : "Unable to load rubrics.";
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
    const saved = await saveRubric(rubricInput, accessToken);
    return NextResponse.json(
      {
        rubric: serializeRubric(saved),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to save rubric", error);
    const message = error instanceof Error ? error.message : "Unable to save rubric.";
    const status = message.includes("Authentication") ? 401 : 400;
    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}
