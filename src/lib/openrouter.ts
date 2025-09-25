export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  parsed?: unknown;
}

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  response_format?:
    | { type: "text" }
    | {
        type: "json_schema";
        json_schema: {
          name: string;
          schema: unknown;
          strict?: boolean;
        };
      };
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
}

export interface ChatCompletionResponse {
  id: string;
  choices: ChatCompletionChoice[];
}

const DEFAULT_MODEL = process.env.OPENROUTER_DEFAULT_MODEL ?? "gpt-4o-mini";
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

export async function createChatCompletion(
  request: ChatCompletionRequest,
): Promise<ChatCompletionResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // OpenRouter recommends setting these headers to identify your app.
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "Proposal Utility Suite",
    },
    body: JSON.stringify({
      ...request,
      model: request.model ?? DEFAULT_MODEL,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter request failed: ${response.status} ${response.statusText} - ${body}`);
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  return payload;
}
