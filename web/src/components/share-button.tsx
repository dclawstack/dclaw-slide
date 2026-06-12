"use client";

import { useState } from "react";

export function ShareButton({ deckId }: { deckId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    try {
      const res = await fetch(`/api/decks/${deckId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const full = `${window.location.origin}${data.url}`;
      setUrl(full);
      await navigator.clipboard.writeText(full).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  return url ? (
    <span className="text-sm text-emerald-400 truncate max-w-48">
      Copied: {url.replace(/^https?:\/\//, "")}
    </span>
  ) : (
    <button
      onClick={share}
      disabled={busy}
      className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-pink-500 disabled:opacity-40"
    >
      {busy ? "Creating…" : "Share"}
    </button>
  );
}
