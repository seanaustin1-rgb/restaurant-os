"use client";

/**
 * Native React port of the vacation-rental cockpit (Phase 2, final module).
 *
 * Exception-first property roster (Critical/>48h maintenance → Red, >3 tickets
 * in 30d → Yellow, <3.5★ review → Red), Occupancy/ADR/RevPAR portfolio tiles,
 * a side-drawer with maintenance + reviews + price-aggressiveness profiles and
 * owner-floor flag suppression (Sawtooth Summit Lodge stays green despite -18%
 * pacing behind a $5,000/wk floor), and the auto owner-report value-add.
 * Idiomatic React state (no innerHTML); styles scoped via the shared
 * `.demo-root` wrapper in RealEstateDemo.
 */
import { useEffect, useRef, useState } from "react";

type Tone = "green" | "yellow" | "red";
const TONE: Record<Tone, string> = { green: "var(--green)", yellow: "var(--yellow)", red: "var(--red)" };
type Flag = "r" | "y" | "g";

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
function Dial({ size, r, sw, frac, tone }: { size: number; r: number; sw: number; frac: number; tone: Tone }) {
  const c = size / 2;
  const f = Math.max(0, Math.min(1, frac));
  return (
    <svg viewBox={`0 0 ${size} ${size}`} fill="none">
      <path d={arc(c, c, r, 225, 495)} stroke="var(--line)" strokeWidth={sw} strokeLinecap="round" />
      {f > 0.001 && <path d={arc(c, c, r, 225, 225 + 270 * f)} stroke={TONE[tone]} strokeWidth={sw} strokeLinecap="round" />}
    </svg>
  );
}

interface MaintRow {
  tier: "Critical" | "Standard";
  st: string;
  t: string;
}
interface Prop {
  n: string;
  flag: Flag;
  reason: string;
  occ: number;
  adr: number;
  revpar: number;
  pace: number;
  profile: "Low" | "Medium" | "High";
  floor: string | null;
  priceDrop?: boolean;
  suppressed?: boolean;
  maint: MaintRow[];
  rating: number;
  rnote: string;
  owner?: string;
}

const PROPS: Prop[] = [
  {
    n: "Brundage Chalet",
    flag: "r",
    reason: "Critical maintenance open 52h (furnace) + a 3.2★ review below the 3.5 threshold.",
    occ: 61,
    adr: 340,
    revpar: 207,
    pace: -8,
    profile: "Medium",
    floor: null,
    maint: [
      { tier: "Critical", st: "Open · 52h", t: "Furnace not igniting — guest-reported" },
      { tier: "Standard", st: "In progress · 1d", t: "Hot tub pH low" },
    ],
    rating: 3.2,
    rnote: "“Cold first night, slow to respond.” — 2 days ago",
  },
  {
    n: "Foothills Loft",
    flag: "r",
    reason: "Guest review 3.1★ — below the 3.5 red threshold.",
    occ: 80,
    adr: 280,
    revpar: 224,
    pace: 2,
    profile: "High",
    floor: null,
    maint: [{ tier: "Standard", st: "None open", t: "All work orders resolved" }],
    rating: 3.1,
    rnote: "“Cleaning turnaround was missed at check-in.” — 4 days ago",
  },
  {
    n: "Payette Lake Cabin",
    flag: "y",
    reason: "Repeated maintenance — 4 work orders in the last 30 days.",
    occ: 74,
    adr: 447,
    revpar: 331,
    pace: -3,
    profile: "Medium",
    floor: null,
    maint: [
      { tier: "Standard", st: "Open · 2d", t: "Dock board loose" },
      { tier: "Standard", st: "Resolved", t: "+3 prior entries this month" },
    ],
    rating: 4.6,
    rnote: "“Perfect lake access, spotless.” — 6 days ago",
  },
  {
    n: "Sun Valley Studio",
    flag: "y",
    reason: "Pacing 22% behind benchmark on a High-Aggressiveness profile → price-drop flag.",
    occ: 66,
    adr: 330,
    revpar: 218,
    pace: -22,
    profile: "High",
    floor: null,
    priceDrop: true,
    maint: [{ tier: "Standard", st: "None open", t: "All work orders resolved" }],
    rating: 4.4,
    rnote: "“Great location, easy check-in.” — 1 week ago",
  },
  {
    n: "Sawtooth Summit Lodge",
    flag: "g",
    reason: "On track — price-drop flags suppressed by the owner's floor. Zero noise, by design.",
    occ: 58,
    adr: 714,
    revpar: 414,
    pace: -18,
    profile: "Low",
    floor: "$5,000/wk",
    suppressed: true,
    maint: [{ tier: "Standard", st: "None open", t: "All work orders resolved" }],
    rating: 4.8,
    rnote: "“Worth every penny — impeccable.” — 3 days ago",
    owner:
      "Your asset is priced 24% above market for comparable >4,000 sq ft homes. This premium strategy has held occupancy 19% below local momentum — exactly as you directed.",
  },
  {
    n: "Cedar Creek House",
    flag: "g",
    reason: "On track — top RevPAR in the portfolio.",
    occ: 83,
    adr: 440,
    revpar: 365,
    pace: 7,
    profile: "Medium",
    floor: null,
    maint: [{ tier: "Standard", st: "None open", t: "All work orders resolved" }],
    rating: 4.9,
    rnote: "“Immaculate, will rebook.” — 2 days ago",
  },
  {
    n: "Ridgeline A-Frame",
    flag: "g",
    reason: "On track.",
    occ: 82,
    adr: 370,
    revpar: 303,
    pace: 5,
    profile: "Medium",
    floor: null,
    maint: [{ tier: "Standard", st: "None open", t: "All work orders resolved" }],
    rating: 4.7,
    rnote: "“Loved the views.” — 5 days ago",
  },
];

