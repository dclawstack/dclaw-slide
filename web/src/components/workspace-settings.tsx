"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Member {
  userId: string;
  email: string;
  name: string;
  role: string;
  joinedAt: string;
}
interface Invite {
  token: string;
  role: string;
  email: string | null;
  expiresAt: string;
}
interface WorkspaceInfo {
  id: string;
  name: string;
  plan: string;
  members: number;
  role: string;
  limits: { generationsPerMonth: number; maxMembers: number };
}

const ROLES = ["viewer", "editor", "admin", "owner"] as const;

export function WorkspaceSettings() {
  const router = useRouter();
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [info, setInfo] = useState<WorkspaceInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitesList, setInvitesList] = useState<Invite[]>([]);
  const [inviteRole, setInviteRole] = useState("editor");
  const [msg, setMsg] = useState<string | null>(null);

  const isAdmin = info && ["admin", "owner"].includes(info.role);

  const refresh = useCallback(async () => {
    const [meRes, infoRes, membersRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/workspace"),
      fetch("/api/workspace/members"),
    ]);
    if (meRes.status === 401) {
      router.push("/login?next=/settings");
      return;
    }
    const meData = await meRes.json();
    setMe(meData.user);
    if (infoRes.ok) {
      const i = await infoRes.json();
      setInfo(i);
      if (["admin", "owner"].includes(i.role)) {
        const invRes = await fetch("/api/workspace/invites");
        if (invRes.ok) setInvitesList((await invRes.json()).invites);
      }
    }
    if (membersRes.ok) setMembers((await membersRes.json()).members);
  }, [router]);

  useEffect(() => {
    let alive = true;
    Promise.resolve()
      .then(refresh)
      .catch(() => {
        if (alive) setMsg("Failed to load settings.");
      });
    return () => {
      alive = false;
    };
  }, [refresh]);

  async function act(
    fn: () => Promise<Response>,
    okMsg?: string
  ): Promise<void> {
    setMsg(null);
    const res = await fn();
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error ?? "Something went wrong.");
      return;
    }
    if (okMsg) setMsg(okMsg);
    await refresh();
  }

  if (!info) {
    return (
      <div className="flex flex-1 items-center justify-center text-zinc-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-3xl flex flex-col gap-10">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Workspace settings</h1>
          <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Dashboard
          </Link>
        </header>

        <section className="flex flex-col gap-2 text-sm">
          <h2 className="text-lg font-semibold">{info.name}</h2>
          <p className="text-zinc-400">
            Plan: <span className="text-zinc-200 uppercase">{info.plan}</span> ·{" "}
            {info.members}/{info.limits.maxMembers} members ·{" "}
            {info.limits.generationsPerMonth} generations/month · your role:{" "}
            <span className="text-zinc-200">{info.role}</span>
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Members</h2>
          <ul className="divide-y divide-zinc-800 text-sm">
            {members.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 py-3">
                <span className="flex-1">
                  <span className="font-medium">{m.name}</span>{" "}
                  <span className="text-zinc-500">{m.email}</span>
                </span>
                {isAdmin && m.userId !== me?.id ? (
                  <>
                    <select
                      value={m.role}
                      onChange={(e) =>
                        act(() =>
                          fetch(`/api/workspace/members/${m.userId}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ role: e.target.value }),
                          })
                        )
                      }
                      className="rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-1"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        act(() =>
                          fetch(`/api/workspace/members/${m.userId}`, {
                            method: "DELETE",
                          })
                        )
                      }
                      className="text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <span className="text-zinc-500">{m.role}</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {isAdmin && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Invite links</h2>
            <div className="flex items-center gap-2 text-sm">
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-1"
              >
                <option value="viewer">viewer</option>
                <option value="editor">editor</option>
                <option value="admin">admin</option>
              </select>
              <button
                onClick={() =>
                  act(
                    () =>
                      fetch("/api/workspace/invites", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ role: inviteRole }),
                      }),
                    "Invite created — copy the link below."
                  )
                }
                className="rounded-lg bg-pink-600 px-3 py-1 font-medium text-white hover:bg-pink-500"
              >
                New invite link
              </button>
            </div>
            <ul className="flex flex-col gap-2 text-sm">
              {invitesList.map((inv) => (
                <li key={inv.token} className="flex items-center gap-3">
                  <code className="flex-1 truncate rounded bg-zinc-900 px-2 py-1 text-xs">
                    {typeof window !== "undefined"
                      ? `${window.location.origin}/invite/${inv.token}`
                      : `/invite/${inv.token}`}
                  </code>
                  <span className="text-zinc-500">{inv.role}</span>
                  <span className="text-zinc-600">
                    expires {inv.expiresAt.slice(0, 10)}
                  </span>
                </li>
              ))}
              {invitesList.length === 0 && (
                <li className="text-zinc-600">No open invites.</li>
              )}
            </ul>
          </section>
        )}

        {isAdmin && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Data</h2>
            <div className="flex gap-3 text-sm">
              <a
                href="/api/workspace/export"
                className="rounded-lg border border-zinc-700 px-3 py-1 hover:border-zinc-500"
              >
                Export workspace data (JSON)
              </a>
              <a
                href="/api/workspace/audit?format=csv"
                className="rounded-lg border border-zinc-700 px-3 py-1 hover:border-zinc-500"
              >
                Download audit log (CSV)
              </a>
            </div>
          </section>
        )}

        {info.role === "owner" && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-red-400">Danger zone</h2>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Delete this workspace and ALL its decks, files and members? This cannot be undone."
                  )
                ) {
                  act(() => fetch("/api/workspace", { method: "DELETE" })).then(
                    () => router.push("/")
                  );
                }
              }}
              className="w-fit rounded-lg border border-red-500/50 px-3 py-1 text-sm text-red-400 hover:bg-red-500/10"
            >
              Delete workspace
            </button>
          </section>
        )}

        {msg && <p className="text-sm text-zinc-400">{msg}</p>}
      </div>
    </div>
  );
}
