import { Buffer } from "node:buffer";
import path from "node:path";
import JSZip from "jszip";
import { jsonrepair } from "jsonrepair";
import { NextResponse } from "next/server";
import { parseProposalFile } from "@/lib/file-parser";
import { createChatCompletion, ChatMessage } from "@/lib/openrouter";
import type { ProposalReviewCriterion, ProposalReviewResult } from "@/lib/storage-keys";

export const runtime = "nodejs";

// Default to GPT-5 per OpenRouter docs; callers can override via env if needed.
const REVIEW_MODEL =
  process.env.OPENROUTER_REVIEW_MODEL ??
  process.env.OPENROUTER_DEFAULT_MODEL ??
  "openai/gpt-5";
const MAX_PROPOSALS = 12;
const MAX_PROPOSAL_TEXT_LENGTH = 12000;
const SUPPORTED_UPLOAD_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
  "multipart/x-zip",
]);

const EXTENSION_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const SYSTEM_PROMPT = `You are GPT-5, an expert evaluator of grant and proposal submissions. Review proposals strictly against the provided rubric. Each rubric criterion is binary: mark it "pass" when the proposal fully satisfies the requirement, otherwise "fail" and note missing evidence. Keep explanations concise (1–2 sentences). If required information is absent, state that explicitly.`;

const REVIEW_RESPONSE_SCHEMA = {
  name: "proposal_review",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "id",
      "filename",
      "overallVerdict",
      "overallFeedback",
      "criteria",
      "notableStrengths",
      "recommendedImprovements",
    ],
    properties: {
      id: { type: "string" },
      filename: { type: "string" },
      overallVerdict: { enum: ["pass", "fail"] },
      overallFeedback: { type: "string" },
      criteria: {
        type: "array",
        minItems: 0,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "result", "explanation"],
          properties: {
            name: { type: "string" },
            result: { enum: ["pass", "fail"] },
            explanation: { type: "string" },
          },
        },
      },
      notableStrengths: {
        type: "array",
        items: { type: "string" },
      },
      recommendedImprovements: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
  strict: true,
} as const;

interface ParsedProposal {
  id: string;
  filename: string;
  mimetype: string;
  text: string;
  wordCount: number;
}

interface ReviewError {
  filename: string;
  message: string;
}