const RANK: Record<Flag, number> = { r: 0, y: 1, g: 2 };
const FLAGWORD: Record<Flag, string> = { r: "Red", y: "Yellow", g: "OK" };
const PROFILES = ["Low", "Medium", "High"] as const;
const occTone = (o: number): Tone => (o >= 75 ? "green" : o >= 65 ? "yellow" : "red");
const SORTED = [...PROPS].sort((a, b) => (RANK[a.flag] !== RANK[b.flag] ? RANK[a.flag] - RANK[b.flag] : b.revpar - a.revpar));

function Drawer({ p, onClose, onToast }: { p: Prop; onClose: () => void; onToast: (m: string) => void }) {
  const [profile, setProfile] = useState<string>(p.profile);
  const rTone: Tone = p.rating < 3.5 ? "red" : p.rating < 4.2 ? "yellow" : "green";
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="backdrop show" onClick={onClose} />
      <aside className="drawer show" role="dialog" aria-modal="true" aria-label="Property detail">
        <button type="button" className="dclose" aria-label="Close" onClick={onClose} ref={closeRef}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="dhd">
          <span className={`dflag ${p.flag}`} />
          <div>
            <h3>{p.n}</h3>
            <div className="dreason">{p.reason}</div>
          </div>
        </div>
        <div className="dstats">
          <div>
            <span className="dk">Occupancy</span>
            <span className="dv2" style={{ color: TONE[occTone(p.occ)] }}>
              {p.occ}%
            </span>
          </div>
          <div>
            <span className="dk">ADR</span>
            <span className="dv2">${p.adr}</span>
          </div>
          <div>
            <span className="dk">RevPAR</span>
            <span className="dv2">${p.revpar}</span>
          </div>
        </div>

        <div className="dsec">Maintenance</div>
        {p.maint.map((m, i) => (
          <div className="mrow" key={i}>
            <span className={`mtag ${m.tier === "Critical" ? "crit" : "std"}`}>{m.tier}</span>
            <div>
              <div className="mt">{m.t}</div>
              <div className="ms">{m.st}</div>
            </div>
          </div>
        ))}

        <div className="dsec">Guest reviews</div>
        <div className="revbox">
          <span className="rr" style={{ color: TONE[rTone] }}>
            {p.rating.toFixed(1)}★
          </span>
          <span className="rn">
            {p.rnote}
            {p.rating < 3.5 && <b style={{ color: "var(--red)" }}> · below 3.5 threshold</b>}
          </span>
        </div>

        <div className="dsec">Price aggressiveness{p.floor ? ` · floor ${p.floor}` : ""}</div>
        <div className="seg" role="group" aria-label="Pricing strategy">
          {PROFILES.map((x) => (
            <button
              key={x}
              type="button"
              aria-pressed={x === profile}
              onClick={() => {
                setProfile(x);
                onToast(`Strategy set to ${x} Aggressiveness (mock).`);
              }}
            >
              {x}
            </button>
          ))}
        </div>
        {p.suppressed ? (
          <div className="strat-note suppress">
            <b>Price-drop flags suppressed.</b> Owner floor {p.floor} (Low Aggressiveness). Pacing {p.pace}% behind, but the
            system respects the owner&apos;s rule and shows zero noise on the roster.
          </div>
        ) : p.priceDrop ? (
          <div className="strat-note drop">
            <b>Price drop recommended.</b> Pacing {p.pace}% behind seasonal benchmark on a High-Aggressiveness profile — drop the
            nightly rate to protect occupancy.
          </div>
        ) : (
          <div className="strat-note ok">
            Pacing {p.pace >= 0 ? "+" : ""}
            {p.pace}% vs 3-year seasonal benchmark — within tolerance for a {p.profile}-Aggressiveness profile.
          </div>
        )}

        {p.owner && (
          <>
            <div className="dsec">Automated owner report · value-add</div>
            <div className="ownerbox">
              <div className="ot">Draft advisory line</div>
              <div className="oq">“{p.owner}”</div>
              <button type="button" className="obtn" onClick={() => onToast("Monthly owner report generated and queued to send.")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
                </svg>
                Generate &amp; send monthly report
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

export default function RentalCockpit() {
  const [open, setOpen] = useState<Prop | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const say = (m: string) => {
    setToast(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2400);
  };

  return (
    <div className="rental">
      <div className="onething alert">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
        <p>
          <b>Brundage Chalet is red:</b> a Critical furnace work order has been open 52h (past 48h) and a fresh 3.2★ review just
          posted. A guest checks in Thursday — dispatch and respond today.
        </p>
      </div>

      {/* portfolio tiles */}
      <div className="ptiles">
        <div className="ptile">
          <div className="pl">Portfolio occupancy</div>
          <div className="dwrap">
            <Dial size={86} r={35} sw={7} frac={0.72} tone="yellow" />
            <div className="dv">
              <span className="n" style={{ color: "var(--yellow)" }}>
                72%
              </span>
              <span className="u">7 units</span>
            </div>
          </div>
        </div>
        <div className="ptile">
          <div className="pl">Average daily rate</div>
          <div className="pv">$417</div>
          <div className="ps">blended ADR</div>
        </div>
        <div className="ptile">
          <div className="pl">RevPAR</div>
          <div className="pv">$295</div>
          <div className="ps">per available night</div>
        </div>
        <div className="ptile">
          <div className="pl">Booking pace</div>
          <div className="dwrap">
            <Dial size={86} r={35} sw={7} frac={0.42} tone="yellow" />
            <div className="dv">
              <span className="n" style={{ color: "var(--yellow)" }}>
                −5%
              </span>
              <span className="u">vs 3-yr</span>
            </div>
          </div>
        </div>
      </div>

      {/* property roster */}
      <div className="section">
        <div className="sh">
          <span className="eyebrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--copper-soft)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <path d="M9 22V12h6v10" />
            </svg>
            Property roster · exceptions first
          </span>
          <span className="desc">one line per asset · tap for the drawer</span>
        </div>
        <div className="roster">
          <div className="thead">
            <span />
            <span>Property</span>
            <span className="r col-hide">Occupancy</span>
            <span className="r col-hide">ADR</span>
            <span className="r">RevPAR</span>
            <span />
          </div>
          {SORTED.map((p) => (
            <button type="button" className="prow" key={p.n} aria-label={`Open ${p.n}`} onClick={() => setOpen(p)}>
              <span className={`dot ${p.flag}`} />
              <span className="pname">
                <span className="nm">{p.n}</span>
                <span className={`pill ${p.flag}`}>{FLAGWORD[p.flag]}</span>
              </span>
              <span className="cell-num r col-hide" style={{ color: TONE[occTone(p.occ)] }}>
                {p.occ}%
              </span>
              <span className="cell-num r col-hide">${p.adr}</span>
              <span className="cell-num r">${p.revpar}</span>
              <span className="chev">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="footnote">
        <b>Generated demo data.</b> Occupancy/ADR/RevPAR, maintenance tickets, reviews, and booking pace map to the Escapia GraphQL
        feed; strategy profiles &amp; owner floors are stored per property. Live <b>Escapia gateway sync</b> is the design-partner
        roadmap — nothing here is a live production account.
      </div>

      {open && <Drawer p={open} onClose={() => setOpen(null)} onToast={say} />}

      <div className={`demo-toast ${toast ? "show" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>

      <style jsx>{`
        .onething.alert {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          border: 1px solid color-mix(in srgb, var(--red) 40%, var(--line));
          background: var(--red-wash);
          border-radius: 11px;
          padding: 12px 14px;
          margin-top: 16px;
        }
        .onething.alert :global(svg) {
          width: 15px;
          height: 15px;
          color: var(--red);
          flex: none;
          margin-top: 2px;
        }
        .onething.alert p {
          margin: 0;
          font-size: 13.5px;
          color: var(--text);
          line-height: 1.45;
        }
        .onething.alert :global(b) {
          color: var(--red);
          font-weight: 600;
        }
        .ptiles {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
          margin-top: 14px;
        }
        .ptile {
          border: 1px solid var(--line);
          border-radius: 11px;
          background: var(--surface);
          padding: 12px 12px 11px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .ptile .pl {
          font-size: 9.5px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted);
        }
        .ptile .pv {
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          font-size: 24px;
          margin-top: 8px;
          color: var(--text);
        }
        .ptile .ps {
          font-size: 11px;
          color: var(--muted);
          margin-top: 5px;
        }
        .dwrap {
          position: relative;
          width: 86px;
          height: 86px;
          margin-top: 6px;
        }
        .dwrap :global(svg) {
          width: 100%;
          height: 100%;
        }
        .dv {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .dv .n {
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          font-size: 19px;
        }
        .dv .u {
          font-size: 8.5px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-top: 2px;
        }
        @media (min-width: 820px) {
          .dwrap {
            width: 100px;
            height: 100px;
          }
          .dv .n {
            font-size: 22px;
          }
        }
        .section {
          margin-top: 16px;
        }
        .section .sh {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }
        .section .desc {
          font-size: 11.5px;
          color: var(--muted);
        }
        .roster {
          border: 1px solid var(--line);
          border-radius: 12px;
          overflow: hidden;
          background: var(--surface);
        }
        .thead,
        .prow {
          display: grid;
          grid-template-columns: 18px minmax(140px, 1.7fr) 84px 84px 90px 16px;
          gap: 10px;
          align-items: center;
        }
        .thead {
          padding: 10px 15px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted);
          border-bottom: 1px solid var(--line);
          background: var(--panel);
        }
        .thead .r,
        .prow .r {
          text-align: right;
        }
        @media (max-width: 600px) {
          .thead,
          .prow {
            grid-template-columns: 18px 1fr 84px 16px;
          }
          .col-hide {
            display: none;
          }
        }
        .prow {
          width: 100%;
          border: 0;
          border-bottom: 1px solid var(--line-soft);
          background: transparent;
          color: inherit;
          font: inherit;
          text-align: left;
          cursor: pointer;
          padding: 11px 15px;
        }
        .prow:last-child {
          border-bottom: 0;
        }
        .prow:hover {
          background: var(--raise);
        }
        .dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          flex: none;
        }
        .dot.g {
          background: var(--green);
        }
        .dot.y {
          background: var(--yellow);
        }
        .dot.r {
          background: var(--red);
        }
        .pname {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .pname .nm {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text);
          font-size: 13.5px;
        }
        .pill {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 1px 6px;
          border-radius: 999px;
          border: 1px solid;
          flex: none;
        }
        .pill.r {
          color: var(--red);
          border-color: color-mix(in srgb, var(--red) 40%, transparent);
          background: var(--red-wash);
        }
        .pill.y {
          color: var(--yellow);
          border-color: color-mix(in srgb, var(--yellow) 40%, transparent);
          background: var(--yellow-wash);
        }
        .pill.g {
          color: var(--muted);
          border-color: var(--line);
        }
        .cell-num {
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          font-size: 13px;
          text-align: right;
          color: var(--text);
        }
        .chev {
          color: var(--muted);
          justify-self: end;
          display: inline-flex;
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
        .backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.55);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s;
          z-index: 40;
        }
        .backdrop.show {
          opacity: 1;
          pointer-events: auto;
        }
        .drawer {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(440px, 100%);
          background: var(--surface);
          border-left: 1px solid var(--line);
          z-index: 50;
          transform: translateX(101%);
          transition: transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
          overflow-y: auto;
          padding: 22px 20px 40px;
        }
        .drawer.show {
          transform: none;
        }
        .dclose {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 30px;
          height: 30px;
          border-radius: 8px;
          border: 1px solid var(--line);
          background: var(--panel);
          color: var(--muted);
          cursor: pointer;
          display: grid;
          place-items: center;
        }
        .dclose:hover {
          color: var(--text);
        }
        .dclose :global(svg) {
          width: 15px;
          height: 15px;
        }
        .dhd {
          display: flex;
          gap: 11px;
          align-items: flex-start;
          padding-right: 36px;
          border-bottom: 1px solid var(--line);
          padding-bottom: 15px;
        }
        .dflag {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          margin-top: 6px;
          flex: none;
        }
        .dflag.r {
          background: var(--red);
        }
        .dflag.y {
          background: var(--yellow);
        }
        .dflag.g {
          background: var(--green);
        }
        .dhd h3 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 23px;
          color: var(--text);
          line-height: 1.05;
        }
        .dreason {
          font-size: 12.5px;
          color: var(--muted);
          margin-top: 4px;
          line-height: 1.45;
        }
        .dstats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 16px;
        }
        .dstats > div {
          border: 1px solid var(--line);
          border-radius: 9px;
          background: var(--panel);
          padding: 10px 11px;
          text-align: center;
        }
        .dstats .dk {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted);
        }
        .dstats .dv2 {
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          font-size: 17px;
          margin-top: 5px;
          display: block;
          color: var(--text);
        }
        .dsec {
          font-size: 10.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--muted);
          margin: 20px 0 8px;
        }
        .mrow {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 9px 0;
          border-top: 1px solid var(--line-soft);
          font-size: 12.5px;
        }
        .mrow:first-of-type {
          border-top: 0;
        }
        .mtag {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 1px 6px;
          border-radius: 999px;
          flex: none;
          margin-top: 1px;
        }
        .mtag.crit {
          color: var(--red);
          border: 1px solid color-mix(in srgb, var(--red) 40%, transparent);
          background: var(--red-wash);
        }
        .mtag.std {
          color: var(--muted);
          border: 1px solid var(--line);
        }
        .mrow .mt {
          color: var(--text-soft);
        }
        .mrow .ms {
          color: var(--muted);
          font-size: 11px;
          margin-top: 1px;
        }
        .revbox {
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid var(--line);
          border-radius: 9px;
          background: var(--panel);
          padding: 12px;
        }
        .revbox .rr {
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          font-size: 26px;
        }
        .revbox .rn {
          font-size: 12px;
          color: var(--muted);
          line-height: 1.4;
        }
        .seg {
          display: flex;
          border: 1px solid var(--line);
          border-radius: 9px;
          overflow: hidden;
          margin-top: 2px;
        }
        .seg button {
          font: inherit;
          font-size: 11.5px;
          padding: 8px 10px;
          border: 0;
          background: transparent;
          color: var(--muted);
          cursor: pointer;
          border-right: 1px solid var(--line);
          flex: 1;
          transition: background 0.15s, color 0.15s;
        }
        .seg button:last-child {
          border-right: 0;
        }
        .seg button[aria-pressed="true"] {
          color: var(--ink);
          background: var(--copper-soft);
          font-weight: 600;
        }
        .strat-note {
          margin-top: 10px;
          font-size: 12.5px;
          line-height: 1.5;
          border-radius: 9px;
          padding: 11px 12px;
        }
        .strat-note.drop {
          border: 1px solid color-mix(in srgb, var(--yellow) 40%, var(--line));
          background: var(--yellow-wash);
          color: var(--text);
        }
        .strat-note.suppress {
          border: 1px solid var(--copper-dim);
          background: var(--copper-wash);
          color: var(--text);
        }
        .strat-note.ok {
          border: 1px solid var(--line);
          background: var(--panel);
          color: var(--text-soft);
        }
        .strat-note :global(b) {
          color: var(--text);
        }
        .ownerbox {
          margin-top: 12px;
          border: 1px solid var(--copper-dim);
          background: var(--copper-wash);
          border-radius: 10px;
          padding: 13px;
        }
        .ownerbox .ot {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--copper-soft);
        }
        .ownerbox .oq {
          font-size: 13px;
          color: var(--text);
          margin-top: 7px;
          line-height: 1.55;
          font-style: italic;
        }
        .obtn {
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          border-radius: 8px;
          padding: 8px 12px;
          cursor: pointer;
          border: 1px solid var(--copper-soft);
          background: var(--copper-soft);
          color: var(--ink);
          margin-top: 11px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .obtn :global(svg) {
          width: 13px;
          height: 13px;
        }
        @media (prefers-reduced-motion: reduce) {
          .drawer,
          .backdrop {
            transition: none;
          }
        }
        .demo-toast {
          position: fixed;
          left: 50%;
          bottom: 22px;
          transform: translateX(-50%) translateY(12px);
          opacity: 0;
          pointer-events: none;
          background: var(--surface);
          border: 1px solid var(--copper-dim);
          color: var(--text);
          font-size: 13px;
          padding: 10px 15px;
          border-radius: 10px;
          transition: opacity 0.2s, transform 0.2s;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
          z-index: 60;
          max-width: 90vw;
        }
        .demo-toast.show {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      `}</style>
    </div>
  );
}
