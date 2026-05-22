import { type ReactNode } from "react";

/** Single shimmering rectangle. Drop-in placeholder while data loads. */
export function Skeleton({
  className = "",
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-slate-100 ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)",
        backgroundSize: "200% 100%",
      }}
      aria-hidden="true"
    >
      <div className="absolute inset-0 animate-skeleton-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent bg-[length:200%_100%]" />
      {children}
    </div>
  );
}

/** 16:9 slide-shaped skeleton card with a title and bullets shimmer. */
export function SlideCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-slate-100">
        <div className="absolute inset-0 animate-skeleton-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent bg-[length:200%_100%]" />
        <div className="absolute inset-0 flex flex-col justify-center gap-3 p-6">
          <div className="h-6 w-2/3 rounded bg-slate-200" />
          <div className="h-3 w-1/2 rounded bg-slate-200" />
          <div className="h-3 w-3/5 rounded bg-slate-200" />
        </div>
      </div>
      <div className="mt-2 flex justify-between px-1">
        <div className="h-3 w-6 rounded bg-slate-100" />
        <div className="h-3 w-24 rounded bg-slate-100" />
      </div>
    </div>
  );
}

/** Deck row in the dashboard list. */
export function DeckRowSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="absolute inset-0 animate-skeleton-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent bg-[length:200%_100%]" />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-4 w-48 rounded bg-slate-200" />
          <div className="h-3 w-32 rounded bg-slate-100" />
        </div>
        <div className="h-3 w-16 rounded bg-slate-100" />
      </div>
    </div>
  );
}
