"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  Calculator,
  Gauge,
  MousePointerClick,
  PlaneTakeoff,
  Puzzle,
  ShieldAlert,
  Wind,
} from "lucide-react";
import { HealthSignal } from "@/components/health/HealthSignal";
import type { HealthStatus } from "@/lib/profit-first/calculator";

// The "Live Heartbeat" marketing landing, on the OutFront instrument-panel system
// (DESIGN.md). One engine, two vocabularies: the vertical toggle re-labels every
// gauge so a prospect SEES that hospitality and broker run the same logic.
//
// Two named rules from DESIGN.md drive the styling here:
//   · One Voice — copper is rationed to ≤10%: the primary CTA (action) and the
//     Cash Oxygen Floor (the single number that should pull the eye). Nothing
//     else is copper; icons and labels stay muted so the accent keeps its weight.
//   · Status-is-not-decoration — green/yellow/red belong to financial health only,
//     always via HealthSignal (colour + icon + word), never colour alone.
// Figures are illustrative (Stone Grille).

type Vertical = "hosp" | "brok";

interface GaugeData {
  label: string;
  value: string;
  sub: string;
  /** 0–100 fill for the bar. */
  pct: number;
  status: HealthStatus;
  statusWord: string;
  verdict: string;
}

interface Copy {
  heroHead: string;
  heroSub: string;
  floor: string;
  floorMath: string;
  keep: GaugeData;
  pressure: GaugeData;
  pipeline: GaugeData;
  toplineWord: string;
  rivalName: string;
  rivalLine: string;
  keepLine: string;
  pressureCardTitle: string;
  pressureCardBody: string;
  pipelineCardBody: string;
  onTopBody: string;
}

const COPY: Record<Vertical, Copy> = {
  hosp: {
    heroHead: "Your best Saturday night is when restaurants go broke.",
    heroSub:
      "A packed house isn't cash in your pocket. Food cost, labor, sales tax, and tips claim most of it before you bank it. OutFront Data shows what you actually keep, how many days of runway you really have, and stops you spending money that was never yours.",
    floor: "23",
    floorMath:
      "Liquid cash $96,400 ÷ true daily burn $4,180 = 23 days. Burn is the ~$139k/mo break-even ÷ 30, after the Tax and Profit vaults are set aside. Sales tax and tips are excluded from cash — they were never yours.",
    keep: { label: "Real keep tonight", value: "$4,120", sub: "of $18,400 rung up", pct: 22, status: "green", statusWord: "Kept", verdict: "22% kept after COGS, tax and tips" },
    pressure: { label: "Prime cost pressure", value: "58%", sub: "your line: 60%", pct: 58, status: "green", statusWord: "On target", verdict: "COGS + labor, just under the line" },
    pipeline: { label: "Bookings vs burn", value: "71%", sub: "of next month's fixed costs", pct: 71, status: "yellow", statusWord: "Watch", verdict: "Weighted events, minus COGS" },
    toplineWord: "sales",
    rivalName: "Your POS / back-office tool",
    rivalLine: "gross sales",
    keepLine: "real keep",
    pressureCardTitle: "Prime cost band",
    pressureCardBody: "Flags when COGS + labor crosses 60% — you see the squeeze in real time, not at month-end.",
    pipelineCardBody: "Weights upcoming bookings, subtracts pass-through, stacks the real revenue against 30/60/90-day bills.",
    onTopBody: "Keep the POS you have. We read its data and hand back the one number you run on.",
  },
  brok: {
    heroHead: "Your biggest closing month is when brokerages go broke.",
    heroSub:
      "GCI was never yours — agent splits and caps eat most of it. OutFront Data shows the company dollar you actually keep, how many days of runway you really have, and stops you spending commission that already belongs to someone else.",
    floor: "31",
    floorMath:
      "Liquid cash $128,000 ÷ true daily burn $4,130 = 31 days. Burn is monthly desk, payroll, and fixed costs ÷ 30, after the Tax and Profit vaults are set aside. Agent splits are excluded — that money walks out with the agent.",
    keep: { label: "Company dollar", value: "$21,300", sub: "of $96,000 closed GCI", pct: 22, status: "green", statusWord: "Kept", verdict: "22% kept after splits and caps" },
    pressure: { label: "Split pressure", value: "73%", sub: "your line: 75%", pct: 73, status: "green", statusWord: "On target", verdict: "Agent payouts + caps, near the line" },
    pipeline: { label: "Pipeline vs burn", value: "64%", sub: "of next month's fixed costs", pct: 64, status: "yellow", statusWord: "Watch", verdict: "Pending deals weighted by close odds" },
    toplineWord: "production",
    rivalName: "Your CRM / back-office tool",
    rivalLine: "closed GCI",
    keepLine: "company dollar",
    pressureCardTitle: "Split pressure band",
    pressureCardBody: "Flags when agent payouts and caps cross 75% of GCI — you see the company dollar thinning as it happens.",
    pipelineCardBody: "Weights pending deals by close probability, subtracts splits, stacks the real revenue against 30/60/90-day bills.",
    onTopBody: "Keep the CRM you're stuck with. We read its data and hand back the one number you run on.",
  },
};