function truncateContent(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit)}\n\n[Excerpt truncated to stay within token limits]`;
}

function detectZip(file: File): boolean {
  return (
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed" ||
    file.name.toLowerCase().endsWith(".zip")
  );
}

function deriveMimeFromExtension(filename: string): string | undefined {
  const ext = path.extname(filename).toLowerCase();
  return EXTENSION_TO_MIME[ext];
}

async function extractFromZip(buffer: Buffer): Promise<{ filename: string; buffer: Buffer; mimetype: string }[]> {
  const zip = await JSZip.loadAsync(buffer);
  const files: { filename: string; buffer: Buffer; mimetype: string }[] = [];

  const entries = Object.values(zip.files);

  for (const entry of entries) {
    if (entry.dir) {
      continue;
    }

    const mimetype = deriveMimeFromExtension(entry.name);

    if (!mimetype) {
      continue;
    }

    const entryBuffer = await entry.async("nodebuffer");

    files.push({
      filename: path.basename(entry.name),
      buffer: Buffer.from(entryBuffer),
      mimetype,
    });
  }

  return files;
}

function extractJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (primaryError) {
    console.warn("Failed to parse JSON response", primaryError, raw.slice(0, 200));

    try {
      const repaired = jsonrepair(raw);
      return JSON.parse(repaired);
    } catch (repairError) {
      console.warn("JSON repair attempt failed", repairError);
    }
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");

    if (start !== -1 && end !== -1 && end > start) {
      const candidate = raw.slice(start, end + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        throw primaryError;
      }
    }

    throw primaryError;
  }
}

function normalizeCriteria(criteria: unknown): ProposalReviewCriterion[] {
  if (!Array.isArray(criteria)) {
    return [];
  }

  return criteria
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const nameField = (item as { name?: string }).name;
      const name = typeof nameField === "string" ? nameField.trim() : "Unnamed criterion";
      const result = (item as { result?: string }).result === "pass" ? "pass" : "fail";
      const explanationField = (item as { explanation?: string }).explanation;
      const explanationRaw = typeof explanationField === "string" ? explanationField : "";
      const explanation = explanationRaw.trim() || (result === "pass" ? "Criterion appears satisfied." : "Criterion appears unmet or lacks evidence.");

      return {
        name: name || "Unnamed criterion",
        result,
        explanation,
      } satisfies ProposalReviewCriterion;
    })
    .filter((item): item is ProposalReviewCriterion => Boolean(item));
}

function normalizeReview(raw: unknown, fallback: ParsedProposal): ProposalReviewResult {
  if (!raw || typeof raw !== "object") {
    return {
      id: fallback.id,
      filename: fallback.filename,
      wordCount: fallback.wordCount,
      overallVerdict: "fail",
      overallFeedback: "The model returned an invalid response.",
      criteria: [],
      notableStrengths: [],
      recommendedImprovements: ["Unable to parse review output."]
    };
  }

  const data = raw as Record<string, unknown>;

  const overallVerdict = data.overallVerdict === "pass" ? "pass" : "fail";
  const overallFeedback = typeof data.overallFeedback === "string" && data.overallFeedback.trim().length > 0
    ? data.overallFeedback.trim()
    : overallVerdict === "pass"
      ? "Proposal meets rubric expectations."
      : "Proposal does not satisfy all rubric requirements.";

  const strengths = Array.isArray(data.notableStrengths)
    ? (data.notableStrengths as unknown[])
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];

  const improvements = Array.isArray(data.recommendedImprovements)
    ? (data.recommendedImprovements as unknown[])
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];

  const criteria = normalizeCriteria(data.criteria);

  return {
    id: typeof data.id === "string" && data.id.trim() ? data.id.trim() : fallback.id,
    filename: typeof data.filename === "string" && data.filename.trim() ? data.filename.trim() : fallback.filename,
    wordCount: fallback.wordCount,
    overallVerdict,
    overallFeedback,
    criteria,
    notableStrengths: strengths,
    recommendedImprovements: improvements.length > 0 ? improvements : [
      overallVerdict === "pass"
        ? "No immediate improvements recommended."
        : "Address the failed criteria with specific evidence."
    ],
  } satisfies ProposalReviewResult;
}

function createUserPrompt(params: {
  rubricText: string;
  submissionContext: string;
  proposal: ParsedProposal;
}): string {
  const { rubricText, submissionContext, proposal } = params;
  const contextBlock = submissionContext.trim().length > 0 ? submissionContext : "(No additional context provided)";

  return `Evaluate this proposal against the rubric and submission context.

Rubric (binary criteria):
"""
${rubricText}
"""

Submission context supplied by the user:
"""
${contextBlock}
"""

Proposal metadata:
- Identifier: ${proposal.id}
- Filename: ${proposal.filename}
- Word count: ${proposal.wordCount}

Extracted proposal text (may be truncated):
"""
${truncateContent(proposal.text, MAX_PROPOSAL_TEXT_LENGTH)}
"""

Return JSON shaped as:
{
  "id": "${proposal.id}",
  "filename": "${proposal.filename}",
  "overallVerdict": "pass" | "fail",
  "overallFeedback": "1-2 sentence synthesis referencing the rubric",
  "criteria": [
    { "name": "criterion title", "result": "pass" | "fail", "explanation": "1-2 sentences" }
  ],
  "notableStrengths": ["..."],
  "recommendedImprovements": ["..."]
}

