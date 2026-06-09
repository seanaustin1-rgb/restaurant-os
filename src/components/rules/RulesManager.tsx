"use client";

import { useMemo, useState, useTransition } from "react";
import type { RuleMatchType } from "@prisma/client";
import { Plus, Trash2, FlaskConical, Lock } from "lucide-react";
import { createRule, updateRule, deleteRule, previewCategorization } from "@/app/settings/rules/actions";

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

export function RulesManager({ rows, categories }: { rows: RuleRow[]; categories: CategoryOption[] }) {
  const [list, setList] = useState<RuleRow[]>(rows);
  const [error, setError] = useState<string | null>(null);
  const [newPattern, setNewPattern] = useState("");
  const [newCategoryId, setNewCategoryId] = useState(categories[0]?.id ?? "");
  const [newMatchType, setNewMatchType] = useState<RuleMatchType>("KEYWORD");
  const [showSystem, setShowSystem] = useState(false);
  const [pending, startTransition] = useTransition();

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
        setList((l) => [
          { ...created, categoryName: catName.get(created.categoryId) ?? "—" },
          ...l,
        ]);
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
    patchRow(id, { priority });
    setError(null);
    startTransition(async () => {
      try {
        await updateRule(id, { priority });
      } catch (e) {
        setError(errMsg(e));
        patchRow(id, { priority: prev.priority });
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
            className="flex-1 min-w-[220px] rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-[#E6E8E4] outline-none focus:border-copper-dim"
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
            className="w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-[#E6E8E4] outline-none focus:border-copper-dim"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">Match</label>
          <select
            value={newMatchType}
            onChange={(e) => setNewMatchType(e.target.value as RuleMatchType)}
            className="rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-[#E6E8E4] outline-none focus:border-copper-dim"
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
            className="rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-[#E6E8E4] outline-none focus:border-copper-dim"
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

      {/* Rules table */}
      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-4 py-2 font-medium">Match</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-3 py-2 text-right font-medium">Priority</th>
              <th className="px-3 py-2 text-center font-medium">On</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className={"border-b border-line/60 last:border-0 " + (row.enabled ? "" : "opacity-50")}>
                <td className="px-4 py-2">
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
                      className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 font-mono text-xs text-[#E6E8E4] outline-none hover:border-line focus:border-copper-dim"
                    />
                  )}
                  {row.matchType !== "KEYWORD" && (
                    <span className="ml-2 rounded bg-ink px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                      {row.matchType === "CHECK_MIN" ? "check" : "regex"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <select
                    value={row.categoryId}
                    disabled={pending}
                    onChange={(e) => changeCategory(row.id, e.target.value)}
                    className="max-w-[200px] rounded-md border border-line bg-ink px-2 py-1 text-xs text-[#E6E8E4] outline-none focus:border-copper-dim disabled:opacity-50"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    value={row.priority}
                    min={0}
                    onChange={(e) => patchRow(row.id, { priority: e.target.valueAsNumber })}
                    onBlur={(e) => changePriority(row.id, e.target.valueAsNumber)}
                    className="tnum w-14 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-[#E6E8E4] outline-none hover:border-line focus:border-copper-dim"
                  />
                </td>
                <td className="px-3 py-2 text-center">
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
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => remove(row.id)}
                    disabled={pending || row.isSystem}
                    title={row.isSystem ? "Built-in rules can be disabled but not deleted" : "Delete rule"}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted">
                  No custom rules yet. Add one above, or show the built-in rules.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={showSystem} onChange={(e) => setShowSystem(e.target.checked)} />
          Show built-in rules ({systemCount})
        </label>
        <span>Lower priority wins. Built-in patterns are locked; disable one and add your own to override.</span>
      </div>
    </div>
  );
}