const HEALTH_BAR: Record<HealthStatus, string> = {
  green: "bg-health-green",
  yellow: "bg-health-yellow",
  red: "bg-health-red",
};

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

function GaugeCard({ g, mounted }: { g: GaugeData; mounted: boolean }) {
  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{g.label}</span>
        <HealthSignal status={g.status} label={g.statusWord} mode="badge" />
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="tnum text-2xl font-medium text-ink-text">{g.value}</span>
        <span className="text-[11px] text-muted">{g.sub}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink">
        <span
          className={clsx("block h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700", HEALTH_BAR[g.status])}
          style={{ width: mounted ? `${g.pct}%` : "0%", transitionTimingFunction: EASE }}
        />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted">{g.verdict}</p>
    </div>
  );
}

function Guardrail({ icon: Icon, title, children }: { icon: typeof Activity; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <div className="mb-1.5 flex items-center gap-2">
        <Icon size={17} aria-hidden className="shrink-0 text-muted" />
        <span className="text-sm font-medium text-ink-text">{title}</span>
      </div>
      <p className="text-[13px] leading-relaxed text-muted">{children}</p>
    </div>
  );
}

const PRIMARY_CTA =
  "inline-flex min-h-[44px] items-center gap-2 rounded-md bg-copper px-5 text-sm font-medium text-ink transition-colors hover:bg-copper-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-soft focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

