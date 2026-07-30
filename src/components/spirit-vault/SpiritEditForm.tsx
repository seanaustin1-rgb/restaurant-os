"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import type { SpiritLifecycleStatus } from "@prisma/client";
import { updateSpirit } from "@/app/admin/spirit-vault/actions";

const FLAVOR_AXES = ["Sweet", "Oak", "Spice", "Fruit", "Smoke", "Earth", "Herbal"] as const;
const STATUSES: SpiritLifecycleStatus[] = ["DRAFT", "REVIEWED", "PUBLISHED"];

export interface SpiritEditInitial {
  id: string;
  whyWeCarry: string;
  seanShort: string;
  notes: string;
  body: number | null;
  finish: number | null;
  flavor: Record<string, number>;
  topNotes: string[];
  pairings: string[];
  recordStatus: SpiritLifecycleStatus;
  publicationStatus: SpiritLifecycleStatus;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}
const nullIfBlank = (s: string): string | null => (s.trim() === "" ? null : s.trim());

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted">
        <span>{label}</span>
        <span className="tnum text-copper-soft">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-copper-soft"
      />
    </label>
  );
}

function Textarea({ label, hint, value, onChange, rows = 3 }: { label: string; hint?: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-ink-text outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function SpiritEditForm({ initial }: { initial: SpiritEditInitial }) {
  const [whyWeCarry, setWhyWeCarry] = useState(initial.whyWeCarry);
  const [seanShort, setSeanShort] = useState(initial.seanShort);
  const [notes, setNotes] = useState(initial.notes);
  const [body, setBody] = useState(initial.body ?? 5);
  const [finish, setFinish] = useState(initial.finish ?? 5);
  const [flavor, setFlavor] = useState<Record<string, number>>({
    ...Object.fromEntries(FLAVOR_AXES.map((a) => [a, 5])),
    ...initial.flavor,
  });
  const [topNotes, setTopNotes] = useState<string[]>([
    initial.topNotes[0] ?? "",
    initial.topNotes[1] ?? "",
    initial.topNotes[2] ?? "",
  ]);
  const [pairings, setPairings] = useState(initial.pairings.join(", "));
  const [recordStatus, setRecordStatus] = useState<SpiritLifecycleStatus>(initial.recordStatus);
  const [publicationStatus, setPublicationStatus] = useState<SpiritLifecycleStatus>(initial.publicationStatus);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function setAxis(axis: string, v: number) {
    setFlavor((f) => ({ ...f, [axis]: v }));
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateSpirit({
          id: initial.id,
          whyWeCarry: nullIfBlank(whyWeCarry),
          seanShort: nullIfBlank(seanShort),
          notes: nullIfBlank(notes),
          body,
          finish,
          flavor,
          topNotes: topNotes.map((t) => t.trim()).filter(Boolean),
          pairings: pairings.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
          recordStatus,
          publicationStatus,
        });
        setSaved(true);
      } catch (e) {
        setError(errMsg(e));
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      {/* Sean's voice */}
      <div className="space-y-4 rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-medium text-ink-text">Your voice</h2>
        <Textarea label="Why we carry it" hint="Guest-facing. General merit - no fabricated venue claims." value={whyWeCarry} onChange={setWhyWeCarry} />
        <Textarea label="Curator cue" hint='Short quote shown above the drawers, e.g. "Ask for it neat."' value={seanShort} onChange={setSeanShort} rows={2} />
        <Textarea label="Sean's Notes" hint="Signed note in the gold drawer. Leave blank to hide it." value={notes} onChange={setNotes} />
      </div>

      {/* Flavor */}
      <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-medium text-ink-text">Flavor profile</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {FLAVOR_AXES.map((a) => (
            <Slider key={a} label={a} value={flavor[a] ?? 5} onChange={(v) => setAxis(a, v)} />
          ))}
          <Slider label="Body" value={body} onChange={setBody} />
          <Slider label="Finish" value={finish} onChange={setFinish} />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {topNotes.map((n, idx) => (
            <label key={idx} className="block">
              <span className="block text-[11px] uppercase tracking-wider text-muted">Top note {idx + 1}</span>
              <input
                value={n}
                onChange={(e) => setTopNotes((t) => t.map((x, i) => (i === idx ? e.target.value : x)))}
                className="mt-1 w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-ink-text outline-none focus:border-copper-soft"
              />
            </label>
          ))}
        </div>
        <Textarea label="Pairings" hint="Comma-separated." value={pairings} onChange={setPairings} rows={2} />
      </div>

      {/* Status */}
      <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-medium text-ink-text">Status</h2>
        <p className="text-xs text-muted">Publication cannot run ahead of the record status. Published shows on the guest vault.</p>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-[11px] uppercase tracking-wider text-muted">Record status</span>
            <select
              value={recordStatus}
              onChange={(e) => setRecordStatus(e.target.value as SpiritLifecycleStatus)}
              className="mt-1 w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-ink-text outline-none focus:border-copper-soft"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] uppercase tracking-wider text-muted">Publication</span>
            <select
              value={publicationStatus}
              onChange={(e) => setPublicationStatus(e.target.value as SpiritLifecycleStatus)}
              className="mt-1 w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-ink-text outline-none focus:border-copper-soft"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-4 py-2 text-sm text-copper-soft hover:bg-copper/20 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save"}
        </button>
        {saved && !pending && (
          <span className="inline-flex items-center gap-1 text-sm text-health-green">
            <Check size={14} /> Saved
          </span>
        )}
      </div>
    </div>
  );
}
