"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import type { FlightTemplate } from "@/lib/spirit-vault/flight-templates";
import {
  matchesFlightTemplateRules,
  type FlightCandidatePour,
} from "@/lib/spirit-vault/flight-template-candidates";
import {
  saveCustomTemplate,
  deleteCustomTemplate,
  type CustomTemplateSlotInput,
} from "@/app/admin/spirit-vault/flights/template-actions";

// ── Available categories for the slot rule builder ──

const AVAILABLE_CATEGORIES = [
  "Bourbon", "Rye", "Scotch", "Irish", "Japanese", "Canadian",
  "American Whiskey", "American Single Malt", "Tennessee", "Blended",
  "Agave", "Rum", "Vodka", "Gin",
] as const;

const AUTO_ORDER_OPTIONS = [
  { value: "slot-order", label: "Slot order (manual)" },
  { value: "proof-asc", label: "Proof ascending" },
  { value: "proof-desc", label: "Proof descending" },
] as const;

// ── Template editor form state ──

interface SlotForm {
  key: string;
  label: string;
  itemNote: string;
  proofMin: string;
  proofMax: string;
  categories: string[];
  searchTerms: string;
}

function emptySlot(index: number): SlotForm {
  return { key: `slot-${index}`, label: "", itemNote: "", proofMin: "", proofMax: "", categories: [], searchTerms: "" };
}

function slotFormToInput(s: SlotForm): CustomTemplateSlotInput {
  return {
    key: s.key,
    label: s.label,
    itemNote: s.itemNote,
    rules: {
      ...(s.proofMin ? { proofMin: Number(s.proofMin) } : {}),
      ...(s.proofMax ? { proofMax: Number(s.proofMax) } : {}),
      ...(s.categories.length ? { categories: s.categories } : {}),
      ...(s.searchTerms.trim() ? { searchTerms: s.searchTerms.split(",").map((t) => t.trim()).filter(Boolean) } : {}),
    },
  };
}

function templateToForm(t: FlightTemplate): {
  name: string;
  description: string;
  throughLine: string;
  autoOrder: string;
  slots: SlotForm[];
} {
  return {
    name: t.name,
    description: t.description,
    throughLine: t.throughLine,
    autoOrder: t.autoOrder,
    slots: t.slots.map((s) => ({
      key: s.key,
      label: s.label,
      itemNote: s.itemNote,
      proofMin: s.rules.proofMin?.toString() ?? "",
      proofMax: s.rules.proofMax?.toString() ?? "",
      categories: s.rules.categories ?? [],
      searchTerms: s.rules.searchTerms?.join(", ") ?? "",
    })),
  };
}

// ── Main component ──

