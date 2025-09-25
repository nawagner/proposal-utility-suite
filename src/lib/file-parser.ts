import path from "node:path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export interface ParsedProposal {
  filename: string;
  mimetype: string;
  text: string;
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB default limit

const MIME_TO_KIND: Record<string, "pdf" | "docx" | "txt"> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/octet-stream": "pdf", // fallback some browsers use when uploading PDFs
  "text/plain": "txt",
};

const EXTENSION_TO_KIND: Record<string, "pdf" | "docx" | "txt"> = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".txt": "txt",
};

function sanitizeText(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function detectKind(filename: string, mimetype: string): "pdf" | "docx" | "txt" | null {
  const normalizedType = mimetype.toLowerCase();
  if (MIME_TO_KIND[normalizedType]) {
    return MIME_TO_KIND[normalizedType];
  }

  const extension = path.extname(filename).toLowerCase();
  if (EXTENSION_TO_KIND[extension]) {
    return EXTENSION_TO_KIND[extension];
  }

  return null;
}

export async function parseProposalFile(
  buffer: Buffer,
  filename: string,
  mimetype: string,
): Promise<ParsedProposal> {
  if (buffer.byteLength === 0) {
    throw new Error("Uploaded file is empty");
  }

  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("File size exceeds the 5MB limit");
  }

  const kind = detectKind(filename, mimetype);

  if (!kind) {
    throw new Error("Unsupported file type. Upload a PDF, DOCX, or TXT file");
  }

  let text = "";

  if (kind === "pdf") {
    const parsed = await pdfParse(buffer);
    text = parsed.text;
  } else if (kind === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else {
    text = buffer.toString("utf8");
  }

  const clean = sanitizeText(text);

  if (!clean) {
    throw new Error("No readable text found in the uploaded file");
  }

  return {
    filename,
    mimetype,
    text: clean,
  };
}
