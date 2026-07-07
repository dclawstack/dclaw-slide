"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const search = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const body: Record<string, string> = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    if (mode === "signup") body.name = String(form.get("name") ?? "");

    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      router.push(search.get("next") ?? "/dashboard");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? `${mode} failed`);
    setBusy(false);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <form onSubmit={submit} className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-2xl font-bold">
          {mode === "login" ? "Sign in" : "Create your account"}
        </h1>

        {mode === "signup" && (
          <label className="flex flex-col gap-1 text-sm">
            Name
            <input
              name="name"
              required
              maxLength={120}
              className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 outline-none focus:border-pink-500"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 outline-none focus:border-pink-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={mode === "signup" ? 10 : 1}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 outline-none focus:border-pink-500"
          />
        </label>
        {mode === "signup" && (
          <p className="text-xs text-zinc-500">At least 10 characters.</p>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-500 disabled:opacity-50"
        >
          {busy ? "…" : mode === "login" ? "Sign in" : "Sign up"}
        </button>

        <p className="text-sm text-zinc-500">
          {mode === "login" ? (
            <>
              No account?{" "}
              <Link href="/signup" className="text-pink-400 hover:text-pink-300">
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href="/login" className="text-pink-400 hover:text-pink-300">
                Sign in
              </Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
