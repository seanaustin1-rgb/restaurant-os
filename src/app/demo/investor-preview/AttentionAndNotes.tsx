"use client";

/**
 * PROTOTYPE (preview only): "Attention Required" zone + contextual dated notes.
 *
 * Demonstrates the trust-layer idea — an over-target metric carries its own dated
 * "why" note, turning a scary red alert into a managed event so an investor sees
 * the explanation without having to call. Notes here are client-state only (no
 * persistence) — the real version needs a MetricNote model + server action.
 */
import { useState } from "react";
import { AlertTriangle, CheckCircle2, MessageSquarePlus, X } from "lucide-react";

export type AttentionItem = {
  id: string;
  label: string;
  severity: "red" | "yellow";
  readout: string;
  systemNote?: string;
};

export type UserNote = { date: string; text: string };

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AttentionAndNotes({
  items,
  initialNotes,
}: {
  items: AttentionItem[];
  initialNotes: Record<string, UserNote>;
}) {
  const [notes, setNotes] = useState<Record<string, UserNote>>(initialNotes);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState<string>(todayISO());
  const [draftText, setDraftText] = useState<string>("");

  function startNote(id: string) {
    setOpenFor(id);
    setDraftDate(todayISO());
    setDraftText("");
  }

  function saveNote(id: string) {
    const text = draftText.trim();
    if (!text) return;
    setNotes((prev) => ({ ...prev, [id]: { date: draftDate, text } }));
    setOpenFor(null);
  }

  if (items.length === 0) {
    return (
      <section className="mb-6 rounded-lg border border-emerald-500/40 bg-emerald-500/8 p-4 text-emerald-200">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <span className="text-sm font-semibold">Nothing needs attention this period.</span>
        </div>
      </section>
    );
  }

  const unmanaged = items.filter((i) => !notes[i.id]).length;

  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-orange-500/45 bg-orange-500/[0.06]">
      <header className="flex items-center justify-between gap-3 border-b border-orange-500/30 px-4 py-3">
        <div className="flex items-center gap-2 text-orange-200">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em]">Attention Required</span>
        </div>
        <span className="rounded-full border border-orange-500/40 px-2.5 py-0.5 text-xs font-semibold text-orange-200">
          {unmanaged > 0 ? `${unmanaged} unexplained` : "all explained"}
        </span>
      </header>

      <ul className="divide-y divide-white/5">
        {items.map((item) => {
          const note = notes[item.id];
          const managed = Boolean(note);
          return (
            <li key={item.id} className="px-4 py-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        managed ? "bg-amber-400" : item.severity === "red" ? "bg-orange-400" : "bg-amber-300"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-semibold text-white">{item.label}</span>
                    {managed && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Managed
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-300">{item.readout}</p>
                  {item.systemNote && <p className="mt-1 text-xs leading-5 text-slate-500">{item.systemNote}</p>}
                </div>

                {!managed && openFor !== item.id && (
                  <button
                    type="button"
                    onClick={() => startNote(item.id)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08]"
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" /> Add context
                  </button>
                )}
              </div>

              {managed && (
                <div className="mt-2.5 rounded-md border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-300/90">
                    {new Date(note.date + "T00:00:00").toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                  <p className="mt-0.5 text-sm leading-6 text-amber-50">{note.text}</p>
                </div>
              )}

              {openFor === item.id && (
                <div className="mt-2.5 rounded-md border border-white/12 bg-black/20 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs font-medium text-slate-400">
                      Date
                      <input
                        type="date"
                        value={draftDate}
                        onChange={(e) => setDraftDate(e.target.value)}
                        className="ml-2 rounded border border-white/15 bg-white/[0.04] px-2 py-1 text-xs text-slate-100 [color-scheme:dark]"
                      />
                    </label>
                  </div>
                  <textarea
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    rows={2}
                    autoFocus
                    placeholder="e.g. Unexpected HVAC repair ($1,200) hit OpEx this week — one-time, resolved."
                    className="mt-2 w-full resize-none rounded border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-400/50 focus:outline-none"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => saveNote(item.id)}
                      disabled={!draftText.trim()}
                      className="rounded-md bg-amber-400/90 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Save context
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenFor(null)}
                      className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/[0.06]"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
