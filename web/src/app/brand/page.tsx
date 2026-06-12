"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface IngestedFile {
  id: string;
  filename: string;
  kind: string;
  slideCount: number | null;
  createdAt: string;
}

export default function BrandPage() {
  const [files, setFiles] = useState<IngestedFile[]>([]);
  const [dbReady, setDbReady] = useState(true);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch("/api/ingest");
    const data = await res.json();
    setFiles(data.files ?? []);
    setDbReady(data.db !== false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function upload(file: File) {
    setBusy(true);
    setStatus(`Ingesting ${file.name}…`);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/ingest", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setStatus(`✓ ${file.name}: ${data.chunks} chunks indexed`);
      refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-3xl flex flex-col gap-8">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Brand library</h1>
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Home
          </Link>
        </header>

        <p className="text-zinc-400 text-sm max-w-prose">
          Upload your past decks (.pptx) or notes (.md / .txt). New
          generations reuse this material so decks sound like{" "}
          <span className="text-pink-400">your</span> decks.
        </p>

        {!dbReady && (
          <p className="text-amber-400 text-sm">
            Database not connected yet — uploads will work once NEON_API_KEY
            is set.
          </p>
        )}

        <label
          className={`rounded-2xl border-2 border-dashed border-zinc-700 px-6 py-12 text-center text-zinc-400 hover:border-pink-500 cursor-pointer ${
            busy ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <input
            type="file"
            accept=".pptx,.md,.markdown,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
          {busy ? "Working…" : "Click to upload a .pptx, .md or .txt"}
        </label>

        {status && <p className="text-sm text-zinc-300">{status}</p>}

        {files.length > 0 && (
          <ul className="flex flex-col divide-y divide-zinc-800">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between py-3 text-sm"
              >
                <span className="font-medium">{f.filename}</span>
                <span className="text-zinc-500">
                  {f.kind}
                  {f.slideCount ? ` · ${f.slideCount} slides` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
