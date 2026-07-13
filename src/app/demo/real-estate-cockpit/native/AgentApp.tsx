"use client";

/**
 * Native React port of the agent frontline app (Phase 2).
 *
 * Daily priority queue (expandable, missing-doc filenames), market intelligence
 * (momentum meter + $/sqft tiers + absorption/DOM dials), lead action center
 * (15/30-min response clock), and a calendar guard hard-block. Idiomatic React
 * state (no innerHTML); styles are scoped via the shared `.demo-root` wrapper in
 * RealEstateDemo, so this component only carries its own module CSS.
 */
import { useEffect, useRef, useState } from "react";

type Tone = "green" | "yellow" | "red";
const TONE: Record<Tone, string> = { green: "var(--green)", yellow: "var(--yellow)", red: "var(--red)" };

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

// ── data ─────────────────────────────────────────────────────────────────────
type Flag = "r" | "y" | "g";
type QType = "Closing" | "Inspection" | "Messages";
const QICON: Record<QType, string> = {
  Closing: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4",
  Inspection: "M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.3-4.3",
  Messages: "M4 4h16v12H5.2L4 17.5z",
};
type Task = { s: "done" | "miss" | "open"; t: string; f?: string };
interface QueueCard {
  type: QType;
  flag: Flag;
  title: string;
  meta: string;
  time: string;
  warn?: string;
  tasks: Task[];
}

const QUEUE: QueueCard[] = [
  {
    type: "Closing",
    flag: "r",
    title: "214 Highland Park",
    meta: "Funds today · $610k · your GCI $9,150",
    time: "2:00 PM",
    warn: "2 compliance items missing within 48h of close",
    tasks: [
      { s: "miss", t: "Seller disclosure — signature", f: "SPDS_214Highland.pdf · unsigned" },
      { s: "miss", t: "Final walkthrough form", f: "walkthrough_214.pdf · not uploaded" },
      { s: "done", t: "Title commitment cleared" },
      { s: "done", t: "Wire instructions verified" },
    ],
  },
  {
    type: "Inspection",
    flag: "g",
    title: "1102 Alderwood",
    meta: "Buyer inspection · inspector confirmed · you needn't attend",
    time: "10:00 AM",
    tasks: [
      { s: "done", t: "Inspection scheduled" },
      { s: "done", t: "Lockbox code sent to inspector" },
      { s: "open", t: "Repair-request template ready to send" },
    ],
  },
  {
    type: "Closing",
    flag: "y",
    title: "88 Cedar Bluff",
    meta: "Funds in 3 days · Jun 13 · $445k",
    time: "Jun 13",
    warn: "Checklist 80% — 1 admin task open",
    tasks: [
      { s: "done", t: "Appraisal received" },
      { s: "done", t: "Loan clear-to-close" },
      { s: "open", t: "HOA estoppel requested" },
    ],
  },
  {
    type: "Messages",
    flag: "g",
    title: "3 unread messages",
    meta: "1 lead gone quiet · 2 client updates",
    time: "oldest 4h",
    tasks: [
      { s: "open", t: "Jordan Blake — “are we still on for Saturday?”" },
      { s: "open", t: "Osei family — inspection questions" },
      { s: "open", t: "Pioneer Title — confirm closing time" },
    ],
  },
];

interface Lead {
  nm: string;
  flag: Flag;
  meta: string;
  why: string;
  primary: { t: string; u?: boolean };
  ghost: string;
}
const LEADS: Lead[] = [
  {
    nm: "Sam Ortega",
    flag: "r",
    meta: "Referral from Priya · new 41 min ago",
    why: "Past the 30-minute red line. Referrals contacted within 10 minutes close 3× more often.",
    primary: { t: "Call now", u: true },
    ghost: "Send SMS template",
  },
  {
    nm: "The Whitfields",
    flag: "y",
    meta: "Zillow inquiry · 22 min ago",
    why: "In the 15–30 min yellow window — still recoverable if you touch it now.",
    primary: { t: "Send email template" },
    ghost: "Text",
  },
  {
    nm: "Marcus Lindqvist",
    flag: "g",
    meta: "Open-house sign-in · 6 min ago",
    why: "Fresh and under the 15-min target — a quick intro locks it in.",
    primary: { t: "Send intro" },
    ghost: "Snooze",
  },
  {
    nm: "Dana Whitfield (past client)",
    flag: "y",
    meta: "60-day nurture · re-engage",
    why: "Two new Ridgeline listings match her saved search — the automated match sequence works here.",
    primary: { t: "Send listing match" },
    ghost: "Skip",
  },
];

