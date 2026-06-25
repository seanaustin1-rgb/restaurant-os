"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import type { RuleMatchType } from "@prisma/client";
import { Plus, Trash2, FlaskConical, Lock, GripVertical } from "lucide-react";
import { createRule, updateRule, deleteRule, reorderRules, previewCategorization } from "@/app/settings/rules/actions";

export interface RuleRow {
  id: string;
  matchType: RuleMatchType;
  pattern: string;
  categoryId: string;
  categoryName: string;
  priority: number;
  enabled: boolean;
  isSystem: boolean;
}

export interface CategoryOption {
  id: string;
  name: string;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

function matchLabel(r: { matchType: RuleMatchType; pattern: string }): string {
  if (r.matchType === "CHECK_MIN") return `check # ≥ ${r.pattern}`;
  return r.pattern;
}

// The order the engine evaluates rules in (priority asc, then longer/more-specific
// pattern, then id) — mirrors sortRules() in lib/categorization/rules.ts so the
// list reads top-to-bottom as "what runs first." Re-applied after every change.
function byEngineOrder(a: RuleRow, b: RuleRow): number {
  return a.priority - b.priority || b.pattern.length - a.pattern.length || (a.id < b.id ? -1 : 1);
}

export function RulesManager({ rows, categories }: { rows: RuleRow[]; categories: CategoryOption[] }) {
  const [list, setList] = useState<RuleRow[]>(rows);
  const [error, setError] = useState<string | null>(null);
  const [newPattern, setNewPattern] = useState("");
  const [newCategoryId, setNewCategoryId] = useState(categories[0]?.id ?? "");
  const [newMatchType, setNewMatchType] = useState<RuleMatchType>("KEYWORD");
  const [showSystem, setShowSystem] = useState(false);
  const [pending, startTransition] = useTransition();

  // Drag-to-reorder. Pointer Events (not HTML5 drag) so it works on touch —
  // phone/tablet — as well as mouse. Refs hold the live drag/target ids for the
  // pointerup handler (no stale closures); the state mirrors them for the visual
  // highlight only.
  const dragIdRef = useRef<string | null>(null);
  const overIdRef = useRef<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Live tester
  const [sample, setSample] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, startTest] = useTransition();

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const systemCount = list.filter((r) => r.isSystem).length;
  const visible = showSystem ? list : list.filter((r) => !r.isSystem);

  function add() {
    const pattern = newPattern.trim();
    if (!pattern || !newCategoryId) return;
    setError(null);
    startTransition(async () => {
      try {
        const created = await createRule({ pattern, categoryId: newCategoryId, matchType: newMatchType });
        setList((l) =>
          [{ ...created, categoryName: catName.get(created.categoryId) ?? "—" }, ...l].sort(byEngineOrder),
        );
        setNewPattern("");
      } catch (e) {
        setError(errMsg(e));
      }
    });
  }

  function patchRow(id: string, patch: Partial<RuleRow>) {
    setList((l) => l.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function savePattern(id: string, pattern: string) {
    const row = list.find((r) => r.id === id);
    const trimmed = pattern.trim();
    if (!row || !trimmed || row.pattern === trimmed) {
      if (row) patchRow(id, { pattern: row.pattern });
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await updateRule(id, { pattern: trimmed });
        patchRow(id, { pattern: trimmed });
      } catch (e) {
        setError(errMsg(e));
        patchRow(id, { pattern: row.pattern });
      }
    });
  }

  function changeCategory(id: string, categoryId: string) {
    const prev = list.find((r) => r.id === id);
    patchRow(id, { categoryId, categoryName: catName.get(categoryId) ?? "—" });
    setError(null);
    startTransition(async () => {
      try {
        await updateRule(id, { categoryId });
      } catch (e) {
        setError(errMsg(e));
        if (prev) patchRow(id, { categoryId: prev.categoryId, categoryName: prev.categoryName });
      }
    });
  }

