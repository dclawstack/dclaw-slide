import {
  DeckJsonSchema,
  OutlineSchema,
  SlideSchema,
  type DeckJson,
  type Outline,
  type Slide,
} from "@/lib/deck/types";
import { chat, chatStream, extractJson, type ChatUsage } from "./openrouter";
import { MODELS } from "./models";

export type GenEvent =
  | { type: "status"; message: string }
  | { type: "outline"; outline: Outline }
  | { type: "slide"; slide: Slide; index: number }
  | { type: "done"; deck: DeckJson; meta: GenerationMeta }
  | { type: "error"; message: string };

export interface GenerationMeta {
  models: { outliners: string[]; judge: string; designer: string };
  usage: Record<string, ChatUsage>;
  durationMs: number;
}

const OUTLINE_PROMPT = (topic: string, brandContext: string) => `\
You are an expert presentation strategist. Draft a slide outline for this request:

"${topic}"
${brandContext ? `\nRelevant material from this team's past decks:\n${brandContext}\n` : ""}
Return ONLY JSON: {"title": str, "slides": [{"heading": str, "intent": "one sentence on what this slide must accomplish", "layout": "title"|"section"|"content"|"two-column"|"stats"|"quote"|"closing"}]}
8-12 slides. First slide layout "title", last "closing". Be concrete, not generic.`;

const JUDGE_PROMPT = (topic: string, outlines: string[]) => `\
Two strategists drafted outlines for: "${topic}".

Outline A:
${outlines[0]}

Outline B:
${outlines[1] ?? "(only one outline available)"}

Merge them into one superior outline: keep the sharper headings, drop redundant slides, preserve narrative arc (hook → problem → solution → evidence → ask).
Return ONLY JSON in the same schema as the inputs.`;

const DESIGNER_PROMPT = (outline: Outline, brandContext: string) => `\
You are a world-class presentation designer. Expand this agreed outline into full slides.

Outline:
${JSON.stringify(outline, null, 2)}
${brandContext ? `\nUse this team's voice and reusable content where it fits:\n${brandContext}\n` : ""}
Output format: one JSON object PER LINE (JSONL), one per slide, in order. No prose, no fences.
Each line: {"id": str, "layout": <from outline>, "blocks": [...], "speakerNotes": str}
Block types: {"type":"heading","text"} {"type":"subheading","text"} {"type":"paragraph","text"} {"type":"bullets","items":[str]} {"type":"stat","value","label"} {"type":"quote","text","attribution"?} {"type":"image","prompt","alt"}
Rules: max 5 bullets/slide, max 12 words/bullet. Stats slides get 2-4 stat blocks. Every slide gets speakerNotes (2-3 sentences, conversational).`;

/**
 * Consensus generation pipeline:
 * 1. Two cheap models draft outlines in parallel.
 * 2. A judge merges them into one agreed outline.
 * 3. The designer streams full slide JSON (JSONL — we can render
 *    each slide the moment its line completes).
 */
export async function* generateDeck(
  topic: string,
  brandContext = ""
): AsyncGenerator<GenEvent> {
  const started = Date.now();
  const usage: Record<string, ChatUsage> = {};

  try {
    yield { type: "status", message: "Drafting outlines (2 models)…" };
    const drafts = await Promise.allSettled(
      MODELS.outliners.map((m) =>
        chat(m, [{ role: "user", content: OUTLINE_PROMPT(topic, brandContext) }], {
          maxTokens: 900,
          temperature: 0.8,
        })
      )
    );
    const ok = drafts.flatMap((d) => (d.status === "fulfilled" ? [d.value] : []));
    if (ok.length === 0) {
      const firstErr = drafts.find((d) => d.status === "rejected") as
        | PromiseRejectedResult
        | undefined;
      throw new Error(
        `All outliner models failed: ${firstErr?.reason ?? "unknown"}`
      );
    }
    ok.forEach((r, i) => (usage[`outliner:${r.model}:${i}`] = r.usage));

    yield { type: "status", message: "Judging + merging outlines…" };
    let outline: Outline;
    if (ok.length === 1) {
      outline = OutlineSchema.parse(extractJson(ok[0].text));
    } else {
      const judged = await chat(
        MODELS.judge,
        [{ role: "user", content: JUDGE_PROMPT(topic, ok.map((r) => r.text)) }],
        { maxTokens: 900, temperature: 0.3 }
      );
      usage[`judge:${judged.model}`] = judged.usage;
      outline = OutlineSchema.parse(extractJson(judged.text));
    }
    yield { type: "outline", outline };

    yield { type: "status", message: "Designing slides…" };
    const slides: Slide[] = [];
    let buffer = "";
    for await (const chunk of chatStream(
      MODELS.designer,
      [{ role: "user", content: DESIGNER_PROMPT(outline, brandContext) }],
      { maxTokens: 8192, temperature: 0.6 }
    )) {
      if (chunk.usage) usage[`designer:${MODELS.designer}`] = chunk.usage;
      if (!chunk.delta) continue;
      buffer += chunk.delta;

      // Emit each completed JSONL line as a rendered slide.
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const slide = tryParseSlide(line, slides.length);
        if (slide) {
          slides.push(slide);
          yield { type: "slide", slide, index: slides.length - 1 };
        }
      }
    }
    // Trailing line without newline
    const last = tryParseSlide(buffer.trim(), slides.length);
    if (last) {
      slides.push(last);
      yield { type: "slide", slide: last, index: slides.length - 1 };
    }

    if (slides.length === 0) throw new Error("Designer produced no slides");

    const deck = DeckJsonSchema.parse({
      version: 1,
      title: outline.title,
      theme: { accent: "#EC4899", background: "dark", font: "sans" },
      slides,
    });
    yield {
      type: "done",
      deck,
      meta: {
        models: {
          outliners: [...MODELS.outliners],
          judge: MODELS.judge,
          designer: MODELS.designer,
        },
        usage,
        durationMs: Date.now() - started,
      },
    };
  } catch (err) {
    yield {
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

function tryParseSlide(line: string, index: number): Slide | null {
  if (!line.startsWith("{")) return null;
  try {
    const raw = JSON.parse(line);
    return SlideSchema.parse({ id: raw.id ?? `s${index + 1}`, ...raw });
  } catch {
    return null; // malformed line — skip rather than kill the stream
  }
}
