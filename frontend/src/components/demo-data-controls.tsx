"use client";

/**
 * Landing-page seed/clear controls for the demo dataset.
 *
 * Self-contained: this file calls the /api/v1/demo/{seed,clear} endpoints
 * directly so it can be deleted in one shot. To remove the feature:
 *   1. Delete this file.
 *   2. Remove the <DemoDataControls /> usage in src/app/page.tsx.
 *   3. Remove backend/app/api/v1/demo.py and its include_router line.
 */

import { useState } from "react";
import { Database, Loader2, Sparkles, Trash2 } from "lucide-react";

type Status = "idle" | "seeding" | "clearing";

interface SeedResult {
  status: string;
  presentations?: number;
  slides?: number;
  brand_references?: number;
  analytics_events?: number;
  share_links?: number;
}

interface ClearResult {
  status: string;
  presentations?: number;
  brand_references?: number;
  brand_kits?: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export function DemoDataControls() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "seed" | "clear") {
    setStatus(action === "seed" ? "seeding" : "clearing");
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/demo/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as SeedResult & ClearResult;
      if (action === "seed") {
        setMessage(
          `Loaded ${data.presentations ?? 0} decks, ${data.slides ?? 0} slides, ` +
            `${data.brand_references ?? 0} brand references, and ` +
            `${data.analytics_events ?? 0} analytics events. Open the dashboard to see them.`,
        );
      } else {
        setMessage(
          `Cleared ${data.presentations ?? 0} decks, ${data.brand_references ?? 0} brand ` +
            `references, and ${data.brand_kits ?? 0} brand kit. Workspace is empty.`,
        );
      }
    } catch (e) {
      setError((e as Error).message || "Request failed");
    } finally {
      setStatus("idle");
    }
  }

  const busy = status !== "idle";

  return (
    <section
      aria-labelledby="demo-data-heading"
      className="border-y border-amber-200 bg-amber-50/60"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-700">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <h2
              id="demo-data-heading"
              className="text-sm font-semibold text-slate-900"
            >
              Demo dataset
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
              Load a sample brand kit, three decks (pitch, report, training), share
              links, and per-slide analytics so you can see the app at full capacity.
              Clear it any time to return to an empty workspace.
            </p>
            {message ? (
              <p className="mt-2 text-xs text-emerald-700">{message}</p>
            ) : null}
            {error ? (
              <p className="mt-2 text-xs text-rose-700">Error: {error}</p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => run("seed")}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "seeding" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {status === "seeding" ? "Seeding…" : "Seed demo data"}
          </button>
          <button
            type="button"
            onClick={() => run("clear")}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "clearing" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {status === "clearing" ? "Clearing…" : "Clear data"}
          </button>
        </div>
      </div>
    </section>
  );
}
