"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { setSpiritIncluded } from "@/app/admin/spirit-vault/actions";

export interface SpiritRow {
  id: string;
  recordStatus: string;
  publicationStatus: string;
  hasVoice: boolean;
  name: string;
  category: string | null;
  proof: string;
}

type Filter = "all" | "live" | "draft" | "needs-voice";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "draft", label: "Draft" },
  { key: "needs-voice", label: "Needs Voice" },
];

function matchesFilter(row: SpiritRow, filter: Filter): boolean {
  const live = row.publicationStatus === "PUBLISHED" && row.recordStatus === "PUBLISHED";
  switch (filter) {
    case "all": return true;
    case "live": return live;
    case "draft": return row.recordStatus === "DRAFT";
    case "needs-voice": return !row.hasVoice;
  }
}

export function SpiritListTable({ items }: { items: SpiritRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, startTransition] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const filtered = items.filter((i) => matchesFilter(i, filter));

  function toggle(id: string, currentlyIncluded: boolean) {
    setTogglingId(id);
    startTransition(async () => {
      await setSpiritIncluded(id, !currentlyIncluded);
      setTogglingId(null);
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1">
        {FILTERS.map((f) => {
          const count = items.filter((i) => matchesFilter(i, f.key)).length;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={
                "rounded-full px-3 py-1 text-xs transition-colors " +
                (active
                  ? "bg-copper/20 text-copper-soft"
                  : "bg-surface text-muted hover:text-ink-text")
              }
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-3 py-2 font-medium">Include</th>
              <th className="px-3 py-2 font-medium">Bottle</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Proof</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Voice</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted">
                  No spirits match this filter.
                </td>
              </tr>
            )}
            {filtered.map((i) => {
              const live = i.publicationStatus === "PUBLISHED" && i.recordStatus === "PUBLISHED";
              const included = i.recordStatus !== "DRAFT";
              const isToggling = togglingId === i.id;
              return (
                <tr key={i.id} className="border-b border-line/60 last:border-0 hover:bg-surface/60">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={included}
                      disabled={pending && isToggling}
                      onChange={() => toggle(i.id, included)}
                      className="accent-copper-soft"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/spirit-vault/${i.id}`} className="text-ink-text hover:text-copper-soft">
                      {i.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted">{i.category}</td>
                  <td className="tnum px-3 py-2 text-muted">{i.proof}</td>
                  <td className="px-3 py-2">
                    <span className={live ? "text-health-green" : "text-muted"}>
                      {live ? "Published" : i.recordStatus === "DRAFT" ? "Draft" : "Reviewed"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted">{i.hasVoice ? "Yes" : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
