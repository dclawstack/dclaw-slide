"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface InviteInfo {
  workspaceName: string;
  role: string;
}

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch(`/api/invites/${token}`).then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "invalid invite");
        return res.json();
      }),
      fetch("/api/auth/me").then((res) => res.ok),
    ])
      .then(([inviteInfo, isSignedIn]) => {
        if (!alive) return;
        setInfo(inviteInfo);
        setSignedIn(isSignedIn);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, [token]);

  async function accept() {
    setError(null);
    const res = await fetch(`/api/invites/${token}`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "could not accept invite");
      return;
    }
    // Switch the session to the joined workspace, then go to the dashboard.
    await fetch("/api/auth/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: data.workspaceId }),
    }).catch(() => {});
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm flex flex-col gap-4 text-center">
        <h1 className="text-2xl font-bold">Workspace invite</h1>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {!error && !info && <p className="text-zinc-500">Loading…</p>}
        {info && (
          <>
            <p className="text-zinc-300">
              You&apos;ve been invited to join{" "}
              <span className="font-semibold">{info.workspaceName}</span> as{" "}
              <span className="font-semibold">{info.role}</span>.
            </p>
            {signedIn ? (
              <button
                onClick={accept}
                className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-500"
              >
                Join workspace
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <Link
                  href={`/signup?invite=${token}`}
                  className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-500"
                >
                  Create an account &amp; join
                </Link>
                <Link
                  href={`/login?next=/invite/${token}`}
                  className="rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:border-zinc-500"
                >
                  I already have an account
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
