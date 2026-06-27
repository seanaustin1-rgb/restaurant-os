"use client";

import { useState, useTransition } from "react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Wallet, Flame, CalendarClock, Pencil } from "lucide-react";
import type { CashRunwayData } from "@/lib/modules/cash-runway";
import { setCashAnchor } from "@/app/modules/cash-runway/actions";
import { money, count } from "@/lib/format";

const STATUS_COLOR = { green: "#5FA777", yellow: "#D9A35E", red: "#C8643A", unknown: "#8A8F89" };

function AnchorForm({
  initialBalance,
  initialDate,
  onDone,
}: {
  initialBalance?: number | null;
  initialDate?: string | null;
  onDone?: () => void;
}) {
  const [balance, setBalance] = useState(initialBalance != null ? String(initialBalance) : "");
  const [date, setDate] = useState(initialDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    const b = Number(balance);
    if (!balance.trim() || Number.isNaN(b)) return setError("Enter the balance as a number.");
    if (!date) return setError("Pick the statement date for that balance.");
    startTransition(async () => {
      try {
        await setCashAnchor(b, date);
        onDone?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
      }
    });
  };

  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <h2 className="text-sm text-ink-text">Set starting cash balance</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Runway needs one real number to start from: your bank balance on a known date — both are on
        any bank statement. Everything after that date is computed from imported transactions.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-muted">Balance ($)</span>
          <input
            type="number"
            step="0.01"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="e.g. 48250.17"
            className="mt-1 block w-40 rounded-md border border-line bg-transparent px-3 py-1.5 text-sm text-ink-text outline-none focus:border-copper"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-muted">On date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block rounded-md border border-line bg-transparent px-3 py-1.5 text-sm text-ink-text outline-none focus:border-copper"
          />
        </label>
        <button
          onClick={submit}
          disabled={pending}
          className="rounded-md border border-copper bg-copper/10 px-4 py-1.5 text-sm text-copper-soft transition-colors hover:bg-copper/20 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save starting balance"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-health-red">{error}</p> : null}
    </div>
  );
}

interface TipPayload {
  payload: { date: string; balance: number; projected: boolean };
}
function ChartTip({ active, payload }: { active?: boolean; payload?: TipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 text-ink-text">
        {d.date}
        {d.projected ? <span className="ml-1 text-muted">(projected)</span> : null}
      </div>
      <div className="tnum text-copper-soft">{money(d.balance)}</div>
    </div>
  );
}

export function CashRunwayModule({ data }: { data: CashRunwayData }) {
  const [editing, setEditing] = useState(false);

  if (!data.hasAnchor || editing) {
    return (
      <div className="space-y-4">
        {!data.hasData ? (
          <p className="rounded-lg border border-dashed border-line p-4 text-center text-xs text-muted">
            No transactions imported yet — runway will be flat until bank data lands.
          </p>
        ) : !data.hasAnchor ? (
          <p className="rounded-lg border border-copper-dim/40 bg-copper-dim/10 p-4 text-xs leading-relaxed text-muted">
            Bank activity is connected. One starting balance unlocks Cash Oxygen, runway, and Go-Live cash safety.
          </p>
        ) : null}
        <AnchorForm
          initialBalance={data.anchorBalance}
          initialDate={data.anchorDate}
          onDone={() => setEditing(false)}
        />
      </div>
    );
  }

  const color = STATUS_COLOR[data.status];
  const burning = (data.avgDailyNet ?? 0) < 0;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <Wallet size={12} className="text-copper-soft" /> Est. Cash (as of {data.asOfDate})
          </span>
          <div className="tnum mt-1 text-2xl text-copper-soft">{money(data.currentCash ?? 0)}</div>
          <button
            onClick={() => setEditing(true)}
            className="mt-1 flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-copper-soft"
          >
            <Pencil size={10} /> anchor: {money(data.anchorBalance ?? 0)} on {data.anchorDate}
          </button>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <Flame size={12} className={burning ? "text-health-red" : "text-health-green"} /> Daily{" "}
            {burning ? "Burn" : "Gain"} ({data.burnWindowDays}d avg)
          </span>
          <div className={"tnum mt-1 text-2xl " + (burning ? "text-health-red" : "text-health-green")}>
            {money(Math.abs(data.avgDailyNet ?? 0))}
          </div>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <CalendarClock size={12} style={{ color }} /> Runway
          </span>
          <div className="tnum mt-1 text-2xl" style={{ color }}>
            {data.runwayDays != null ? `${count(data.runwayDays)} days` : "growing"}
          </div>
          {data.runwayOutDate ? (
            <div className="mt-0.5 text-[11px] text-muted">cash out ~{data.runwayOutDate}</div>
          ) : (
            <div className="mt-0.5 text-[11px] text-muted">cash isn&apos;t shrinking at the current rate</div>
          )}
        </div>
      </div>

      {/* Balance history + projection */}
      <div className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-muted">
          Balance since anchor · dashed = projected at current burn
        </h2>
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.series} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="runwayFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: "#8A8F89", fontSize: 10 }}
                tickFormatter={(v: string) => v.slice(5)}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#8A8F89", fontSize: 10 }}
                tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <ReferenceLine y={0} stroke="#C8643A" strokeDasharray="4 4" />
              {data.asOfDate ? <ReferenceLine x={data.asOfDate} stroke="#3A3E3A" /> : null}
              <Tooltip content={<ChartTip />} />
              <Area
                type="monotone"
                dataKey="balance"
                stroke={color}
                strokeWidth={1.5}
                fill="url(#runwayFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Honest footnotes */}
      <p className="text-[11px] leading-relaxed text-muted">
        Estimated from the anchor balance plus imported transactions — not a live bank feed. Burn rate is the
        {" "}{data.burnWindowDays}-day average of net daily flow.
        {data.staleDays != null && data.staleDays > 7 ? (
          <span className="text-health-yellow">
            {" "}
            Latest imported transaction is {count(data.staleDays)} days old — import newer statements to bring the
            estimate current.
          </span>
        ) : null}
      </p>
    </div>
  );
}