  function changePriority(id: string, priority: number) {
    const prev = list.find((r) => r.id === id);
    if (!prev || prev.priority === priority || Number.isNaN(priority)) {
      if (prev) patchRow(id, { priority: prev.priority });
      return;
    }
    setList((l) => l.map((r) => (r.id === id ? { ...r, priority } : r)).sort(byEngineOrder));
    setError(null);
    startTransition(async () => {
      try {
        await updateRule(id, { priority });
      } catch (e) {
        setError(errMsg(e));
        setList((l) => l.map((r) => (r.id === id ? { ...r, priority: prev.priority } : r)).sort(byEngineOrder));
      }
    });
  }

  // ── Drag-to-reorder (Pointer Events: mouse + touch + pen) ─────
  function startDrag(e: React.PointerEvent, id: string) {
    e.preventDefault();
    dragIdRef.current = id;
    overIdRef.current = id;
    setDragId(id);
    setOverId(id);
    // Capture so we keep receiving move/up even if the finger drifts off the grip.
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function moveDrag(e: React.PointerEvent) {
    if (!dragIdRef.current) return;
    e.preventDefault();
    // Pointer capture routes events to the grip, so hit-test the row under the
    // finger directly. Works the same for mouse and touch.
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const row = el && (el as Element).closest?.("[data-rule-id]");
    const id = (row as HTMLElement | null)?.dataset.ruleId ?? null;
    if (id !== overIdRef.current) {
      overIdRef.current = id;
      setOverId(id);
    }
  }

  function endDrag() {
    const sourceId = dragIdRef.current;
    const targetId = overIdRef.current;
    dragIdRef.current = null;
    overIdRef.current = null;
    setDragId(null);
    setOverId(null);
    if (sourceId && targetId) reorderTo(sourceId, targetId);
  }

  // Move `sourceId` to `targetId`'s slot. Reordering permutes priorities within
  // the currently-visible set only (the server does the same), so dragging
  // operator rules never disturbs the hidden built-in list. We optimistically
  // reorder, then reconcile to the priorities the server hands back.
  function reorderTo(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    const visibleIds = visible.map((r) => r.id);
    const from = visibleIds.indexOf(sourceId);
    const to = visibleIds.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const newOrder = [...visibleIds];
    newOrder.splice(from, 1);
    newOrder.splice(to, 0, sourceId);

    // Optimistic: drop the dragged row just before the target in the full list.
    const before = list;
    setList((l) => {
      const moved = l.find((r) => r.id === sourceId);
      if (!moved) return l;
      const rest = l.filter((r) => r.id !== sourceId);
      const targetIdx = rest.findIndex((r) => r.id === targetId);
      rest.splice(targetIdx < 0 ? rest.length : targetIdx, 0, moved);
      return rest;
    });

    setError(null);
    startTransition(async () => {
      try {
        const mapping = await reorderRules(newOrder);
        const pri = new Map(mapping.map((m) => [m.id, m.priority]));
        setList((l) => l.map((r) => (pri.has(r.id) ? { ...r, priority: pri.get(r.id)! } : r)).sort(byEngineOrder));
      } catch (e) {
        setError(errMsg(e));
        setList(before); // restore the pre-drag order
      }
    });
  }

  function toggleEnabled(id: string) {
    const prev = list.find((r) => r.id === id);
    if (!prev) return;
    const enabled = !prev.enabled;
    patchRow(id, { enabled });
    setError(null);
    startTransition(async () => {
      try {
        await updateRule(id, { enabled });
      } catch (e) {
        setError(errMsg(e));
        patchRow(id, { enabled: prev.enabled });
      }
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await deleteRule(id);
        setList((l) => l.filter((r) => r.id !== id));
      } catch (e) {
        setError(errMsg(e));
      }
    });
  }

