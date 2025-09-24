import { NextResponse } from "next/server";
import {
  ChatCompletionResponse,
  ChatMessage,
  createChatCompletion,
} from "@/lib/openrouter";

interface ChatRequestBody {
  messages?: ChatMessage[];
  model?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
}

export async function POST(request: Request) {
  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json(
      { error: "`messages` must be a non-empty array" },
      { status: 400 },
    );
  }

  try {
    const completion: ChatCompletionResponse = await createChatCompletion({
      messages: body.messages,
      model: body.model,
      max_tokens: body.max_tokens,
      temperature: body.temperature,
      top_p: body.top_p,
      presence_penalty: body.presence_penalty,
      frequency_penalty: body.frequency_penalty,
    });

    const [firstChoice] = completion.choices;

    return NextResponse.json(
      {
        message: firstChoice?.message ?? null,
        completion,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
