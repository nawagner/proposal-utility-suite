import { NextResponse } from "next/server";
import { getRubricById, type RubricRecord } from "@/lib/rubric-store";

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

export async function GET(_request: Request, context: { params: { id?: string } }) {
  const rubricId = context.params?.id;

  if (!rubricId) {
    return NextResponse.json(
      {
        error: "Rubric id is required.",
      },
      { status: 400 },
    );
  }

  try {
    const rubric = await getRubricById(rubricId);
    if (!rubric) {
      return NextResponse.json(
        {
          error: "Rubric not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      rubric: serializeRubric(rubric),
    });
  } catch (error) {
    console.error("Failed to fetch rubric", error);
    return NextResponse.json(
      {
        error: "Unable to fetch rubric.",
      },
      { status: 500 },
    );
  }
}
