import { NextRequest } from "next/server";
import { db, hasDb, schema } from "@/lib/db";
import { extractPptxSlides, chunkText } from "@/lib/ingest/pptx";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/auth/session";

export const maxDuration = 120;

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, "ingest", { limit: 10, windowMs: 60_000 });
  if (limited) return limited;
  const auth = await requireAuth("editor");
  if (auth instanceof Response) return auth;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "file too large (max 25MB)" }, { status: 413 });
  }

  const name = file.name.toLowerCase();
  let kind: "pptx" | "markdown" | "text";
  let chunks: string[];

  if (name.endsWith(".pptx")) {
    kind = "pptx";
    chunks = await extractPptxSlides(await file.arrayBuffer());
  } else if (name.endsWith(".md") || name.endsWith(".markdown")) {
    kind = "markdown";
    chunks = chunkText(await file.text());
  } else if (name.endsWith(".txt")) {
    kind = "text";
    chunks = chunkText(await file.text());
  } else {
    return Response.json(
      { error: "unsupported file type — use .pptx, .md or .txt" },
      { status: 415 }
    );
  }

  if (chunks.length === 0) {
    return Response.json({ error: "no text found in file" }, { status: 422 });
  }

  const [ingested] = await db()
    .insert(schema.ingestedFiles)
    .values({
      workspaceId: auth.workspaceId,
      filename: file.name,
      kind,
      slideCount: kind === "pptx" ? chunks.length : null,
    })
    .returning({ id: schema.ingestedFiles.id });

  // Embeddings are backfilled once OPENROUTER_API_KEY exists; keyword
  // retrieval works off `content` in the meantime.
  await db()
    .insert(schema.brandChunks)
    .values(
      chunks.map((content) => ({
        workspaceId: auth.workspaceId,
        fileId: ingested.id,
        content,
      }))
    );

  return Response.json({ fileId: ingested.id, chunks: chunks.length, kind });
}

export async function GET() {
  if (!hasDb()) return Response.json({ files: [], db: false });
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const files = await db().query.ingestedFiles.findMany({
    where: (f, { eq }) => eq(f.workspaceId, auth.workspaceId),
    orderBy: (f, { desc }) => [desc(f.createdAt)],
    limit: 50,
  });
  return Response.json({ files, db: true });
}
