const BASE_URL = "https://openrouter.ai/api/v1";

export const IMAGE_MODEL =
  process.env.IMAGE_MODEL ?? "google/gemini-2.5-flash-image";

/** Cap images per deck to bound cost/latency (~$0.04 + ~15s each). */
export const MAX_IMAGES_PER_DECK = 6;

export interface ImageResult {
  dataUrl: string | null;
  cost?: number;
}

/**
 * Generate one slide image from a text prompt via OpenRouter (Gemini image).
 * Returns a base64 data URL, or null on failure so callers can fall back.
 */
export async function generateImage(
  prompt: string,
  accent = "#EC4899"
): Promise<ImageResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { dataUrl: null };

  const styled = `${prompt}. Clean modern editorial illustration for a presentation slide, ${accent} accent color, minimal, lots of negative space, no text, no words, no captions.`;

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://dclaw-slide.vercel.app",
        "X-Title": "DClaw Slide",
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        modalities: ["image", "text"],
        messages: [{ role: "user", content: styled }],
        usage: { include: true },
      }),
    });
    if (!res.ok) return { dataUrl: null };
    const data = await res.json();
    const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
    return { dataUrl: url, cost: data.usage?.cost };
  } catch {
    return { dataUrl: null };
  }
}
