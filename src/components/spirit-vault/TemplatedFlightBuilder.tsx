"use client";

import { useMemo, useState } from "react";
import type { FlightTemplate } from "@/lib/spirit-vault/flight-templates";
import {
  groupCandidatesByTemplateSlot,
  matchesFlightTemplateRules,
  type FlightCandidatePour,
} from "@/lib/spirit-vault/flight-template-candidates";
import { SpiritFlightCreateForm, type FlightPourOption } from "@/components/spirit-vault/SpiritFlightCreateForm";

// Phase 2 Flight Builder: template picker in front of the existing flight
// builder. Choosing a template groups the eligible pours by slot (rule
// filtering, Toast-ranked) and pre-fills the template's per-slot item notes.
// Staff pick up to 4 pours and save as DRAFT. "Build from scratch" bypasses
// slot guidance and shows the full pool.

type Choice = FlightTemplate | "blank" | null;

export function TemplatedFlightBuilder({
  pours,
  templates,
}: {
  pours: FlightCandidatePour[];
  templates: FlightTemplate[];
}) {
  const [choice, setChoice] = useState<Choice>(null);

  // Downcast candidates to the FlightPourOption the form accepts (it's a
  // strict subset — drop the extra resolver fields).
  const formPours: FlightPourOption[] = useMemo(
    () =>
      pours.map((p) => ({
        venueSpiritId: p.venueSpiritId,
        spiritPourId: p.spiritPourId,
        name: p.name,
        category: p.category,
        pourLabel: p.pourLabel,
        pourSizeOz: p.pourSizeOz,
        priceUsd: p.priceUsd,
        oneOzPriceUsd: p.oneOzPriceUsd,
        suggestedBites: p.suggestedBites,
      })),
    [pours],
  );

  if (choice === null) {
    const launch = templates.filter((t) => t.launch);
    const more = templates.filter((t) => !t.launch);
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-lg text-ink-text">Start from a template</h2>
          <p className="mt-1 text-sm text-muted">
            A template sets the through-line and the shape of the flight. You still pick the pours and can edit every word
            before publishing.
          </p>
        </div>

        {launch.length > 0 && <TemplateGrid templates={launch} pours={pours} onPick={setChoice} />}
        {more.length > 0 && (
          <div>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">More templates</p>
            <TemplateGrid templates={more} pours={pours} onPick={setChoice} />
          </div>
        )}

        <button
          onClick={() => setChoice("blank")}
          className="w-full rounded-lg border border-dashed border-line px-4 py-3 text-sm text-muted hover:border-copper-dim hover:text-copper-soft"
        >
          Or build from scratch →
        </button>
      </div>
    );
  }

  const template = choice === "blank" ? null : choice;

  // Compute per-slot candidate grouping when a template is active.
  const grouped = useMemo(
    () => (template ? groupCandidatesByTemplateSlot(template, pours) : null),
    [template, pours],
  );

  // Build a map of slot key → item note for the template preset.
  const slotNoteMap = useMemo(() => {
    if (!template) return null;
    const map = new Map<string, string>();
    for (const slot of template.slots) {
      if (slot.itemNote) map.set(slot.key, slot.itemNote);
    }
    return map;
  }, [template]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-copper-soft">
            {template ? `Template · ${template.name}` : "Building from scratch"}
          </p>
          {template && <p className="mt-1 max-w-2xl text-sm italic text-ink-text-soft">{template.throughLine}</p>}
        </div>
        <button onClick={() => setChoice(null)} className="shrink-0 font-mono text-xs text-muted hover:text-copper-soft">
          ← Change template
        </button>
      </div>

      {grouped && (
        <SlotGuide grouped={grouped} />
      )}

      <SpiritFlightCreateForm
        pours={formPours}
        slotGroups={grouped?.slots}
        slotNoteMap={slotNoteMap}
        initial={
          template
            ? { name: "", description: template.throughLine, status: "DRAFT", items: [] }
            : undefined
        }
      />
    </div>
  );
}

function SlotGuide({ grouped }: { grouped: ReturnType<typeof groupCandidatesByTemplateSlot> }) {
  return (
    <div className="rounded-lg border border-line px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
        Build toward these {grouped.slots.length === 1 ? "picks" : "steps"} (up to 4 pours)
      </p>
      <ol className="mt-2 space-y-1.5">
        {grouped.slots.map((group) => (
          <li key={group.slot.key} className="flex gap-2 text-sm">
            <span className="shrink-0 font-mono text-xs text-copper-soft">{group.slot.label}</span>
            <span className="text-muted">— {group.slot.itemNote}</span>
            <span className="ml-auto shrink-0 text-xs text-muted/70">
              {group.candidates.length === 0 ? (
                <span className="text-amber-400/80">no matches in vault</span>
              ) : (
                `${group.candidates.length} eligible`
              )}
            </span>
          </li>
        ))}
      </ol>
      {grouped.emptySlotKeys.length > 0 && (
        <p className="mt-2 text-xs italic text-amber-400/60">
          Some slots have no eligible pours — add bottles or adjust proof, and they will fill automatically.
        </p>
      )}
    </div>
  );
}

function TemplateGrid({
  templates,
  pours,
  onPick,
}: {
  templates: FlightTemplate[];
  pours: FlightCandidatePour[];
  onPick: (t: FlightTemplate) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {templates.map((t) => {
        // Quick match count so managers see vault coverage before picking.
        const matchCount = pours.filter((p) =>
          t.slots.some((slot) => matchesFlightTemplateRules(p, slot.rules)),
        ).length;

        return (
          <button
            key={t.key}
            onClick={() => onPick(t)}
            className="rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:border-copper-dim"
          >
            <div className="font-display text-lg text-ink-text">{t.name}</div>
            <div className="mt-1 text-sm text-muted">{t.description}</div>
            <div className="mt-2 font-mono text-[10px] text-muted/70">
              {matchCount} eligible pour{matchCount === 1 ? "" : "s"}
            </div>
          </button>
        );
      })}
    </div>
  );
}
