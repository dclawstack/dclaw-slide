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

const CHAT_TIMEOUT_MS = 90_000;
const STREAM_CONNECT_TIMEOUT_MS = 30_000;
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

/**
 * POST with a timeout and one retry (with backoff) on transient failures —
 * rate limits, 5xx, network errors. Non-retryable statuses throw
 * immediately.
 */
async function requestWithRetry(
  body: Record<string, unknown>,
  model: string,
  timeoutMs: number
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1_000));
    // Timeout covers time-to-headers only; it is cleared once the response
    // arrives so long streaming bodies aren't cut off. Vercel's maxDuration
    // bounds the overall request.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      lastError = err; // network error or timeout — retryable
      continue;
    } finally {
      clearTimeout(timer);
    }
    if (res.ok) return res;
    const error = new Error(
      `OpenRouter ${model}: ${res.status} ${await res.text()}`
    );
    if (!RETRYABLE.has(res.status)) throw error;
    lastError = error;
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function chat(
  model: string,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; json?: boolean } = {}
): Promise<ChatResult> {
  const res = await requestWithRetry(
    {
      model,
      messages,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.7,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      usage: { include: true },
    },
    model,
    CHAT_TIMEOUT_MS
  );
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
  // Retry covers connection establishment; once streaming starts, a drop
  // surfaces to the caller (the route already reports stream errors).
  const res = await requestWithRetry(
    {
      model,
      messages,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
      stream: true,
      usage: { include: true },
    },
    model,
    STREAM_CONNECT_TIMEOUT_MS
  );
  if (!res.body) {
    throw new Error(`OpenRouter ${model}: empty stream body`);
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
