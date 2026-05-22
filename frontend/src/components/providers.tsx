"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

import { api, type BrandKit, type HealthInfo } from "@/lib/api";

// ──────────────────────────────────────────────────────────────────────────────
// Toast
// ──────────────────────────────────────────────────────────────────────────────

type ToastVariant = "success" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  push: (message: string, variant?: ToastVariant) => void;
}
const ToastContext = createContext<ToastContextValue>({ push: () => {} });

let nextToastId = 1;

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

function ToastViewport({
  toasts,
  dismiss,
}: {
  toasts: Toast[];
  dismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => {
        const styles =
          t.variant === "error"
            ? "border-rose-300 bg-rose-50 text-rose-800"
            : t.variant === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-slate-300 bg-white text-slate-800";
        const Icon = t.variant === "error" ? XCircle : t.variant === "success" ? CheckCircle2 : Info;
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-md items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-md ${styles}`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="rounded p-0.5 opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Brand kit CSS variables — cascaded onto :root so every page inherits them.
// ──────────────────────────────────────────────────────────────────────────────

interface BrandContextValue {
  brand: BrandKit | null;
  refresh: () => Promise<void>;
}
const BrandContext = createContext<BrandContextValue>({
  brand: null,
  refresh: async () => {},
});

export function useBrand(): BrandContextValue {
  return useContext(BrandContext);
}

function applyBrandVars(brand: BrandKit | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const accent = brand?.accent_color ?? "#EC4899";
  const primary = brand?.primary_color ?? "#0F172A";
  const neutral = brand?.neutral_color ?? "#F8FAFC";
  root.style.setProperty("--brand-accent", accent);
  root.style.setProperty("--brand-primary", primary);
  root.style.setProperty("--brand-neutral", neutral);
  root.style.setProperty("--brand-font-heading", brand?.font_heading ?? "Inter, system-ui, sans-serif");
  root.style.setProperty("--brand-font-body", brand?.font_body ?? "Inter, system-ui, sans-serif");
}

// ──────────────────────────────────────────────────────────────────────────────
// Version footer
// ──────────────────────────────────────────────────────────────────────────────

function VersionFooter({ health }: { health: HealthInfo | null }) {
  return (
    <footer className="border-t border-slate-200 bg-white/60 px-6 py-3 text-center text-xs text-slate-400">
      {health ? (
        <>
          {health.app} · v{health.version} · {health.db} ·{" "}
          <span className="text-slate-500">
            built by <a href="mailto:tharunidayara@gmail.com" className="underline-offset-2 hover:underline">Tharuni Dayara</a>
          </span>
        </>
      ) : (
        <>DClaw Slide</>
      )}
    </footer>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Root provider
// ──────────────────────────────────────────────────────────────────────────────

export function Providers({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [brand, setBrand] = useState<BrandKit | null>(null);
  const [health, setHealth] = useState<HealthInfo | null>(null);

  const push = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = nextToastId++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const k = await api.getBrandKit();
      setBrand(k);
      applyBrandVars(k);
    } catch {
      /* non-fatal: branding stays at defaults */
    }
  }, []);

  useEffect(() => {
    refresh();
    api.health().then(setHealth).catch(() => undefined);
  }, [refresh]);

  const toastValue = useMemo(() => ({ push }), [push]);
  const brandValue = useMemo(() => ({ brand, refresh }), [brand, refresh]);

  return (
    <BrandContext.Provider value={brandValue}>
      <ToastContext.Provider value={toastValue}>
        <div className="flex min-h-screen flex-col">
          <div className="flex-1">{children}</div>
          <VersionFooter health={health} />
        </div>
        <ToastViewport toasts={toasts} dismiss={dismiss} />
      </ToastContext.Provider>
    </BrandContext.Provider>
  );
}