  function runTest() {
    const text = sample.trim();
    if (!text) return;
    setTestResult(null);
    startTest(async () => {
      try {
        const res = await previewCategorization(text);
        setTestResult(
          res.categoryName
            ? `→ ${res.categoryName}`
            : "→ Misc (no rule matched — would roll into OpEx)",
        );
      } catch (e) {
        setTestResult(errMsg(e));
      }
    });
  }

  // ── Per-field renderers ──────────────────────────────────────
  // One source of truth for each control, reused by the desktop table and the
  // mobile card layout so the two never drift. (This table→cards split is the
  // responsive pattern other dense screens follow.)
  function rowHighlight(row: RuleRow): string {
    return (
      (row.enabled ? "" : "opacity-50 ") +
      (dragId === row.id ? "opacity-40 " : "") +
      (overId === row.id && dragId && dragId !== row.id ? "bg-copper/10 " : "")
    );
  }

  function grip(row: RuleRow) {
    return (
      <button
        onPointerDown={(e) => startDrag(e, row.id)}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        title="Drag to reorder — higher row runs first"
        aria-label="Drag to reorder rule"
        style={{ touchAction: "none" }}
        className="cursor-grab touch-none select-none text-muted hover:text-copper-soft active:cursor-grabbing"
      >
        <GripVertical size={14} />
      </button>
    );
  }