export function HeartbeatLanding() {
  const [vertical, setVertical] = useState<Vertical>("hosp");
  const [showMath, setShowMath] = useState(false);
  const [mounted, setMounted] = useState(false);
  const c = COPY[vertical];

  // Drives the bar grow-in on first paint and the smooth re-fill on toggle.
  useEffect(() => setMounted(true), []);

  return (
    <main className="mx-auto max-w-3xl px-5 pb-16 pt-8">
      <p className="font-display text-base text-ink-text-soft">OutFront Data</p>

      <div className="mt-7 flex items-center gap-2">
        <span className="text-[13px] text-muted">Show it for</span>
        {(["hosp", "brok"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setVertical(v)}
            aria-pressed={vertical === v}
            className={clsx(
              "min-h-[36px] rounded-md border px-3 text-[13px] transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-soft focus-visible:ring-offset-2 focus-visible:ring-offset-ink",
              vertical === v
                ? "border-line bg-surface font-medium text-ink-text"
                : "border-transparent text-muted hover:text-ink-text",
            )}
          >
            {v === "hosp" ? "Hospitality" : "Real-estate broker"}
          </button>
        ))}
      </div>

      <h1
        className="mt-5 max-w-[18ch] font-display font-medium leading-[1.08] text-ink-text"
        style={{ fontSize: "clamp(2.25rem, 6vw, 3.5rem)", textWrap: "balance" }}
      >
        {c.heroHead}
      </h1>
      <p className="mt-4 max-w-[62ch] leading-relaxed text-ink-text-soft" style={{ textWrap: "pretty" }}>
        {c.heroSub}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/onboarding" className={PRIMARY_CTA}>
          Start your 30-day Virtual Pilot
          <ArrowRight size={15} aria-hidden />
        </Link>
        <Link
          href="/demo"
          className="inline-flex min-h-[44px] items-center rounded-md border border-line bg-surface px-4 text-sm font-medium text-ink-text transition-colors hover:border-copper-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-soft focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
        >
          See it on your numbers
        </Link>
      </div>

      {/* Live heartbeat panel — the hero visual */}
      <section className="hb-rise mt-9 rounded-lg border border-line bg-ink p-3.5" aria-label="Live heartbeat preview" style={{ animationDelay: "120ms" }}>
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[13px] font-medium text-muted">
            <Activity size={16} aria-hidden className="text-muted" />
            Live heartbeat
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="hb-pulse h-1.5 w-1.5 rounded-full bg-health-green" aria-hidden />
            synced 2m ago
          </span>
        </div>

        <button
          onClick={() => setShowMath((s) => !s)}
          aria-expanded={showMath}
          className="group block w-full rounded-md border border-line bg-surface p-4 text-left transition-colors hover:border-copper-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-soft focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs text-muted">
              <Wind size={15} aria-hidden className="text-muted" />
              Cash oxygen floor
            </span>
            <HealthSignal status="green" label="Healthy" mode="badge" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2.5">
            <span className="tnum text-[44px] font-medium leading-none text-copper">{c.floor}</span>
            <span className="text-sm text-ink-text-soft">days of runway at your true burn</span>
          </div>
          <span className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted transition-colors group-hover:text-copper-soft">
            <Calculator size={13} aria-hidden />
            {showMath ? "Hide the math" : "Tap to see the math"}
          </span>
          {showMath && (
            <p className="mt-2.5 border-t border-line pt-2.5 text-[13px] leading-relaxed text-ink-text-soft">{c.floorMath}</p>
          )}
        </button>

        <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <GaugeCard g={c.keep} mounted={mounted} />
          <GaugeCard g={c.pressure} mounted={mounted} />
          <GaugeCard g={c.pipeline} mounted={mounted} />
        </div>
        <p className="mt-3 text-right text-[10px] text-muted">Illustrative · Stone Grille figures</p>
      </section>

      {/* The shift */}
      <h2 className="mt-16 max-w-[24ch] font-display text-[1.75rem] font-medium leading-tight text-ink-text" style={{ textWrap: "balance" }}>
        Back-office tools count {c.toplineWord}. We protect what you keep.
      </h2>
      <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="rounded-md border border-line bg-surface p-4">
          <p className="mb-2.5 text-[13px] font-medium text-muted">{c.rivalName}</p>
          <ul className="space-y-2 text-[13px] leading-relaxed text-muted">
            <li>Shows the {c.rivalLine} — the top line</li>
            <li>A rear-view mirror of last month</li>
            <li>Never tells you when you can spend</li>
          </ul>
        </div>
        <div className="rounded-md border border-copper-dim bg-surface p-4">
          <p className="mb-2.5 text-[13px] font-medium text-ink-text">OutFront Data</p>
          <ul className="space-y-2 text-[13px] leading-relaxed text-ink-text-soft">
            <li>Shows your {c.keepLine} after pass-through</li>
            <li>A live floor: survival days, right now</li>
            <li>Stacks pipeline against real upcoming bills</li>
          </ul>
        </div>
      </div>

      {/* Four guardrails */}
      <h2 className="mt-16 font-display text-[1.75rem] font-medium leading-tight text-ink-text">Four guardrails. Nothing else.</h2>
      <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Guardrail icon={Wind} title="Cash oxygen floor">
          Survival days at your true burn, so a spike month never tricks you into spending phantom wealth.
        </Guardrail>
        <Guardrail icon={Gauge} title={c.pressureCardTitle}>
          {c.pressureCardBody}
        </Guardrail>
        <Guardrail icon={CalendarClock} title="Pipeline matching">
          {c.pipelineCardBody}
        </Guardrail>
        <div className="rounded-md border border-line bg-surface p-4 sm:col-span-2">
          <div className="mb-1.5 flex items-center gap-2">
            <PlaneTakeoff size={17} aria-hidden className="shrink-0 text-muted" />
            <span className="text-sm font-medium text-ink-text">Virtual pilot</span>
          </div>
          <p className="text-[13px] leading-relaxed text-muted">
            A 30-day dry run of your set-asides on real cash — no money moves. It proves that skimming Profit, Tax, and
            Owner&apos;s Pay off the top still leaves Operating able to cover every bill. Pass the dry run, then flip on
            automated bank sweeps with confidence.
          </p>
          <div className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-2 text-[11px]">
            <span className="rounded-full border border-line bg-ink px-2.5 py-1 text-ink-text-soft">Each deposit</span>
            <ArrowRight size={13} aria-hidden className="text-muted" />
            <span className="rounded-full border border-line bg-ink px-2.5 py-1 text-ink-text">Profit 5%</span>
            <span className="rounded-full border border-line bg-ink px-2.5 py-1 text-ink-text">Tax 15%</span>
            <span className="rounded-full border border-line bg-ink px-2.5 py-1 text-ink-text">Owner 10%</span>
            <ArrowRight size={13} aria-hidden className="text-muted" />
            <span className="rounded-full border border-line bg-ink px-2.5 py-1 text-ink-text-soft">Operating 70%</span>
          </div>
        </div>
      </div>

      {/* Anti-bloat — borderless, to break the card cadence */}
      <h2 className="mt-16 font-display text-[1.75rem] font-medium leading-tight text-ink-text">Built for people done with bloated software.</h2>
      <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-3">
        <div>
          <MousePointerClick size={18} aria-hidden className="text-muted" />
          <h3 className="mt-2.5 text-sm font-medium text-ink-text">Zero new workflow</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            We add an answer, not a screen. Five-minute setup, then you log in to know — not to work.
          </p>
        </div>
        <div>
          <ShieldAlert size={18} aria-hidden className="text-muted" />
          <h3 className="mt-2.5 text-sm font-medium text-ink-text">Loud, honest flags</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            When a sync breaks you&apos;re the first to know, in plain English. Never a silently wrong number.
          </p>
        </div>
        <div>
          <Puzzle size={18} aria-hidden className="text-muted" />
          <h3 className="mt-2.5 text-sm font-medium text-ink-text">Sits on top, not instead</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{c.onTopBody}</p>
        </div>
      </div>

      {/* Final CTA */}
      <section className="mt-16 rounded-lg border border-line bg-surface px-6 py-9 text-center">
        <h2 className="font-display text-[1.75rem] font-medium leading-tight text-ink-text" style={{ textWrap: "balance" }}>
          Know what you keep. Spend what&apos;s real.
        </h2>
        <p className="mx-auto mt-3 max-w-[52ch] leading-relaxed text-ink-text-soft" style={{ textWrap: "pretty" }}>
          See your real keep, your survival days, and whether your pipeline covers what&apos;s coming — in under 30
          seconds.
        </p>
        <Link href="/onboarding" className={clsx(PRIMARY_CTA, "mt-6")}>
          Start your 30-day Virtual Pilot
          <ArrowRight size={15} aria-hidden />
        </Link>
      </section>
    </main>
  );
}
