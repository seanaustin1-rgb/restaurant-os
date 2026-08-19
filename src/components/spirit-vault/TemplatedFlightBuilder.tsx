"use client";

import { useState } from "react";
import type { FlightTemplate } from "@/lib/spirit-vault/flight-templates";
import { SpiritFlightCreateForm, type FlightPourOption } from "@/components/spirit-vault/SpiritFlightCreateForm";

// Phase 2 (Claude lane): template picker in front of the existing flight builder.
// Choosing a template preloads its through-line as the flight description and shows
// its slot guidance; staff then select up to 4 pours and save as DRAFT. Rule-based
// candidate filtering/grouping wires onto Codex's candidate resolver next.

type Choice = FlightTemplate | "blank" | null;

export function TemplatedFlightBuilder({ pours, templates }: { pours: FlightPourOption[]; templates: FlightTemplate[] }) {
  const [choice, setChoice] = useState<Choice>(null);

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

        {launch.length > 0 && <TemplateGrid templates={launch} onPick={setChoice} />}
        {more.length > 0 && (
          <div>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">More templates</p>
            <TemplateGrid templates={more} onPick={setChoice} />
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

      {template && (
        <div className="rounded-lg border border-line px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            Build toward these {template.slots.length === 1 ? "picks" : "steps"} (up to {template.maxPours} pours)
          </p>
          <ol className="mt-2 space-y-1.5">
            {template.slots.map((slot) => (
              <li key={slot.key} className="flex gap-2 text-sm">
                <span className="shrink-0 font-mono text-xs text-copper-soft">{slot.label}</span>
                <span className="text-muted">— {slot.itemNote}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <SpiritFlightCreateForm
        pours={pours}
        initial={
          template
            ? { name: "", description: template.throughLine, status: "DRAFT", items: [] }
            : undefined
        }
      />
    </div>
  );
}

function TemplateGrid({ templates, onPick }: { templates: FlightTemplate[]; onPick: (t: FlightTemplate) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {templates.map((t) => (
        <button
          key={t.key}
          onClick={() => onPick(t)}
          className="rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:border-copper-dim"
        >
          <div className="font-display text-lg text-ink-text">{t.name}</div>
          <div className="mt-1 text-sm text-muted">{t.description}</div>
        </button>
      ))}
    </div>
  );
}