export function CustomTemplateList({
  templates,
  pours,
}: {
  templates: FlightTemplate[];
  pours: FlightCandidatePour[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      {templates.map((t) => {
        const dbId = t.key.replace(/^custom-/, "");
        const matchCount = pours.filter((p) =>
          t.slots.some((slot) => matchesFlightTemplateRules(p, slot.rules)),
        ).length;

        if (editing === dbId) {
          return (
            <TemplateEditorCard
              key={dbId}
              dbId={dbId}
              initial={templateToForm(t)}
              pours={pours}
              onClose={() => { setEditing(null); router.refresh(); }}
            />
          );
        }

        return (
          <div key={dbId} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-lg text-ink-text">{t.name}</div>
                <div className="mt-1 text-sm text-muted">{t.description}</div>
                <div className="mt-1 font-mono text-[10px] text-muted/70">
                  {t.slots.length} slot{t.slots.length === 1 ? "" : "s"} · {matchCount} eligible pour{matchCount === 1 ? "" : "s"}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setEditing(dbId)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted hover:border-copper-dim hover:text-copper-soft"
                  title="Edit template"
                >
                  <Pencil size={14} />
                </button>
                <DeleteButton dbId={dbId} onDone={() => router.refresh()} />
              </div>
            </div>
            {t.slots.length > 0 && (
              <div className="mt-3 space-y-1">
                {t.slots.map((slot) => (
                  <div key={slot.key} className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-copper-soft/80">{slot.label}</span>
                    {slot.rules.categories?.length ? (
                      <span className="text-muted">({slot.rules.categories.join(", ")})</span>
                    ) : null}
                    {slot.rules.proofMin != null || slot.rules.proofMax != null ? (
                      <span className="text-muted">
                        {slot.rules.proofMin ?? "—"}–{slot.rules.proofMax ?? "—"} proof
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {creating ? (
        <TemplateEditorCard
          pours={pours}
          onClose={() => { setCreating(false); router.refresh(); }}
        />
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line p-4 text-sm text-muted transition-colors hover:border-copper-dim hover:text-copper-soft"
        >
          <Plus size={16} /> Create custom template
        </button>
      )}
    </div>
  );
}

// ── Delete button ──

function DeleteButton({ dbId, onDone }: { dbId: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm("Delete this template?")) return;
        start(async () => {
          await deleteCustomTemplate(dbId);
          onDone();
        });
      }}
      disabled={pending}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted hover:border-red-500/40 hover:text-red-300 disabled:opacity-50"
      title="Delete template"
    >
      <Trash2 size={14} />
    </button>
  );
}

// ── Template editor card ──

function TemplateEditorCard({
  dbId,
  initial,
  pours,
  onClose,
}: {
  dbId?: string;
  initial?: ReturnType<typeof templateToForm>;
  pours: FlightCandidatePour[];
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [throughLine, setThroughLine] = useState(initial?.throughLine ?? "");
  const [autoOrder, setAutoOrder] = useState(initial?.autoOrder ?? "slot-order");
  const [slots, setSlots] = useState<SlotForm[]>(initial?.slots ?? [emptySlot(0)]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function updateSlot(index: number, patch: Partial<SlotForm>) {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function toggleCategory(index: number, cat: string) {
    setSlots((prev) =>
      prev.map((s, i) =>
        i === index
          ? { ...s, categories: s.categories.includes(cat) ? s.categories.filter((c) => c !== cat) : [...s.categories, cat] }
          : s,
      ),
    );
  }

  function removeSlot(index: number) {
    if (slots.length <= 1) return;
    setSlots((prev) => prev.filter((_, i) => i !== index));
  }

  function addSlot() {
    setSlots((prev) => [...prev, emptySlot(prev.length)]);
  }

  // Live match count — strip nulls from form rules to match FlightTemplateRules shape
  const matchCount = pours.filter((p) =>
    slots.some((s) => {
      const { rules } = slotFormToInput(s);
      return matchesFlightTemplateRules(p, {
        ...(rules.proofMin != null ? { proofMin: rules.proofMin } : {}),
        ...(rules.proofMax != null ? { proofMax: rules.proofMax } : {}),
        ...(rules.categories?.length ? { categories: rules.categories } : {}),
        ...(rules.searchTerms?.length ? { searchTerms: rules.searchTerms } : {}),
      });
    }),
  ).length;

  function save() {
    setError(null);
    start(async () => {
      try {
        await saveCustomTemplate({
          id: dbId,
          name,
          description,
          throughLine,
          autoOrder: autoOrder as "slot-order" | "proof-asc" | "proof-desc",
          slots: slots.map(slotFormToInput),
        });
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="rounded-lg border border-copper-dim bg-surface p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-ink-text">{dbId ? "Edit template" : "New template"}</h3>
        <button onClick={onClose} className="text-muted hover:text-ink-text"><X size={16} /></button>
      </div>

      {error && <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-muted">Name <span className="text-copper-soft">*</span></span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rum Tour"
            className="mt-1 w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-ink-text outline-none focus:border-copper-soft"
          />
        </label>
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-muted">Auto-order</span>
          <select
            value={autoOrder}
            onChange={(e) => setAutoOrder(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-ink-text outline-none focus:border-copper-soft"
          >
            {AUTO_ORDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="block text-[11px] uppercase tracking-wider text-muted">Description</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="One-line description for the picker card"
          className="mt-1 w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-ink-text outline-none focus:border-copper-soft"
        />
      </label>

      <label className="block">
        <span className="block text-[11px] uppercase tracking-wider text-muted">Through-line</span>
        <textarea
          rows={2}
          value={throughLine}
          onChange={(e) => setThroughLine(e.target.value)}
          placeholder="The narrative — why this flight, what to experience"
          className="mt-1 w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-ink-text outline-none focus:border-copper-soft"
        />
      </label>

      <div className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          Slots ({slots.length}) · {matchCount} eligible pour{matchCount === 1 ? "" : "s"}
        </p>
        {slots.map((slot, i) => (
          <div key={i} className="rounded-md border border-line bg-ink p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-copper-soft">Slot {i + 1}</span>
              {slots.length > 1 && (
                <button onClick={() => removeSlot(i)} className="text-muted hover:text-red-300"><X size={14} /></button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={slot.label}
                onChange={(e) => updateSlot(i, { label: e.target.value })}
                placeholder="Slot label (e.g. 80–100 proof)"
                className="rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink-text outline-none focus:border-copper-soft"
              />
              <input
                value={slot.itemNote}
                onChange={(e) => updateSlot(i, { itemNote: e.target.value })}
                placeholder="Item note preset"
                className="rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink-text outline-none focus:border-copper-soft"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_CATEGORIES.map((cat) => {
                const active = slot.categories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(i, cat)}
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors ${
                      active
                        ? "border-copper-soft bg-copper/15 text-copper-soft"
                        : "border-line text-muted/70 hover:border-copper-dim hover:text-muted"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                value={slot.proofMin}
                onChange={(e) => updateSlot(i, { proofMin: e.target.value })}
                placeholder="Min proof"
                type="number"
                className="rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink-text outline-none focus:border-copper-soft"
              />
              <input
                value={slot.proofMax}
                onChange={(e) => updateSlot(i, { proofMax: e.target.value })}
                placeholder="Max proof"
                type="number"
                className="rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink-text outline-none focus:border-copper-soft"
              />
              <input
                value={slot.searchTerms}
                onChange={(e) => updateSlot(i, { searchTerms: e.target.value })}
                placeholder="Search terms (comma-separated)"
                className="rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink-text outline-none focus:border-copper-soft"
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addSlot}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-line py-2 text-xs text-muted hover:border-copper-dim hover:text-copper-soft"
        >
          <Plus size={13} /> Add slot
        </button>
      </div>

      <button
        onClick={save}
        disabled={pending || !name.trim() || slots.every((s) => !s.label.trim())}
        className="inline-flex items-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-4 py-2 text-sm text-copper-soft hover:bg-copper/20 disabled:opacity-50"
      >
        {pending ? "Saving..." : dbId ? "Save changes" : "Create template"}
      </button>
    </div>
  );
}
