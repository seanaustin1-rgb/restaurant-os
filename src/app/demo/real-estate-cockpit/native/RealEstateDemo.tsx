"use client";

/**
 * Native React port of the real-estate demo (Phase 2, in progress).
 *
 * Idiomatic components + React state (no innerHTML), scoped styles via styled-jsx
 * so nothing leaks into the app. Same design + generated data as the shipped
 * iframe demo. Broker cockpit is ported here first; Agent + Rental follow, then
 * this replaces the iframe at /demo/real-estate-cockpit and gets wired to a
 * demo-DB tenant.
 */
import { useEffect, useState } from "react";
import AgentApp from "./AgentApp";

type Tone = "green" | "yellow" | "red" | "copper";
const TONE: Record<Tone, string> = {
  green: "var(--green)",
  yellow: "var(--yellow)",
  red: "var(--red)",
  copper: "var(--copper-soft)",
};

// ── radial gauge geometry (270°, gap at bottom) ──────────────────────────────
function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
}

function GaugeDial({
  size = 88,
  r = 36,
  sw = 7,
  frac,
  tone,
  target,
  ticks,
}: {
  size?: number;
  r?: number;
  sw?: number;
  frac: number;
  tone: Tone;
  target?: number | null;
  ticks?: boolean;
}) {
  const c = size / 2;
  const f = Math.max(0, Math.min(1, frac));
  const tickLines = [];
  if (ticks) {
    for (let i = 0; i <= 8; i++) {
      const ang = 225 + 270 * (i / 8);
      const o = polar(c, c, r + sw / 2 + 2, ang);
      const inn = polar(c, c, r - sw / 2 - 2, ang);
      tickLines.push(
        <line key={i} x1={o.x} y1={o.y} x2={inn.x} y2={inn.y} stroke="var(--line-soft)" strokeWidth={1.4} />,
      );
    }
  }
  let targetTick = null;
  if (target != null) {
    const ta = 225 + 270 * target;
    const t1 = polar(c, c, r + sw / 2 + 3, ta);
    const t2 = polar(c, c, r - sw / 2 - 3, ta);
    targetTick = <line x1={t1.x} y1={t1.y} x2={t2.x} y2={t2.y} stroke="var(--text-soft)" strokeWidth={2} />;
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} fill="none">
      <path d={arc(c, c, r, 225, 495)} stroke="var(--line)" strokeWidth={sw} strokeLinecap="round" />
      {f > 0.001 && (
        <path d={arc(c, c, r, 225, 225 + 270 * f)} stroke={TONE[tone]} strokeWidth={sw} strokeLinecap="round" />
      )}
      {tickLines}
      {targetTick}
    </svg>
  );
}

function HealthWord({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className="word" style={{ color: TONE[tone] }}>
      {tone === "green" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      )}
      {children}
    </span>
  );
}

interface GaugeSpec {
  key: string;
  label: string;
  v: string;
  u: string;
  frac: number;
  tone: Tone;
  target?: number | null;
  word: [Tone, string];
  ex: { def: string; read: React.ReactNode; so: string };
}

