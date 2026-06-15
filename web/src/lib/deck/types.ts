import { z } from "zod";

/**
 * Deck-as-JSON is the product's core contract: the LLM pipeline emits it,
 * the editor mutates it, the renderer and exporter consume it.
 */

export const SlideBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), text: z.string() }),
  z.object({ type: z.literal("subheading"), text: z.string() }),
  z.object({ type: z.literal("paragraph"), text: z.string() }),
  z.object({ type: z.literal("bullets"), items: z.array(z.string()).min(1) }),
  z.object({
    type: z.literal("stat"),
    value: z.string(),
    label: z.string(),
  }),
  z.object({
    type: z.literal("quote"),
    text: z.string(),
    attribution: z.string().optional(),
  }),
  z.object({
    type: z.literal("image"),
    prompt: z.string(),
    url: z.string().optional(),
    alt: z.string(),
  }),
]);

export const SlideSchema = z.object({
  id: z.string(),
  layout: z.enum([
    "title",
    "section",
    "content",
    "two-column",
    "stats",
    "quote",
    "closing",
  ]),
  blocks: z.array(SlideBlockSchema),
  speakerNotes: z.string().optional(),
});

export const DeckJsonSchema = z.object({
  version: z.literal(1),
  title: z.string(),
  theme: z
    .object({
      id: z.string().optional(),
      accent: z.string().default("#EC4899"),
      background: z.enum(["light", "dark"]).default("dark"),
      font: z.enum(["sans", "serif"]).default("sans"),
    })
    .default({ accent: "#EC4899", background: "dark", font: "sans" }),
  slides: z.array(SlideSchema),
});

export type SlideBlock = z.infer<typeof SlideBlockSchema>;
export type Slide = z.infer<typeof SlideSchema>;
export type DeckJson = z.infer<typeof DeckJsonSchema>;

export const OutlineSchema = z.object({
  title: z.string(),
  slides: z.array(
    z.object({
      heading: z.string(),
      intent: z.string(),
      layout: SlideSchema.shape.layout,
    })
  ),
});

export type Outline = z.infer<typeof OutlineSchema>;