const FLAG: Record<Flag, { label: string; icon: string }> = {
  r: { label: "Red · >30m", icon: "M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" },
  y: { label: "Yellow · 15–30m", icon: "M12 7v5l3 2" },
  g: { label: "Green · <15m", icon: "M20 6 9 17l-5-5" },
};

const DIALS = [
  { l: "Absorption rate", n: "2.1", u: "mo supply", frac: 2.1 / 6, tone: "green" as Tone },
  { l: "Median DOM", n: "24d", u: "−7 in 14d", frac: 1 - 24 / 60, tone: "green" as Tone },
];

// ── components ───────────────────────────────────────────────────────────────
function QueueCardView({ c }: { c: QueueCard }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`qcard ${c.flag}`}>
      <button type="button" className="qhead" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="qic">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d={QICON[c.type]} />
          </svg>
        </span>
        <span className="qmid">
          <span className="qtype">{c.type}</span>
          <span className="qtitle">{c.title}</span>
          <span className="qmeta">{c.meta}</span>
          {c.warn && (
            <span className="qwarn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
              {c.warn}
            </span>
          )}
        </span>
        <span className="qright">
          <span className="qtime">{c.time}</span>
          <span className="qchev" style={{ transform: open ? "rotate(90deg)" : undefined }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </span>
        </span>
      </button>
      {open && (
        <div className="qbody">
          {c.tasks.map((t, i) => (
            <div className={`task ${t.s === "done" ? "done" : ""}`} key={i}>
              {t.s === "done" ? (
                <span className="tbox done">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
              ) : t.s === "miss" ? (
                <span className="tbox miss">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </span>
              ) : (
                <span className="tbox" />
              )}
              <span className="tt">
                {t.t}
                {t.f && <span className="file">{t.f}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LeadView({ l, onFire }: { l: Lead; onFire: (msg: string) => void }) {
  const [done, setDone] = useState(false);
  const f = FLAG[l.flag];
  return (
    <div className={`lead ${l.flag} ${done ? "done" : ""}`}>
      <div className="lhead">
        <span className="lnm">{l.nm}</span>
        <span className={`lflag ${l.flag}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            {l.flag === "y" && <circle cx="12" cy="12" r="9" />}
            <path d={f.icon} />
          </svg>
          {f.label}
        </span>
      </div>
      <div className="lmeta">{l.meta}</div>
      <div className="lwhy">{l.why}</div>
      <div className="lact">
        <button
          type="button"
          className={l.primary.u ? "btn urgent" : "btn primary"}
          onClick={() => {
            if (done) return;
            setDone(true);
            onFire("Follow-up fired from template — logged to the lead.");
          }}
        >
          {done ? "✓ Sent" : l.primary.t}
        </button>
        <button type="button" className="btn ghost" onClick={() => onFire("Queued.")}>
          {l.ghost}
        </button>
      </div>
    </div>
  );
}

export default function AgentApp() {
  const [guardResolved, setGuardResolved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const say = (m: string) => {
    setToast(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2400);
  };

  return (
    <div className="agent">
      {/* daily priority queue */}
      <div className="section">
        <div className="sh">
          <span className="eyebrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--copper-soft)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Today · priority queue
          </span>
          <span className="desc">closings, inspections &amp; messages — expand for the task list</span>
        </div>
        <div className="queue">
          {QUEUE.map((c) => (
            <QueueCardView c={c} key={c.title} />
          ))}
        </div>
      </div>

      {/* market intelligence */}
      <div className="section">
        <div className="sh">
          <span className="eyebrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--copper-soft)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18M7 15l4-4 3 2 5-6" />
            </svg>
            Market intelligence · Boise, ID
          </span>
          <span className="desc" style={{ opacity: 0.85 }}>
            seeded · live MLS via SkySlope on roadmap
          </span>
        </div>
        <div className="mi">
          <span className="eyebrow">Market momentum meter</span>
          <div className="meter-word" style={{ marginTop: 8 }}>
            <span className="st">Accelerating</span> <span className="sub">14-day list-to-sale rolling avg</span>
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
            List-to-sale ratio <b>99.4%</b> and rising; DOM down <b>7 days</b> in 14. Homes are selling faster and closer to ask
            — a good window to convert your Ridgeline sellers to signed listings.
          </div>
          <div className="subgrid">
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
            <div className="dials">
              {DIALS.map((d) => (
                <div className="dial" key={d.l}>
                  <div className="dl">{d.l}</div>
                  <div className="dwrap">
                    <Dial size={78} r={31} sw={6} frac={d.frac} tone={d.tone} />
                    <div className="dv">
                      <span className="n" style={{ color: TONE[d.tone] }}>
                        {d.n}
                      </span>
                      <span className="u">{d.u}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* lead action center */}
      <div className="section">
        <div className="sh">
          <span className="eyebrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--copper-soft)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
            </svg>
            Lead action center
          </span>
          <span className="desc">
            response clock: <span style={{ color: "var(--green)" }}>&lt;15m</span> ·{" "}
            <span style={{ color: "var(--yellow)" }}>15–30m</span> · <span style={{ color: "var(--red)" }}>&gt;30m</span>
          </span>
        </div>
        {LEADS.map((l) => (
          <LeadView l={l} key={l.nm} onFire={say} />
        ))}
      </div>

      {/* calendar guard */}
      <div className="section">
        <div className="sh">
          <span className="eyebrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--copper-soft)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M3 10h18M8 2v4M16 2v4" />
            </svg>
            Calendar guard
          </span>
          <span className="desc">scans your calendar against transaction deadlines</span>
        </div>
        {guardResolved ? (
          <div className="guard resolved">
            <div className="gh ok">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Resolved · Saturday clear
            </div>
            <div className="gb">
              Ridgeline open house reassigned to Daniel Okafor. Your 2:00 showing and the Highland inspection window no longer
              collide.
            </div>
          </div>
        ) : (
          <div className="guard">
            <div className="gh">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
              Hard block · double-booked
            </div>
            <div className="gb">
              <b>Saturday 2:00 PM</b> — a Maple Row showing overlaps the Ridgeline open house, and both sit on top of the Highland
              Park <b>inspection window</b>. You can&apos;t be in three places.
            </div>
            <div className="conflict">
              <div className="cslot">
                <div className="ct">Sat 2:00–3:00 PM</div>
                <div className="cn">9 Maple Row · buyer showing</div>
                <div className="cx">you · confirmed</div>
              </div>
              <div className="cslot">
                <div className="ct">Sat 2:00–4:00 PM</div>
                <div className="cn">77 Ridgeline · open house</div>
                <div className="cx">you · confirmed</div>
              </div>
            </div>
            <div className="lact" style={{ marginTop: 12 }}>
              <button type="button" className="btn urgent" onClick={() => { setGuardResolved(true); say("Calendar conflict resolved."); }}>
                Reschedule · reassign open house to Daniel
              </button>
              <button type="button" className="btn ghost" onClick={() => setGuardResolved(true)}>
                Keep both
              </button>
            </div>
          </div>
        )}
        <div className="cal-list">
          <div className="cal-item">
            <span className="tm">Wed 9:00</span>
            <span className="cx2">Listing appointment — 88 Cedar Bluff</span>
          </div>
          <div className="cal-item">
            <span className="tm">Thu 1:00</span>
            <span className="cx2">Closing — 214 Highland Park signing</span>
          </div>
          <div className="cal-item">
            <span className="tm">Fri 11:00</span>
            <span className="cx2">Buyer tour — 3 homes, Boise foothills</span>
          </div>
        </div>
      </div>

      <div className="footnote">
        <b>Generated demo data.</b> Closings/inspections pull from transaction file checklists, market from the MLS (SkySlope),
        lead timers from CRM, and the calendar guard from your connected calendar — <b>the live integrations are the design-partner
        roadmap</b>. Nothing here is a live production account.
      </div>

      <div className={`demo-toast ${toast ? "show" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>

      <style jsx>{`
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
        .queue {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .qcard {
          border: 1px solid var(--line);
          border-radius: 12px;
          background: var(--surface);
          overflow: hidden;
        }
        .qcard.r {
          border-color: color-mix(in srgb, var(--red) 40%, var(--line));
        }
        .qcard.y {
          border-color: color-mix(in srgb, var(--yellow) 38%, var(--line));
        }
        .qhead {
          width: 100%;
          display: grid;
          grid-template-columns: 34px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 13px 15px;
          border: 0;
          background: transparent;
          color: inherit;
          font: inherit;
          text-align: left;
          cursor: pointer;
        }
        .qhead:hover {
          background: var(--raise);
        }
        .qic {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          border: 1px solid var(--line);
          background: var(--panel);
          display: grid;
          place-items: center;
          color: var(--copper-soft);
        }
        .qmid {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .qtype {
          font-size: 9.5px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted);
          font-weight: 600;
        }
        .qtitle {
          font-size: 14.5px;
          color: var(--text);
        }
        .qmeta {
          font-size: 12px;
          color: var(--muted);
        }
        .qwarn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 5px;
          font-size: 11.5px;
          color: var(--red);
        }
        .qwarn :global(svg) {
          width: 13px;
          height: 13px;
          flex: none;
        }
        .qright {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .qtime {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-soft);
          white-space: nowrap;
        }
        .qchev {
          color: var(--muted);
          display: inline-flex;
          transition: transform 0.18s;
        }
        .qbody {
          padding: 4px 15px 14px 61px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          border-top: 1px solid var(--line-soft);
        }
        .task {
          display: flex;
          gap: 9px;
          align-items: flex-start;
          font-size: 12.5px;
        }
        .tbox {
          width: 16px;
          height: 16px;
          border-radius: 5px;
          border: 1px solid var(--line);
          flex: none;
          margin-top: 1px;
          display: grid;
          place-items: center;
        }
        .tbox.done {
          background: var(--green);
          border-color: var(--green);
          color: var(--ink);
        }
        .tbox.miss {
          border-color: color-mix(in srgb, var(--red) 50%, var(--line));
        }
        .tbox :global(svg) {
          width: 11px;
          height: 11px;
        }
        .task .tt {
          color: var(--text-soft);
        }
        .task.done .tt {
          color: var(--muted);
          text-decoration: line-through;
        }
        .task .file {
          display: block;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--red);
          margin-top: 2px;
        }
        .mi {
          border: 1px solid var(--line);
          border-radius: 12px;
          background: var(--surface);
          padding: 16px;
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
        .meter-word .st {
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
        .subgrid {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 12px;
          margin-top: 12px;
        }
        @media (max-width: 760px) {
          .subgrid {
            grid-template-columns: 1fr;
          }
        }
        .tiers {
          border: 1px solid var(--line);
          border-radius: 11px;
          background: var(--panel);
          padding: 13px;
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
        .dials {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .dial {
          border: 1px solid var(--line);
          border-radius: 11px;
          background: var(--panel);
          padding: 11px 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .dial .dl {
          font-size: 9.5px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted);
        }
        .dwrap {
          position: relative;
          width: 78px;
          height: 78px;
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
          font-size: 16px;
        }
        .dv .u {
          font-size: 8px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-top: 1px;
        }
        .lead {
          border: 1px solid var(--line);
          border-radius: 11px;
          background: var(--surface);
          padding: 13px 14px;
          margin-top: 10px;
        }
        .lead.r {
          border-color: color-mix(in srgb, var(--red) 40%, var(--line));
          background: var(--red-wash);
        }
        .lead.y {
          border-color: color-mix(in srgb, var(--yellow) 38%, var(--line));
        }
        .lead.done {
          opacity: 0.5;
        }
        .lead.done .lact {
          pointer-events: none;
        }
        .lhead {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: baseline;
          flex-wrap: wrap;
        }
        .lnm {
          font-size: 14.5px;
          color: var(--text);
        }
        .lflag {
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .lflag.r {
          color: var(--red);
        }
        .lflag.y {
          color: var(--yellow);
        }
        .lflag.g {
          color: var(--green);
        }
        .lflag :global(svg) {
          width: 12px;
          height: 12px;
        }
        .lmeta {
          font-size: 12.5px;
          color: var(--muted);
          margin-top: 2px;
        }
        .lwhy {
          font-size: 12.5px;
          color: var(--text-soft);
          margin-top: 8px;
          line-height: 1.5;
        }
        .lact {
          display: flex;
          gap: 8px;
          margin-top: 10px;
          flex-wrap: wrap;
        }
        .guard {
          border: 1px solid color-mix(in srgb, var(--red) 40%, var(--line));
          background: var(--red-wash);
          border-radius: 12px;
          padding: 15px;
          transition: border-color 0.2s, background 0.2s;
        }
        .guard.resolved {
          border-color: color-mix(in srgb, var(--green) 40%, var(--line));
          background: var(--green-wash);
        }
        .guard .gh {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--red);
        }
        .guard .gh.ok {
          color: var(--green);
        }
        .guard .gb {
          font-size: 14px;
          color: var(--text);
          margin-top: 9px;
          line-height: 1.5;
        }
        .guard .gb :global(b) {
          color: var(--text);
        }
        .conflict {
          display: flex;
          gap: 12px;
          margin-top: 12px;
          flex-wrap: wrap;
        }
        .cslot {
          flex: 1;
          min-width: 160px;
          border: 1px solid var(--line);
          border-radius: 9px;
          background: var(--surface);
          padding: 11px 12px;
        }
        .cslot .ct {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--red);
        }
        .cslot .cn {
          font-size: 13px;
          color: var(--text);
          margin-top: 3px;
        }
        .cslot .cx {
          font-size: 11.5px;
          color: var(--muted);
          margin-top: 2px;
        }
        .cal-list {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .cal-item {
          display: flex;
          gap: 10px;
          font-size: 13px;
          align-items: baseline;
        }
        .cal-item .tm {
          font-family: var(--font-mono);
          font-size: 11.5px;
          color: var(--copper-soft);
          white-space: nowrap;
          min-width: 62px;
        }
        .cal-item .cx2 {
          color: var(--text-soft);
        }
        .btn {
          font: inherit;
          font-size: 12.5px;
          font-weight: 600;
          border-radius: 8px;
          padding: 7px 13px;
          cursor: pointer;
          border: 1px solid;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: filter 0.15s;
        }
        .btn:hover {
          filter: brightness(1.08);
        }
        .btn.primary {
          background: var(--copper-soft);
          border-color: var(--copper-soft);
          color: var(--ink);
        }
        .btn.urgent {
          background: var(--red);
          border-color: var(--red);
          color: #fff;
        }
        .btn.ghost {
          background: transparent;
          border-color: var(--line);
          color: var(--text-soft);
        }
        .footnote {
          margin-top: 18px;
          font-size: 11.5px;
          color: var(--muted);
          line-height: 1.5;
          border-top: 1px solid var(--line);
          padding-top: 12px;
        }
        .footnote :global(b) {
          color: var(--text-soft);
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