const FIN_GAUGES: GaugeSpec[] = [
  {
    key: "retention",
    label: "Company-dollar retention",
    v: "28.4",
    u: "%",
    frac: 0.284 / 0.36,
    tone: "yellow",
    target: 0.3 / 0.36,
    word: ["yellow", "Watch"],
    ex: {
      def: "Of every dollar of commission the brokerage earns (GCI), how much it keeps after agent splits, caps, and lead spend.",
      read: (
        <>
          <b>28.4%</b> kept vs a <b>30%</b> target (the tick). That gap is ≈<b>$2.4k</b> of company dollar this month, and{" "}
          <b>$9.4k</b> is at risk as three agents near cap.
        </>
      ),
      so: "Coach or reallocate the two lowest-ROI agents' lead budgets this week.",
    },
  },
  {
    key: "cash",
    label: "Cash oxygen",
    v: "47",
    u: "days",
    frac: 47 / 90,
    tone: "green",
    target: 30 / 90,
    word: ["green", "On track"],
    ex: {
      def: "Operating cash divided by average daily fixed burn — how many days you could run with zero new closings.",
      read: (
        <>
          <b>47</b> days, above your <b>30</b>-day floor (the tick). <b>+$11.9k</b> net this period; the floor holds through
          the Jun 25 sweep.
        </>
      ),
      so: "Healthy — watch it as the sweep and payroll stack up late-month.",
    },
  },
  {
    key: "leadroi",
    label: "Lead ROI",
    v: "4.2×",
    u: "return",
    frac: 4.2 / 8,
    tone: "green",
    target: 3 / 8,
    word: ["green", "On track"],
    ex: {
      def: "Company dollar generated per $1 of lead spend, blended across all agents.",
      read: (
        <>
          <b>4.2×</b> vs a <b>3.0×</b> target (the tick). Two agents drag the blend — their lead ROI is under <b>1×</b>.
        </>
      ),
      so: "The portfolio's healthy; the fix is agent-level, not a budget cut.",
    },
  },
  {
    key: "reputation",
    label: "Reputation",
    v: "4.6",
    u: "of 5",
    frac: 4.6 / 5,
    tone: "green",
    target: 4.0 / 5,
    word: ["green", "On track"],
    ex: {
      def: "Blended Google + Zillow rating across the brokerage's listings and agents.",
      read: (
        <>
          <b>4.6</b> of 5 from <b>218</b> reviews; average response time <b>3.4h</b>.
        </>
      ),
      so: "A quiet trust asset — lead with it in listing pitches.",
    },
  },
];

const TICKER = [
  { l: "Momentum", v: "Accelerating", a: "up" },
  { l: "Median DOM", v: "24d", a: "downgood" },
  { l: "Months supply", v: "2.1 mo", a: "" },
  { l: "Sale-to-list", v: "99.1%", a: "" },
  { l: "Median price", v: "$512k", a: "up" },
  { l: "$/sf <2k", v: "$284", a: "up" },
  { l: "$/sf 2–4k", v: "$312", a: "up" },
  { l: "$/sf >4k", v: "$268", a: "down" },
  { l: "Absorption", v: "2.1 mo", a: "" },
  { l: "Active:Pending", v: "1.8×", a: "" },
  { l: "New listings", v: "62/wk", a: "up" },
];

function GaugeCard({ g, open, onToggle }: { g: GaugeSpec; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="gauge" aria-expanded={open} onClick={onToggle}>
      <div className="glabel">{g.label}</div>
      <div className="gwrap">
        <GaugeDial frac={g.frac} tone={g.tone} target={g.target} ticks />
        <div className="gval">
          <span className="v" style={{ color: TONE[g.tone] }}>
            {g.v}
          </span>
          <span className="u">{g.u}</span>
        </div>
      </div>
      <HealthWord tone={g.word[0]}>{g.word[1]}</HealthWord>
      <svg className="info" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
    </button>
  );
}