Respond with JSON only.`;
}

async function toParsedProposal(file: {
  filename: string;
  buffer: Buffer;
  mimetype: string;
}, index: number): Promise<ParsedProposal> {
  const parsed = await parseProposalFile(file.buffer, file.filename, file.mimetype);
  const words = parsed.text.split(/\s+/).filter(Boolean).length;

  return {
    id: `proposal-${index + 1}`,
    filename: parsed.filename,
    mimetype: parsed.mimetype,
    text: parsed.text,
    wordCount: words,
  };
}

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch (error) {
    console.error("Failed to parse review formData", error);
    return NextResponse.json({ error: "Invalid form-data payload" }, { status: 400 });
  }

  const rubricText = formData.get("rubricText");
  const submissionContext = formData.get("submissionContext");

  if (typeof rubricText !== "string" || rubricText.trim().length === 0) {
    return NextResponse.json({ error: "A rubric is required before requesting reviews." }, { status: 400 });
  }

  const files = formData.getAll("files");

  if (files.length === 0) {
    return NextResponse.json({ error: "Attach at least one proposal file." }, { status: 400 });
  }

  const collectedFiles: { filename: string; buffer: Buffer; mimetype: string }[] = [];

  for (const entry of files) {
    if (!(entry instanceof File)) {
      continue;
    }

    const extensionMime = deriveMimeFromExtension(entry.name);

    if (!SUPPORTED_UPLOAD_TYPES.has(entry.type) && !detectZip(entry) && !extensionMime) {
      return NextResponse.json({ error: `Unsupported file type: ${entry.name}` }, { status: 400 });
    }

    const arrayBuffer = await entry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (detectZip(entry)) {
      const extracted = await extractFromZip(buffer);
      collectedFiles.push(...extracted);
    } else {
      collectedFiles.push({ filename: entry.name, buffer, mimetype: extensionMime ?? entry.type });
    }
  }

  if (collectedFiles.length === 0) {
    return NextResponse.json({ error: "No PDF or DOCX proposals were found in the upload." }, { status: 400 });
  }

  if (collectedFiles.length > MAX_PROPOSALS) {
    return NextResponse.json(
      { error: `Reduce the number of proposals. Limit is ${MAX_PROPOSALS}.` },
      { status: 400 },
    );
  }

  try {
    const parsedProposals = await Promise.all(
      collectedFiles.map((file, index) => toParsedProposal(file, index)),
    );

    const reviewPromises = parsedProposals.map(async (proposal): Promise<{ review?: ProposalReviewResult; error?: ReviewError }> => {
      const messages: ChatMessage[] = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: createUserPrompt({
          rubricText: rubricText.trim(),
          submissionContext: typeof submissionContext === "string" ? submissionContext : "",
          proposal,
        }) },
      ];

      try {
        const completion = await createChatCompletion({
          model: REVIEW_MODEL,
          messages,
          max_tokens: 800,
          temperature: 0.2,
          response_format: {
            type: "json_schema",
            json_schema: REVIEW_RESPONSE_SCHEMA,
          },
        });

        const choice = completion.choices[0];
        const message = choice?.message;
        const parsedPayload = message?.parsed ?? null;
        const content = typeof message?.content === "string" ? message.content : "";
        const finishReason = choice?.finish_reason;

        if (!parsedPayload && !content) {
          console.error(`Empty response details for ${proposal.filename}:`, {
            completionId: completion.id,
            choicesLength: completion.choices?.length,
            finishReason: finishReason,
            choice: choice,
            message: message,
            model: REVIEW_MODEL,
            completionError: completion.error,
          });

          let errorMsg = `Model returned an empty response (model: ${REVIEW_MODEL})`;
          if (finishReason === "content_filter") {
            errorMsg = `Content was filtered by the model (model: ${REVIEW_MODEL}). The proposal may contain flagged content.`;
          } else if (finishReason === "length") {
            errorMsg = `Response was cut off due to length limits (model: ${REVIEW_MODEL}). Try reducing proposal size.`;
          } else if (completion.error) {
            errorMsg = `Model error: ${completion.error.message || completion.error.code || "Unknown error"}`;
          } else if (finishReason) {
            errorMsg += `. Finish reason: ${finishReason}`;
          }

          throw new Error(errorMsg);
        }

        const parsedResponse = parsedPayload ?? extractJson(content);
        const review = normalizeReview(parsedResponse, proposal);
        return { review };
      } catch (error) {
        console.error(`Review generation failed for ${proposal.filename}`, error);
        let message = "Unknown review error";

        if (error instanceof Error) {
          message = error.message;

          if (message.toLowerCase().includes("invalid model") || message.includes("not a valid model ID")) {
            message = `${message}. Update OPENROUTER_REVIEW_MODEL to a supported model.`;
          }
        }

        return {
          error: {
            filename: proposal.filename,
            message,
          },
        };
      }
    });

    const settled = await Promise.all(reviewPromises);
    const reviews = settled
      .map((result) => result.review)
      .filter((review): review is ProposalReviewResult => Boolean(review));
    const errors = settled
      .map((result) => result.error)
      .filter((error): error is ReviewError => Boolean(error));

    if (reviews.length === 0) {
      return NextResponse.json({ error: "All proposal reviews failed", details: errors }, { status: 502 });
    }

    return NextResponse.json({
      reviews,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Proposal review pipeline error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to review proposals" },
      { status: 500 },
    );
  }
}
