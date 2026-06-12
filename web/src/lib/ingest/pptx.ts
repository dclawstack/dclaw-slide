import JSZip from "jszip";

/**
 * Extract per-slide text from a .pptx (which is a zip of XML).
 * Slide text lives in ppt/slides/slideN.xml inside <a:t> runs.
 * Regex extraction is deliberate v0 — no XML parser dependency.
 */
export async function extractPptxSlides(buffer: ArrayBuffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => slideNum(a) - slideNum(b));

  const slides: string[] = [];
  for (const name of slideFiles) {
    const xml = await zip.files[name].async("string");
    const runs = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) =>
      decodeXmlEntities(m[1])
    );
    const text = runs.join(" ").replace(/\s+/g, " ").trim();
    if (text) slides.push(text);
  }
  return slides;
}

function slideNum(name: string): number {
  return Number(name.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
}

function decodeXmlEntities(s: string): string {
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

/** Chunk markdown/plain text into ~800-char pieces on paragraph boundaries. */
export function chunkText(text: string, maxLen = 800): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (current && current.length + p.length + 2 > maxLen) {
      chunks.push(current);
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
