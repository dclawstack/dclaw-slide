/**
 * Model registry for the consensus pipeline, tuned for a ~$25/mo budget.
 *
 * Strategy (token-efficient consensus):
 *  - OUTLINERS: two cheap, *diverse* models draft outlines in parallel.
 *    Outlines are short (<600 tokens) so running two costs almost nothing.
 *  - JUDGE: a cheap model merges the two outlines, keeping the best of each.
 *  - DESIGNER: the one place we pay for quality — turns the agreed outline
 *    into full slide JSON in a single streaming call (1 call per deck,
 *    not 1 per slide).
 *
 * Every role is overridable via env so model choice can be tuned without
 * a redeploy: OUTLINER_MODELS (comma-separated), JUDGE_MODEL, DESIGNER_MODEL.
 */

export const MODELS = {
  outliners: (process.env.OUTLINER_MODELS ??
    "google/gemini-2.5-flash,deepseek/deepseek-chat")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean),
  judge: process.env.JUDGE_MODEL ?? "google/gemini-2.5-flash",
  designer: process.env.DESIGNER_MODEL ?? "anthropic/claude-sonnet-4.5",
} as const;
