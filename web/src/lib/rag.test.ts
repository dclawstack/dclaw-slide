import { describe, expect, it } from "vitest";
import { keywordsFor } from "./rag";

describe("keywordsFor", () => {
  it("extracts lowercase keywords longer than 3 chars", () => {
    expect(keywordsFor("Launch Deck for ACME Rockets")).toEqual([
      "launch",
      "deck",
      "acme",
      "rockets",
    ]);
  });

  it("deduplicates", () => {
    expect(keywordsFor("sales sales SALES pitch")).toEqual(["sales", "pitch"]);
  });

  it("ignores punctuation and short words", () => {
    expect(keywordsFor("a B2B go-to-market plan!")).toEqual(["market", "plan"]);
  });

  it("caps at 12 keywords", () => {
    const prompt = Array.from({ length: 20 }, (_, i) => `keyword${i}`).join(" ");
    expect(keywordsFor(prompt)).toHaveLength(12);
  });

  it("returns empty for empty or trivial prompts", () => {
    expect(keywordsFor("")).toEqual([]);
    expect(keywordsFor("a of to")).toEqual([]);
  });
});
