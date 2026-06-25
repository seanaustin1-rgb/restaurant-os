"use client";

import { useState, useTransition } from "react";
import { Sparkles, Plus, X } from "lucide-react";
import type { RuleSuggestion } from "@/lib/categorization/suggestions";
import { acceptRuleSuggestion, dismissRuleSuggestion } from "@/app/settings/rules/actions";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

export function RuleSuggestions({ suggestions }: { suggestions: RuleSuggestion[] }) {
  const [list, setList] = useState<RuleSuggestion[]>(suggestions);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (list.length === 0) return null;

  function act(key: string, fn: () => Promise<void>) {
    setError(null);
    setBusy(key);
    startTransition(async () => {
      try {
        await fn();
        setList((l) => l.filter((s) => s.key !== key));
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <div className="rounded-lg border border-copper-dim/60 bg-copper/[0.06] p-3">
      <div className="mb-2 flex items-center gap-1.5 text-sm text-copper-soft">
        <Sparkles size={14} />
        <span className="font-medium">Suggested rules</span>
        <span className="text-xs text-muted">— from transactions you&rsquo;ve categorized by hand</span>
      </div>
      {error && (
        <div className="mb-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}
      <ul className="space-y-2">
        {list.map((s) => (
          <li
            key={s.key}
            className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 text-sm">
              <span className="text-ink-text">
                Tag <span className="font-mono text-copper-soft">{s.signature}</span> →{" "}
                <span className="text-ink-text">{s.categoryName}</span>
              </span>
              <div className="mt-0.5 truncate text-xs text-muted">
                {s.count} categorized this way · e.g. {s.sample}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => act(s.key, () => acceptRuleSuggestion(s.signature, s.categoryId))}
                disabled={busy === s.key}
                className="inline-flex items-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-3 py-1.5 text-sm text-copper-soft hover:bg-copper/20 disabled:opacity-50"
              >
                <Plus size={14} /> Create rule
              </button>
              <button
                onClick={() => act(s.key, () => dismissRuleSuggestion(s.key))}
                disabled={busy === s.key}
                title="Dismiss — don't suggest this again"
                className="inline-flex items-center rounded-md border border-line px-2 py-1.5 text-muted hover:text-ink-text disabled:opacity-50"
              >
                <X size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
