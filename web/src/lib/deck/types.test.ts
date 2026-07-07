import { describe, expect, it } from "vitest";
import { DeckJsonSchema } from "./types";

const validDeck = {
  version: 1,
  title: "Q3 Review",
  slides: [
    {
      id: "s1",
      layout: "title",
      blocks: [
        { type: "heading", text: "Q3 Review" },
        { type: "subheading", text: "Revenue and roadmap" },
      ],
    },
    {
      id: "s2",
      layout: "stats",
      blocks: [{ type: "stat", value: "142%", label: "Net retention" }],
      speakerNotes: "Pause here.",
    },
  ],
};

describe("DeckJsonSchema", () => {
  it("accepts a valid deck and applies theme defaults", () => {
    const parsed = DeckJsonSchema.parse(validDeck);
    expect(parsed.theme.accent).toBe("#EC4899");
    expect(parsed.theme.background).toBe("dark");
  });

  it("rejects unknown block types", () => {
    const bad = structuredClone(validDeck) as Record<string, unknown>;
    (bad.slides as { blocks: unknown[] }[])[0].blocks = [
      { type: "video", url: "https://example.com" },
    ];
    expect(DeckJsonSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an invalid layout", () => {
    const bad = structuredClone(validDeck) as Record<string, unknown>;
    (bad.slides as { layout: string }[])[0].layout = "hero";
    expect(DeckJsonSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects empty bullets", () => {
    const bad = structuredClone(validDeck) as Record<string, unknown>;
    (bad.slides as { blocks: unknown[] }[])[0].blocks = [
      { type: "bullets", items: [] },
    ];
    expect(DeckJsonSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects the wrong version", () => {
    expect(
      DeckJsonSchema.safeParse({ ...validDeck, version: 2 }).success
    ).toBe(false);
  });
});
