import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { parseProposalFile } from "@/lib/file-parser";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch (error) {
    console.error("Failed to parse multipart form-data", error);
    return NextResponse.json(
      {
        error: "Unable to read upload payload. Ensure the file is below 5MB.",
      },
      { status: 400 },
    );
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        error: "Request must include a file field",
      },
      { status: 400 },
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const parsed = await parseProposalFile(buffer, file.name, file.type);

    const wordCount = parsed.text.split(/\s+/).filter(Boolean).length;
    const preview = parsed.text.slice(0, 1200);

    return NextResponse.json(
      {
        source: "upload",
        filename: parsed.filename,
        mimetype: parsed.mimetype,
        wordCount,
        characterCount: parsed.text.length,
        preview,
        text: parsed.text,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to parse file",
      },
      { status: 400 },
    );
  }
}
