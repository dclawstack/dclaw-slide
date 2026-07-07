"use client";

import { useRouter } from "next/navigation";

export function LogoutButton({ email }: { email: string }) {
  const router = useRouter();
  return (
    <span className="flex items-center gap-3 text-sm text-zinc-500">
      <span>{email}</span>
      <button
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.push("/login");
          router.refresh();
        }}
        className="rounded-lg border border-zinc-800 px-3 py-1 hover:bg-zinc-900"
      >
        Sign out
      </button>
    </span>
  );
}
