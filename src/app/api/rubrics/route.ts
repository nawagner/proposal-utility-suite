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

export async function GET() {
  try {
    const rubrics = await listRubrics();
    return NextResponse.json({
      rubrics: rubrics.map(serializeRubric),
    });
  } catch (error) {
    console.error("Failed to list rubrics", error);
    return NextResponse.json(
      {
        error: "Unable to load rubrics.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
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
    const saved = await saveRubric(rubricInput);
    return NextResponse.json(
      {
        rubric: serializeRubric(saved),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to save rubric", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to save rubric.",
      },
      { status: 400 },
    );
  }
}