  function patternField(row: RuleRow) {
    return (
      <>
        {row.isSystem ? (
          <span className="inline-flex items-center gap-1.5" title="Built-in rule — pattern locked">
            <Lock size={11} className="text-muted" />
            <span className="font-mono text-xs text-[#E6E8E4]">{matchLabel(row)}</span>
          </span>
        ) : (
          <input
            value={row.pattern}
            onChange={(e) => patchRow(row.id, { pattern: e.target.value })}
            onBlur={(e) => savePattern(row.id, e.target.value)}
            className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 font-mono text-xs text-[#E6E8E4] outline-none hover:border-line focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
          />
        )}
        {row.matchType !== "KEYWORD" && (
          <span className="ml-2 rounded bg-ink px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
            {row.matchType === "CHECK_MIN" ? "check" : "regex"}
          </span>
        )}
      </>
    );
  }

  function categorySelect(row: RuleRow) {
    return (
      <select
        value={row.categoryId}
        disabled={pending}
        onChange={(e) => changeCategory(row.id, e.target.value)}
        className="w-full rounded-md border border-line bg-ink px-2 py-1 text-xs text-[#E6E8E4] outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft disabled:opacity-50 sm:max-w-[200px]"
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    );
  }

  function priorityInput(row: RuleRow) {
    return (
      <input
        type="number"
        value={row.priority}
        min={0}
        onChange={(e) => patchRow(row.id, { priority: e.target.valueAsNumber })}
        onBlur={(e) => changePriority(row.id, e.target.valueAsNumber)}
        className="tnum w-14 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-[#E6E8E4] outline-none hover:border-line focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
      />
    );
  }

  function enableToggle(row: RuleRow) {
    return (
      <button
        onClick={() => toggleEnabled(row.id)}
        disabled={pending}
        title={row.enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
        className={
          "inline-flex h-5 w-9 items-center rounded-full px-0.5 transition-colors " +
          (row.enabled ? "bg-health-green/70 justify-end" : "bg-line justify-start")
        }
      >
        <span className="h-4 w-4 rounded-full bg-ink" />
      </button>
    );
  }

  function deleteBtn(row: RuleRow) {
    return (
      <button
        onClick={() => remove(row.id)}
        disabled={pending || row.isSystem}
        title={row.isSystem ? "Built-in rules can be disabled but not deleted" : "Delete rule"}
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Trash2 size={13} />
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      {/* Live tester */}
      <div className="rounded-lg border border-line bg-surface p-3">
        <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">Test a description</label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runTest()}
            placeholder="e.g. WILSBACH DISTRIBUTING 0608"
            className="flex-1 min-w-[220px] rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-[#E6E8E4] outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
          />
          <button
            onClick={runTest}
            disabled={testing || !sample.trim()}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-ink px-3 py-1.5 text-sm text-[#E6E8E4] hover:border-copper-dim disabled:opacity-50"
          >
            <FlaskConical size={14} /> Test
          </button>
          {testResult && <span className="tnum text-sm text-copper-soft">{testResult}</span>}
        </div>
      </div>

      {/* Add a rule */}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface p-3">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">
            {newMatchType === "REGEX" ? "Regex pattern" : newMatchType === "CHECK_MIN" ? "Check # threshold" : "Keyword in description"}
          </label>
          <input
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder={newMatchType === "CHECK_MIN" ? "10000" : "e.g. MAILCHIMP"}
            className="w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-[#E6E8E4] outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">Match</label>
          <select
            value={newMatchType}
            onChange={(e) => setNewMatchType(e.target.value as RuleMatchType)}
            className="rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-[#E6E8E4] outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
          >
            <option value="KEYWORD">Keyword</option>
            <option value="REGEX">Regex</option>
            <option value="CHECK_MIN">Check ≥</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">Category</label>
          <select
            value={newCategoryId}
            onChange={(e) => setNewCategoryId(e.target.value)}
            className="rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-[#E6E8E4] outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={add}
          disabled={pending || !newPattern.trim() || !newCategoryId}
          className="inline-flex items-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-3 py-1.5 text-sm text-copper-soft hover:bg-copper/20 disabled:opacity-50"
        >
          <Plus size={14} /> Add rule
        </button>
      </div>

      {/* Rules list — table on desktop, stacked cards on phone/tablet */}
      <div className="overflow-hidden rounded-lg border border-line">
        {/* Desktop: aligned table */}
        <table className="hidden w-full text-sm sm:table">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="w-8 px-1 py-2" />
              <th className="px-4 py-2 font-medium">Match</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-3 py-2 text-right font-medium">Priority</th>
              <th className="px-3 py-2 text-center font-medium">On</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} data-rule-id={row.id} className={"border-b border-line/60 last:border-0 " + rowHighlight(row)}>
                <td className="px-1 py-2 text-center">{grip(row)}</td>
                <td className="px-4 py-2">{patternField(row)}</td>
                <td className="px-4 py-2">{categorySelect(row)}</td>
                <td className="px-3 py-2 text-right">{priorityInput(row)}</td>
                <td className="px-3 py-2 text-center">{enableToggle(row)}</td>
                <td className="px-4 py-2 text-right">{deleteBtn(row)}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted">
                  No custom rules yet. Add one above, or show the built-in rules.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Phone/tablet: stacked cards */}
        <div className="divide-y divide-line/60 sm:hidden">
          {visible.map((row) => (
            <div key={row.id} data-rule-id={row.id} className={"p-3 " + rowHighlight(row)}>
              <div className="flex items-center gap-2">
                {grip(row)}
                <div className="min-w-0 flex-1">{patternField(row)}</div>
                {deleteBtn(row)}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="w-16 shrink-0 text-[11px] uppercase tracking-wider text-muted">Category</span>
                {categorySelect(row)}
              </div>
              <div className="mt-3 flex items-center justify-between gap-4">
                <label className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
                  Priority {priorityInput(row)}
                </label>
                <label className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
                  On {enableToggle(row)}
                </label>
              </div>
            </div>
          ))}
          {visible.length === 0 && (
            <div className="p-6 text-center text-sm text-muted">
              No custom rules yet. Add one above, or show the built-in rules.
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={showSystem} onChange={(e) => setShowSystem(e.target.checked)} />
          Show built-in rules ({systemCount})
        </label>
        <span>Drag the handle to reorder — higher rows run first. Built-in patterns are locked; disable one and add your own to override.</span>
      </div>
    </div>
  );
}