function BrokerCockpit() {
  const [openGauge, setOpenGauge] = useState<string | null>(null);
  const [tickerOpen, setTickerOpen] = useState(false);
  const active = FIN_GAUGES.find((g) => g.key === openGauge) ?? null;

  const tickerRow = (
    <>
      {TICKER.map((t, i) => (
        <span className="tick" key={i}>
          <b>{t.l}</b>
          {t.v}
          {t.a === "up" && <span className="tup"> ▲</span>}
          {t.a === "down" && <span className="tdn"> ▼</span>}
          {t.a === "downgood" && <span className="tup"> ▼7</span>}
          {i < TICKER.length - 1 && <span className="tsep">&nbsp;•&nbsp;</span>}
        </span>
      ))}
      <span className="tsep">&nbsp;•&nbsp;</span>
    </>
  );

  return (
    <div className="card pad">
      <div className="header">
        <div>
          <span className="eyebrow" style={{ color: "var(--copper-soft)" }}>
            Executive Cockpit
          </span>
          <h1>Cascade Realty Group</h1>
          <div className="sub">June 2026 · Boise, ID · 12 agents</div>
        </div>
        <span className="badge partial">
          <span className="tnum">3/4</span> sources
        </span>
      </div>

      <div className="onething">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2zM9 21h6M10 17v4M14 17v4" />
        </svg>
        <p>
          <b>Compliance red flag:</b> Whitaker Cole has missing legal disclosures on a Pending file — 26h in, past the 24h
          deadline. Clear it before it&apos;s a liability, then Chloe Bennett&apos;s stalled pipeline.
        </p>
      </div>

      {/* financial gauges */}
      <div className="gauges">
        {FIN_GAUGES.map((g) => (
          <GaugeCard key={g.key} g={g} open={openGauge === g.key} onToggle={() => setOpenGauge(openGauge === g.key ? null : g.key)} />
        ))}
      </div>
      {active && (
        <div className="gexplain">
          <h3>{active.label}</h3>
          <div className="def">{active.ex.def}</div>
          <div className="read">{active.ex.read}</div>
          <div className="so">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
            </svg>
            <span>{active.ex.so}</span>
          </div>
        </div>
      )}

      {/* market intelligence — ticker + drop-down */}
      <div className="section">
        <div className="st">
          <span className="eyebrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--copper-soft)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M5 21V7l4-2M19 21V7l-4-2M9 5V3h6v2M9 9h.01M15 9h.01M9 13h.01M15 13h.01" />
            </svg>
            Market intelligence · MLS · Boise, ID
          </span>
          <span style={{ fontSize: "10.5px", color: "var(--muted)", opacity: 0.8 }}>seeded · live MLS/RESO feed on roadmap</span>
        </div>
        <button type="button" className="ticker" aria-expanded={tickerOpen} onClick={() => setTickerOpen((v) => !v)} aria-label="Market ticker — tap to expand">
          <span className="ticker-tag">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h4l2 6 4-14 2 8h6" />
            </svg>
            MLS
          </span>
          <span className="ticker-win">
            <span className="ticker-track">
              {tickerRow}
              {tickerRow}
            </span>
          </span>
          <span className="ticker-chev">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </button>
        {tickerOpen && (
          <div className="mi mkt-detail">
            <span className="eyebrow">Market momentum meter</span>
            <div className="meter-word" style={{ marginTop: 8 }}>
              <span className="mgo">Accelerating</span> <span className="sub">14-day list-to-sale rolling avg</span>
            </div>
            <div className="mtrack">
              <span className="div" style={{ left: "33.33%" }} />
              <span className="div" style={{ left: "66.66%" }} />
              <span className="mk" style={{ left: "84%" }} />
            </div>
            <div className="mzones">
              <span>Decelerating</span>
              <span>Stable</span>
              <b>Accelerating</b>
            </div>
            <div className="mcap">
              List-to-sale ratio <b>99.4%</b> and rising; DOM down <b>7 days</b> in 14. Across the market, homes are selling
              faster and closer to ask.
            </div>
            <div className="tiers">
              <span className="eyebrow">Price per sq ft · by size tier</span>
              {[
                ["Under 2,000 sq ft", "starter / entry", "$284", "up", "▲ 2.1%"],
                ["2,000–4,000 sq ft", "move-up", "$312", "up", "▲ 3.6%"],
                ["Over 4,000 sq ft", "large homes", "$268", "down", "▼ 1.2%"],
              ].map(([label, sub, val, dir, trend]) => (
                <div className="tier" key={label}>
                  <div className="tl">
                    {label}
                    <small>{sub}</small>
                  </div>
                  <div className="tv">{val}</div>
                  <div className={`tr ${dir}`}>{trend}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="footnote">
        Every figure is <b>generated demo data</b>. Native React port in progress — Agent app &amp; Rental cockpit land next,
        then this replaces the iframe and wires to a demo-DB tenant.
      </div>
    </div>
  );
}

const TABS = [
  { key: "broker", label: "Broker cockpit" },
  { key: "agent", label: "Agent app" },
  { key: "rental", label: "Rental" },
] as const;

export default function RealEstateDemo() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("broker");
  // lock body scroll chrome away — this is a full-page demo
  useEffect(() => {
    document.documentElement.style.setProperty("color-scheme", "dark");
  }, []);

  return (
    <div className="demo-root">
      <div className="unav">
        <div className="unav-in">
          <div className="brand">
            <span className="bm">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="M7 14l4-4 3 3 5-6" />
              </svg>
            </span>
            <span className="bn">
              OutFront<b>Data</b>
            </span>
          </div>
          <div className="utabs" role="tablist" aria-label="Dashboards">
            {TABS.map((t) => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
          <span className="uchip">
            <span className="d" />
            Generated demo data
          </span>
        </div>
      </div>

      <div className="wrap">
        {tab === "broker" && <BrokerCockpit />}
        {tab === "agent" && (
          <div className="card pad">
            <div className="header">
              <div>
                <span className="eyebrow" style={{ color: "var(--copper-soft)" }}>
                  Agent frontline
                </span>
                <h1>Good morning, Priya</h1>
                <div className="sub">Wednesday, June 11 · Boise, ID · 3 active files</div>
              </div>
              <span className="badge partial">
                <span className="tnum">2</span> need you now
              </span>
            </div>
            <AgentApp />
          </div>
        )}
        {tab === "rental" && (
          <div className="card pad stub">
            <span className="eyebrow" style={{ color: "var(--copper-soft)" }}>
              Rental cockpit
            </span>
            <p>Native port in progress — the property roster + exception engine lands in the next increment.</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .demo-root {
          --ink: #0b0d0b;
          --surface: #141614;
          --panel: #0f110f;
          --raise: #191c19;
          --line: #232623;
          --line-soft: #1b1e1b;
          --muted: #8a8f89;
          --text: #e6e8e4;
          --text-soft: #cfd2cc;
          --copper: #c8873a;
          --copper-soft: #d9a35e;
          --copper-dim: #7a5526;
          --green: #5fa777;
          --yellow: #d9a35e;
          --red: #c8643a;
          --green-wash: rgba(95, 167, 119, 0.1);
          --yellow-wash: rgba(217, 163, 94, 0.1);
          --red-wash: rgba(200, 100, 58, 0.1);
          --copper-wash: rgba(200, 135, 58, 0.12);
          --font-display: "Cormorant Garamond", "Palatino Linotype", Palatino, "Iowan Old Style", Georgia, serif;
          --font-mono: var(--font-mono, "Space Mono", ui-monospace, Menlo, monospace);
          min-height: 100vh;
          background: var(--ink);
          color: var(--text);
          line-height: 1.45;
        }
        .demo-root :global(.tnum) {
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.01em;
        }
        .demo-root :global(.eyebrow) {
          font-size: 10.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.09em;
          color: var(--muted);
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }
        .unav {
          position: sticky;
          top: 0;
          z-index: 30;
          background: color-mix(in srgb, var(--ink) 88%, transparent);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid var(--line);
        }
        .unav-in {
          max-width: 1120px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 14px 18px;
          justify-content: space-between;
          flex-wrap: wrap;
          padding: 12px 18px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .bm {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          border: 1px solid var(--copper-dim);
          display: grid;
          place-items: center;
          color: var(--copper-soft);
          background: var(--copper-wash);
        }
        .bn {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 600;
          color: var(--text);
        }
        .bn :global(b) {
          color: var(--copper-soft);
        }
        .utabs {
          display: inline-flex;
          padding: 4px;
          gap: 4px;
          border: 1px solid var(--line);
          border-radius: 999px;
          background: var(--surface);
          flex-wrap: wrap;
        }
        .utabs button {
          font: inherit;
          font-size: 12.5px;
          color: var(--muted);
          background: transparent;
          border: 0;
          cursor: pointer;
          padding: 7px 14px;
          border-radius: 999px;
          white-space: nowrap;
          transition: color 0.15s, background 0.15s;
        }
        .utabs button:hover {
          color: var(--text);
        }
        .utabs button[aria-selected="true"] {
          color: var(--ink);
          background: var(--copper-soft);
          font-weight: 600;
        }
        .uchip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11.5px;
          padding: 5px 10px;
          border: 1px solid var(--copper-dim);
          border-radius: 999px;
          color: var(--copper-soft);
          background: var(--copper-wash);
        }
        .uchip .d {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }
        .wrap {
          max-width: 1120px;
          margin: 0 auto;
          padding: 18px 18px 64px;
        }
        .card {
          border: 1px solid var(--line);
          background: var(--surface);
          border-radius: 12px;
        }
        .pad {
          padding: 18px;
        }
        .stub p {
          margin-top: 10px;
          color: var(--muted);
          font-size: 14px;
        }
        .header {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: flex-end;
          justify-content: space-between;
          border-bottom: 1px solid var(--line);
          padding-bottom: 16px;
        }
        .header :global(h1) {
          margin: 4px 0 0;
          font-family: var(--font-display);
          font-size: clamp(26px, 4vw, 36px);
          color: var(--text);
          line-height: 1.03;
        }
        .header .sub {
          color: var(--muted);
          font-size: 13px;
          margin-top: 3px;
        }
        .badge {
          font-size: 12px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid;
          white-space: nowrap;
        }
        .badge.partial {
          color: var(--yellow);
          border-color: color-mix(in srgb, var(--yellow) 35%, transparent);
          background: var(--yellow-wash);
        }
        .onething {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          border: 1px solid var(--copper-dim);
          background: var(--copper-wash);
          border-radius: 11px;
          padding: 12px 14px;
          margin-top: 16px;
        }
        .onething :global(svg) {
          width: 15px;
          height: 15px;
          color: var(--copper-soft);
          flex: none;
          margin-top: 2px;
        }
        .onething p {
          margin: 0;
          font-size: 13.5px;
          color: var(--text);
          line-height: 1.45;
        }
        .onething :global(b) {
          color: var(--copper-soft);
          font-weight: 600;
        }
        .gauges {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
          gap: 8px;
          margin-top: 12px;
        }
        .gauge {
          position: relative;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--surface);
          padding: 10px 8px 9px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          font: inherit;
          color: inherit;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
        }
        .gauge:hover {
          border-color: var(--copper-dim);
        }
        .gauge[aria-expanded="true"] {
          border-color: var(--copper-soft);
          background: var(--copper-wash);
        }
        .gauge .glabel {
          font-size: 9.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted);
          line-height: 1.2;
        }
        .gauge :global(.info) {
          position: absolute;
          top: 7px;
          right: 8px;
          width: 13px;
          height: 13px;
          color: var(--muted);
          opacity: 0.45;
        }
        .gauge:hover :global(.info) {
          opacity: 0.8;
        }
        .gauge[aria-expanded="true"] :global(.info) {
          opacity: 0;
        }
        .gwrap {
          position: relative;
          width: 88px;
          height: 88px;
          margin-top: 7px;
        }
        .gwrap :global(svg) {
          width: 100%;
          height: 100%;
          display: block;
        }
        .gval {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .gval .v {
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          font-size: 19px;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .gval .u {
          font-size: 8.5px;
          color: var(--muted);
          margin-top: 2px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .gauge :global(.word) {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 600;
          margin-top: 6px;
        }
        .gauge :global(.word svg) {
          width: 11px;
          height: 11px;
        }
        @media (min-width: 820px) {
          .gauges {
            gap: 14px;
          }
          .gwrap {
            width: 108px;
            height: 108px;
          }
          .gval .v {
            font-size: 23px;
          }
          .gauge {
            padding: 14px 10px 12px;
          }
        }
        .gexplain {
          margin-top: 12px;
          border: 1px solid var(--copper-dim);
          background: var(--panel);
          border-radius: 12px;
          padding: 15px 17px;
        }
        .gexplain :global(h3) {
          margin: 0;
          font-family: var(--font-display);
          font-size: 20px;
          color: var(--text);
        }
        .gexplain .def {
          margin-top: 6px;
          font-size: 13.5px;
          color: var(--text-soft);
          line-height: 1.55;
        }
        .gexplain .read {
          margin-top: 10px;
          font-size: 13px;
          color: var(--muted);
          line-height: 1.55;
        }
        .gexplain .read :global(b) {
          color: var(--text);
          font-family: var(--font-mono);
          font-weight: 400;
        }
        .gexplain .so {
          margin-top: 11px;
          font-size: 13px;
          color: var(--copper-soft);
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }
        .gexplain .so :global(svg) {
          width: 14px;
          height: 14px;
          flex: none;
          margin-top: 2px;
        }
        .section {
          margin-top: 16px;
        }
        .section .st {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }
        .ticker {
          width: 100%;
          display: flex;
          align-items: center;
          margin-top: 10px;
          padding: 0;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--panel);
          overflow: hidden;
          cursor: pointer;
          font: inherit;
          color: inherit;
          height: 42px;
        }
        .ticker:hover {
          border-color: var(--copper-dim);
        }
        .ticker-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--copper-soft);
          padding: 0 12px;
          border-right: 1px solid var(--line);
          height: 100%;
          background: var(--surface);
          white-space: nowrap;
          flex: none;
        }
        .ticker-tag :global(svg) {
          width: 13px;
          height: 13px;
        }
        .ticker-win {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          position: relative;
          height: 100%;
          display: flex;
          align-items: center;
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 20px, #000 calc(100% - 20px), transparent);
          mask-image: linear-gradient(90deg, transparent, #000 20px, #000 calc(100% - 20px), transparent);
        }
        .ticker-track {
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
          animation: tickerscroll 52s linear infinite;
          will-change: transform;
        }
        .ticker:hover .ticker-track,
        .ticker[aria-expanded="true"] .ticker-track {
          animation-play-state: paused;
        }
        @keyframes tickerscroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        .ticker :global(.tick) {
          font-size: 12.5px;
          color: var(--text-soft);
          padding: 0 4px;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono);
        }
        .ticker :global(.tick b) {
          font-family: inherit;
          color: var(--muted);
          font-weight: 600;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-right: 5px;
        }
        .ticker :global(.tup) {
          color: var(--green);
        }
        .ticker :global(.tdn) {
          color: var(--red);
        }
        .ticker :global(.tsep) {
          color: var(--copper-dim);
        }
        .ticker-chev {
          display: inline-flex;
          align-items: center;
          padding: 0 11px;
          color: var(--muted);
          height: 100%;
          border-left: 1px solid var(--line);
          background: var(--surface);
          flex: none;
        }
        .ticker-chev :global(svg) {
          width: 16px;
          height: 16px;
          transition: transform 0.2s;
        }
        .ticker[aria-expanded="true"] .ticker-chev :global(svg) {
          transform: rotate(180deg);
          color: var(--copper-soft);
        }
        .mi {
          border: 1px solid var(--line);
          border-radius: 12px;
          background: var(--surface);
          padding: 16px;
          margin-top: 10px;
        }
        .meter-word {
          font-family: var(--font-display);
          font-size: 26px;
          line-height: 1;
          display: flex;
          align-items: baseline;
          gap: 9px;
          flex-wrap: wrap;
        }
        .meter-word .mgo {
          color: var(--green);
        }
        .meter-word .sub {
          font-size: 12px;
          color: var(--muted);
        }
        .mtrack {
          position: relative;
          height: 12px;
          border-radius: 999px;
          margin: 14px 0 6px;
          background: linear-gradient(
            90deg,
            color-mix(in srgb, var(--red) 45%, var(--surface)),
            color-mix(in srgb, var(--yellow) 45%, var(--surface)),
            color-mix(in srgb, var(--green) 55%, var(--surface))
          );
        }
        .mtrack .div {
          position: absolute;
          top: -3px;
          bottom: -3px;
          width: 1px;
          background: var(--line);
        }
        .mtrack .mk {
          position: absolute;
          top: 50%;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--text);
          border: 2px solid var(--surface);
          transform: translate(-50%, -50%);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
        }
        .mzones {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted);
        }
        .mzones :global(b) {
          color: var(--green);
          font-weight: 600;
        }
        .mcap {
          margin-top: 11px;
          font-size: 12px;
          color: var(--muted);
          line-height: 1.5;
        }
        .mcap :global(b) {
          color: var(--text);
          font-family: var(--font-mono);
          font-weight: 400;
        }
        .tiers {
          border: 1px solid var(--line);
          border-radius: 11px;
          background: var(--panel);
          padding: 13px;
          margin-top: 12px;
        }
        .tier {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 9px 0;
          border-top: 1px solid var(--line-soft);
        }
        .tier:first-of-type {
          border-top: 0;
        }
        .tier .tl {
          font-size: 12.5px;
          color: var(--text-soft);
        }
        .tier .tl :global(small) {
          display: block;
          color: var(--muted);
          font-size: 10.5px;
        }
        .tier .tv {
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          font-size: 17px;
          color: var(--text);
        }
        .tier .tr {
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }
        .tier .tr.up {
          color: var(--green);
        }
        .tier .tr.down {
          color: var(--red);
        }
        .footnote {
          margin-top: 16px;
          font-size: 11.5px;
          color: var(--muted);
          line-height: 1.5;
          border-top: 1px solid var(--line);
          padding-top: 12px;
        }
        .footnote :global(b) {
          color: var(--text-soft);
        }
        @media (prefers-reduced-motion: reduce) {
          .ticker-track {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
