"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Plus, Trash2, X } from "lucide-react";
import type { SpiritLifecycleStatus } from "@prisma/client";
import {
  createSpiritFlight,
  updateSpiritFlight,
  deleteSpiritFlight,
  type CreateSpiritFlightResult,
} from "@/app/admin/spirit-vault/flights/actions";

export interface FlightPourOption {
  venueSpiritId: string;
  spiritPourId: string;
  name: string;
  category: string;
  pourLabel: string;
  pourSizeOz: number;
  priceUsd: number;
  oneOzPriceUsd: number;
  suggestedBites: string[];
}

interface SelectedFlightItem {
  venueSpiritId: string;
  spiritPourId: string;
  itemNote: string;
  bites: string;
}

function splitBites(s: string): string[] {
  return s
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 2);
}

export interface FlightFormInitial {
  name: string;
  description: string;
  status: SpiritLifecycleStatus;
  items: SelectedFlightItem[];
}

const STATUS_OPTIONS: SpiritLifecycleStatus[] = ["DRAFT", "REVIEWED", "PUBLISHED"];

function money(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

export function SpiritFlightCreateForm({
  pours,
  flightId,
  initial,
}: {
  pours: FlightPourOption[];
  flightId?: string;
  initial?: FlightFormInitial;
}) {
  const router = useRouter();
  const isEdit = Boolean(flightId);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<SpiritLifecycleStatus>(initial?.status ?? "DRAFT");
  const [selected, setSelected] = useState<SelectedFlightItem[]>(initial?.items ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<CreateSpiritFlightResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();

  const pourById = useMemo(() => new Map(pours.map((pour) => [pour.spiritPourId, pour])), [pours]);
  const selectedIds = useMemo(() => new Set(selected.map((item) => item.spiritPourId)), [selected]);
  const total = selected.reduce((sum, item) => sum + (pourById.get(item.spiritPourId)?.oneOzPriceUsd ?? 0), 0);

  function add(pour: FlightPourOption) {
    if (selectedIds.has(pour.spiritPourId) || selected.some((item) => item.venueSpiritId === pour.venueSpiritId)) return;
    if (selected.length >= 4) return;
    setSaved(null);
    setSelected((items) => [
      ...items,
      { venueSpiritId: pour.venueSpiritId, spiritPourId: pour.spiritPourId, itemNote: "", bites: (pour.suggestedBites ?? []).join(", ") },
    ]);
  }

  function remove(spiritPourId: string) {
    setSaved(null);
    setSelected((items) => items.filter((item) => item.spiritPourId !== spiritPourId));
  }

  function move(index: number, delta: -1 | 1) {
    setSaved(null);
    setSelected((items) => {
      const next = [...items];
      const target = index + delta;
      if (target < 0 || target >= next.length) return items;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function setNote(spiritPourId: string, itemNote: string) {
    setSaved(null);
    setSelected((items) => items.map((item) => (item.spiritPourId === spiritPourId ? { ...item, itemNote } : item)));
  }

  function setBites(spiritPourId: string, bites: string) {
    setSaved(null);
    setSelected((items) => items.map((item) => (item.spiritPourId === spiritPourId ? { ...item, bites } : item)));
  }

  function save() {
    setError(null);
    setSaved(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Enter a flight name.");
      return;
    }
    if (trimmedName.length > 120) {
      setError("Flight name must be 120 characters or fewer.");
      return;
    }
    if (selected.length < 2 || selected.length > 4) {
      setError("A flight needs 2–4 spirits.");
      return;
    }
    const payloadItems = selected.map((item) => ({
      venueSpiritId: item.venueSpiritId,
      spiritPourId: item.spiritPourId,
      itemNote: item.itemNote,
      pairingBites: splitBites(item.bites),
    }));
    startTransition(async () => {
      try {
        const result =
          isEdit && flightId
            ? await updateSpiritFlight({ id: flightId, name, description, status, items: payloadItems })
            : await createSpiritFlight({ name, description, status, items: payloadItems });
        setSaved(result);
        if (!isEdit) {
          setName("");
          setDescription("");
          setStatus("DRAFT");
          setSelected([]);
        }
        router.refresh();
      } catch (e) {
        setError(errMsg(e));
      }
    });
  }

  function onDelete() {
    if (!flightId) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this flight? This cannot be undone.")) return;
    setError(null);
    startDelete(async () => {
      try {
        await deleteSpiritFlight({ id: flightId });
        router.push("/admin/spirit-vault/flights");
        router.refresh();
      } catch (e) {
        setError(errMsg(e));
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
      {saved && (
        <div className="rounded-md border border-health-green/40 bg-health-green/10 px-3 py-2 text-sm text-health-green">
          {isEdit ? "Saved changes." : "Created flight."} Generated price: {money(saved.totalPriceUsd)}
        </div>
      )}

      <div className="grid gap-4 rounded-lg border border-line bg-surface p-4 sm:grid-cols-[1fr_160px]">
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-muted">Flight name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-ink-text outline-none focus:border-copper-soft"
          />
        </label>
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-muted">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SpiritLifecycleStatus)}
            className="mt-1 w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-ink-text outline-none focus:border-copper-soft"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="block text-[11px] uppercase tracking-wider text-muted">The through-line — why this flight</span>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Why you curated these together and what they express as a group — the experience beyond four 1 oz tastes. Shown on the placemat and guest page."
            className="mt-1 w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-ink-text outline-none placeholder:text-muted/70 focus:border-copper-soft"
          />
        </label>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-medium text-ink-text">Vault pours</h2>
            <p className="mt-1 text-xs text-muted">Each selected spirit contributes a 1 oz flight pour.</p>
          </div>
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 font-medium">Spirit</th>
                  <th className="px-3 py-2 font-medium">Source pour</th>
                  <th className="px-3 py-2 font-medium">1 oz</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {pours.map((pour) => {
                  const disabled = selectedIds.has(pour.spiritPourId) || selected.some((item) => item.venueSpiritId === pour.venueSpiritId) || selected.length >= 4;
                  return (
                    <tr key={pour.spiritPourId} className="border-b border-line/60 last:border-0 hover:bg-surface/60">
                      <td className="px-3 py-2">
                        <div className="text-ink-text">{pour.name}</div>
                        <div className="text-xs text-muted">{pour.category}</div>
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {pour.pourLabel} - {money(pour.priceUsd)}
                      </td>
                      <td className="tnum px-3 py-2 text-muted">{money(pour.oneOzPriceUsd)}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => add(pour)}
                          disabled={disabled}
                          title="Add to flight"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted hover:border-copper-soft hover:text-copper-soft disabled:opacity-40"
                        >
                          <Plus size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-3">
          <div className="rounded-lg border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-medium text-ink-text">Flight build</h2>
                <p className="mt-1 text-xs text-muted">{selected.length} selected</p>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-muted">Generated price</div>
                <div className="tnum text-xl text-copper-soft">{money(total)}</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {selected.length === 0 && <p className="text-sm text-muted">Add 2-4 spirits from the vault.</p>}
              {selected.map((item, index) => {
                const pour = pourById.get(item.spiritPourId);
                if (!pour) return null;
                return (
                  <div key={item.spiritPourId} className="rounded-md border border-line bg-ink p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm text-ink-text">{pour.name}</div>
                        <div className="text-xs text-muted">1 oz - {money(pour.oneOzPriceUsd)}</div>
                      </div>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => move(index, -1)} title="Move up" className="h-7 w-7 rounded border border-line text-muted hover:text-copper-soft">
                          <ArrowUp size={13} className="mx-auto" />
                        </button>
                        <button type="button" onClick={() => move(index, 1)} title="Move down" className="h-7 w-7 rounded border border-line text-muted hover:text-copper-soft">
                          <ArrowDown size={13} className="mx-auto" />
                        </button>
                        <button type="button" onClick={() => remove(item.spiritPourId)} title="Remove" className="h-7 w-7 rounded border border-line text-muted hover:text-red-300">
                          <X size={13} className="mx-auto" />
                        </button>
                      </div>
                    </div>
                    <input
                      value={item.itemNote}
                      onChange={(e) => setNote(item.spiritPourId, e.target.value)}
                      placeholder="Item note"
                      className="mt-2 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink-text outline-none focus:border-copper-soft"
                    />
                    <input
                      value={item.bites}
                      onChange={(e) => setBites(item.spiritPourId, e.target.value)}
                      placeholder="Bites — prep only, comma-separated"
                      title="Internal small-bite accompaniment (staff prep sheet, not guest-facing)"
                      className="mt-1.5 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-copper-soft/90 outline-none placeholder:text-muted focus:border-copper-soft"
                    />
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={save}
              disabled={pending || deleting || !name.trim() || selected.length < 2}
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-4 py-2 text-sm text-copper-soft hover:bg-copper/20 disabled:opacity-50"
            >
              {pending ? "Saving..." : isEdit ? "Save changes" : "Create flight"}
              {!pending && <Check size={14} />}
            </button>

            {isEdit && (
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting || pending}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-red-500/30 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete flight"}
                {!deleting && <Trash2 size={14} />}
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
