"use client";

import { use, useEffect, useState } from "react";
import type { DeckJson } from "@/lib/deck/types";
import { SlideView } from "@/components/slide-view";

type State =
  | { phase: "loading" }
  | { phase: "password"; error?: string }
  | { phase: "ready"; title: string; deck: DeckJson }
  | { phase: "missing" };

export default function SharedDeck({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [state, setState] = useState<State>({ phase: "loading" });
  const [password, setPassword] = useState("");

  useEffect(() => {
    fetch(`/api/share/${token}`).then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setState({ phase: "ready", title: data.title, deck: data.deck });
      } else if (res.status === 401) {
        setState({ phase: "password" });
      } else {
        setState({ phase: "missing" });
      }
    });
  }, [token]);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/share/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      const data = await res.json();
      setState({ phase: "ready", title: data.title, deck: data.deck });
    } else {
      setState({ phase: "password", error: "Wrong password" });
    }
  }

  if (state.phase === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center text-zinc-500">
        Loading…
      </div>
    );
  }
  if (state.phase === "missing") {
    return (
      <div className="flex flex-1 items-center justify-center text-zinc-500">
        This share link doesn&apos;t exist or was revoked.
      </div>
    );
  }
  if (state.phase === "password") {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <form onSubmit={submitPassword} className="flex flex-col gap-3 w-72">
          <p className="text-sm text-zinc-400">
            This deck is password-protected.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-zinc-100 focus:border-pink-500 focus:outline-none"
          />
          {state.error && (
            <p className="text-sm text-red-400">{state.error}</p>
          )}
          <button
            type="submit"
            className="rounded-xl bg-pink-600 px-4 py-2.5 font-semibold text-white hover:bg-pink-500"
          >
            View deck
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-16 print:py-0 print:px-0">
      <div className="w-full max-w-3xl flex flex-col gap-8">
        <header className="flex items-center justify-between gap-4 print:hidden">
          <h1 className="text-2xl font-bold text-balance">{state.title}</h1>
          <button
            onClick={() => window.print()}
            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-pink-500 shrink-0"
          >
            Export PDF
          </button>
        </header>
        <div className="flex flex-col gap-6 print:gap-0">
          {state.deck.slides.map((slide) => (
            <div key={slide.id} className="print:break-after-page">
              <SlideView slide={slide} theme={state.deck.theme} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
