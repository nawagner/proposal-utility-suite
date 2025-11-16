import { NextResponse } from "next/server";
import {
  listProposals,
  type SyntheticProposalRecord,
} from "@/lib/synthetic-store";

function serializeProposal(record: SyntheticProposalRecord) {
  return {
    id: record.id,
    batchId: record.batchId,
    characteristics: record.characteristics,
    content: record.content,
    systemPrompt: record.systemPrompt,
    userPromptTemplate: record.userPromptTemplate,
    rubricId: record.rubricId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
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

  // Parse query parameters for filtering
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batchId") ?? undefined;
  const rubricId = searchParams.get("rubricId") ?? undefined;

  try {
    const proposals = await listProposals(accessToken, {
      batchId,
      rubricId,
    });
    return NextResponse.json({
      proposals: proposals.map(serializeProposal),
    });
  } catch (error) {
    console.error("Failed to list proposals", error);
    const message = error instanceof Error ? error.message : "Unable to load proposals.";
    const status = message.includes("Authentication") ? 401 : 500;
    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}
