"use client";
/**
 * Landing-page seed/clear controls for the demo dataset.
 * Part of the removable demo module — to remove the feature, delete this file,
 * the <DemoDataControls/> usage in src/app/page.tsx, src/demo/, and
 * src/app/api/demo/. (See src/demo/seed.ts for the full checklist.)
 */
import { useEffect, useState } from "react";
import Link from "next/link";

type Phase = "idle" | "seeding" | "clearing";

export function DemoDataControls() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seeded, setSeeded] = useState<boolean | null>(null);
  const [count, setCount] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/demo")
      .then((res) => res.json())
      .then((d) => {
        if (!alive) return;
        setSeeded(Boolean(d.seeded));
        setCount(d.decks ?? 0);
      })
      .catch(() => {
        if (alive) setSeeded(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function run(action: "seed" | "clear") {
    setPhase(action === "seed" ? "seeding" : "clearing");
    setMsg(null);
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(
          res.status === 401
            ? "Sign in to manage demo data."
            : (d.error ?? "Something went wrong.")
        );
        return;
      }
      setSeeded(Boolean(d.seeded));
      setCount(d.decks ?? 0);
      setMsg(
        action === "seed"
          ? `Seeded ${d.decks} demo decks. Open the dashboard to explore.`
          : "Demo data cleared — back to a fresh state."
      );
    } catch {
      setMsg("Something went wrong.");
    } finally {
      setPhase("idle");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6">
      <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-5 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-400">
            DEMO
          </span>
          <span className="text-zinc-300">
            {seeded === null
              ? "Demo data status unavailable"
              : seeded
                ? `${count} demo decks loaded`
                : "No demo data — fresh state"}
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => run("seed")}
            disabled={phase !== "idle"}
            className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-500 disabled:opacity-40"
          >
            {phase === "seeding" ? "Seeding…" : "Seed demo data"}
          </button>
          <button
            onClick={() => run("clear")}
            disabled={phase !== "idle" || seeded === false}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500 disabled:opacity-40"
          >
            {phase === "clearing" ? "Clearing…" : "Clear data"}
          </button>
          {seeded && (
            <Link
              href="/dashboard"
              className="rounded-lg border border-pink-500/40 px-4 py-2 text-sm text-pink-300 hover:border-pink-500"
            >
              View decks →
            </Link>
          )}
        </div>

        {msg && <p className="w-full text-sm text-zinc-400">{msg}</p>}
      </div>
    </div>
  );
}
