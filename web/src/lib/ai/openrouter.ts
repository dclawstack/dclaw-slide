const BASE_URL = "https://openrouter.ai/api/v1";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  /** USD, as reported by OpenRouter when `usage.include` is set */
  cost?: number;
}

export interface ChatResult {
  text: string;
  usage: ChatUsage;
  model: string;
}

export function hasOpenRouter(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

function headers(): Record<string, string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://dclaw-slide.vercel.app",
    "X-Title": "DClaw Slide",
  };
}

export async function chat(
  model: string,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; json?: boolean } = {}
): Promise<ChatResult> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.7,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      usage: { include: true },
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter ${model}: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      cost: data.usage?.cost,
    },
    model: data.model ?? model,
  };
}

/**
 * Streaming chat. Yields text deltas; the final yield carries usage.
 */
export async function* chatStream(
  model: string,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {}
): AsyncGenerator<{ delta?: string; usage?: ChatUsage }> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
      stream: true,
      usage: { include: true },
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`OpenRouter ${model}: ${res.status} ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield { delta };
        if (json.usage) {
          yield {
            usage: {
              promptTokens: json.usage.prompt_tokens ?? 0,
              completionTokens: json.usage.completion_tokens ?? 0,
              cost: json.usage.cost,
            },
          };
        }
      } catch {
        // partial frame — ignored, next chunk completes it
      }
    }
  }
}

/** Pull the first JSON object out of a model reply that may include prose/fences. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}
