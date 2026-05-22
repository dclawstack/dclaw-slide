"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Palette, Trash2 } from "lucide-react";

import { api, ApiError, type BrandKit, type BrandReferenceSummary } from "@/lib/api";
import { useBrand, useToast } from "@/components/providers";

const HEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

export default function BrandKitPage() {
  const toast = useToast();
  const brandCtx = useBrand();
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [saving, setSaving] = useState(false);

  const [references, setReferences] = useState<BrandReferenceSummary[]>([]);
  const [refTitle, setRefTitle] = useState("");
  const [refBody, setRefBody] = useState("");
  const [addingRef, setAddingRef] = useState(false);

  const load = useCallback(async () => {
    try {
      const [k, refs] = await Promise.all([api.getBrandKit(), api.listBrandReferences()]);
      setKit(k);
      setReferences(refs);
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Failed to load brand kit", "error");
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAddReference(e: React.FormEvent) {
    e.preventDefault();
    if (!refTitle.trim() || !refBody.trim()) return;
    setAddingRef(true);
    try {
      await api.createBrandReference({
        title: refTitle.trim(),
        body: refBody.trim(),
        source_kind: "manual",
      });
      setRefTitle("");
      setRefBody("");
      setReferences(await api.listBrandReferences());
      toast.push("Reference added", "success");
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Add failed", "error");
    } finally {
      setAddingRef(false);
    }
  }

  async function handleDeleteReference(id: string) {
    try {
      await api.deleteBrandReference(id);
      setReferences((prev) => prev.filter((r) => r.id !== id));
      toast.push("Reference removed", "info");
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Delete failed", "error");
    }
  }

  if (!kit) {
    return (
      <main className="min-h-screen bg-slate-50 p-12 text-center text-slate-500">
        Loading brand kit…
      </main>
    );
  }

  function update<K extends keyof BrandKit>(field: K, value: BrandKit[K]) {
    setKit((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function handleSave() {
    if (!kit) return;
    for (const field of ["primary_color", "accent_color", "neutral_color"] as const) {
      if (!HEX.test(kit[field])) {
        toast.push(`${field.replace("_", " ")} must be a valid hex (e.g. #EC4899)`, "error");
        return;
      }
    }
    setSaving(true);
    try {
      const updated = await api.updateBrandKit({
        name: kit.name,
        primary_color: kit.primary_color,
        accent_color: kit.accent_color,
        neutral_color: kit.neutral_color,
        font_heading: kit.font_heading,
        font_body: kit.font_body,
        logo_url: kit.logo_url,
        voice_dos: kit.voice_dos,
        voice_donts: kit.voice_donts,
      });
      setKit(updated);
      await brandCtx.refresh(); // cascades new CSS vars across the app
      toast.push("Brand kit saved", "success");
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <span className="flex items-center gap-2 text-sm text-slate-500">
            <Palette className="h-4 w-4" />
            Brand kit
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Brand kit</h1>
          <p className="mt-2 text-sm text-slate-600">
            Lock the colors, fonts and voice every deck inherits. Applied across all presentations
            in this workspace.
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Identity
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Brand name"
              value={kit.name}
              onChange={(v) => update("name", v)}
              placeholder="Acme Inc."
            />
            <Field
              label="Logo URL"
              value={kit.logo_url}
              onChange={(v) => update("logo_url", v)}
              placeholder="https://…/logo.svg"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Palette
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <ColorField label="Primary" value={kit.primary_color} onChange={(v) => update("primary_color", v)} />
            <ColorField label="Accent" value={kit.accent_color} onChange={(v) => update("accent_color", v)} />
            <ColorField label="Neutral" value={kit.neutral_color} onChange={(v) => update("neutral_color", v)} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Typography
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Heading font stack"
              value={kit.font_heading}
              onChange={(v) => update("font_heading", v)}
              placeholder='"Inter", system-ui, sans-serif'
            />
            <Field
              label="Body font stack"
              value={kit.font_body}
              onChange={(v) => update("font_body", v)}
              placeholder='"Inter", system-ui, sans-serif'
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Voice
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextareaField
              label="Do"
              value={kit.voice_dos}
              onChange={(v) => update("voice_dos", v)}
              placeholder="Be specific. Show numbers."
            />
            <TextareaField
              label="Don't"
              value={kit.voice_donts}
              onChange={(v) => update("voice_donts", v)}
              placeholder="Avoid jargon. Skip filler words."
            />
          </div>
        </section>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-rose-500 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save brand kit"}
          </button>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-rose-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Brand references (RAG)
            </h2>
            <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
              {references.length} stored
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Paste excerpts of past decks, docs, or your website. Every AI-generated
            deck retrieves the top matches and conditions its output on them — that's
            how new decks inherit your voice and vocabulary.
          </p>

          <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto]" onSubmit={handleAddReference}>
            <input
              type="text"
              value={refTitle}
              onChange={(e) => setRefTitle(e.target.value)}
              placeholder="Title (e.g. Q3 board deck)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
            />
            <input
              type="text"
              value={refBody}
              onChange={(e) => setRefBody(e.target.value)}
              placeholder="A paragraph of brand-voice text…"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={addingRef || !refTitle.trim() || !refBody.trim()}
              className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
            >
              {addingRef ? "Adding…" : "Add"}
            </button>
          </form>

          {references.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {references.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium text-slate-900">{r.title}</div>
                    <div className="text-xs text-slate-500">
                      {r.source_kind} · {r.body_chars.toLocaleString()} chars ·{" "}
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteReference(r.id)}
                    className="rounded p-1 text-rose-500 hover:bg-rose-50"
                    title="Delete reference"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-12 cursor-pointer rounded-md border border-slate-300"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none"
        />
      </div>
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none"
      />
    </label>
  );
}
