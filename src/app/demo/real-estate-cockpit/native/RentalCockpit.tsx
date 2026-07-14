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
    reason: "Critical work order open — possible water leak under the kitchen sink, flagged before Thursday's guest — plus a 3.2★ review below the 3.5 threshold.",
    occ: 61,
    adr: 340,
    revpar: 207,
    pace: -8,
    profile: "Medium",
    floor: null,
    maint: [
      { tier: "Critical", st: "Open · WO-4021", t: "Kitchen-sink moisture / leak — pre-arrival check" },
      { tier: "Standard", st: "In progress · 1d", t: "Hot tub pH low" },
    ],
    rating: 3.2,
    rnote: "“A maintenance issue at check-in; slow to respond.” — 2 days ago",
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

// Owner updates & follow-up — close the loop on concerns and prompt proactive
// owner reporting. Generated demo data; "send" is a toast, no real delivery.
type OwnerAction = { id: string; kind: "email" | "text"; flag: Flag; title: string; line: string; subject?: string; body: string };
const OWNER_ACTIONS: OwnerAction[] = [
  {
    id: "brundage-owner",
    kind: "email",
    flag: "r",
    title: "Update the Brundage owner",
    line: "Close the loop on the kitchen-sink work order and the 3.2★ review before the owner hears it from the guest.",
    subject: "Brundage Chalet — kitchen-sink leak resolved, Thursday check-in protected",
    body:
      "Hi,\n\nA heads-up with the resolution already in motion: a pre-arrival moisture check at Brundage Chalet found a small leak under the kitchen sink. Our team replaced the supply hose today and verified it dry ahead of Thursday's check-in — the booking is protected.\n\nWe also responded to the recent 3.2★ review directly. I'll confirm the moment the work order closes.\n\nThis period: 61% occupancy · $340 ADR · $207 RevPAR.\n\nBest,\nYour property team",
  },
  {
    id: "brundage-guest",
    kind: "text",
    flag: "r",
    title: "Reassure the Thursday guest",
    line: "A quick proactive text keeps the arrival smooth and heads off another low review.",
    body:
      "Hi! This is your host team for Brundage Chalet — we did a pre-arrival check and took care of a small kitchen-sink item ahead of your Thursday check-in, so everything's fresh and ready. Anything you need before you arrive, just reply here.",
  },
  {
    id: "sawtooth-report",
    kind: "email",
    flag: "g",
    title: "Send the Sawtooth owner their monthly report",
    line: "Premium-strategy owner — proactively show the numbers behind the plan they chose.",
    subject: "Sawtooth Summit Lodge — your monthly owner report",
    body:
      "Hi,\n\nYour monthly summary for Sawtooth Summit Lodge:\n\n• Occupancy 58% · ADR $714 · RevPAR $414\n• Pacing −18% vs the 3-year benchmark — held intentionally behind your $5,000/wk floor\n• Guest reviews averaging 4.8★\n\nYour asset is priced ~24% above market for comparable >4,000 sq ft homes. This premium strategy has held occupancy below local momentum — exactly as you directed. Happy to revisit the floor whenever you'd like.\n\nBest,\nYour property team",
  },
];

// ── Maintenance Center — bilingual work-order thread (DECISION-009) ───────────
// A contained, generated-data-only work order that lives INSIDE the Brundage
// property file: manager instruction (EN→ES, reviewed before assigning) → assign
// → staff acknowledgment → staff field report (ES→EN, reviewed before reporting)
// → completion evidence → an explicit privacy decision → owner-ready report →
// visible cockpit state change. DECISION-008: the original-language submission is
// canonical truth; each machine translation is clearly labeled, reviewed
// derivative copy, and never overwrites the original. Nothing here persists,
// translates for real, uploads, or sends — every write is simulated.
const MC_STAGES = [
  "reported", // work order open; manager instruction drafted (EN)
  "instrTranslated", // ES translation generated — review before assigning
  "instrApproved", // manager approved the Spanish instruction
  "assigned", // assigned to housekeeping; Seen + Acknowledged auto-generate
  "taskDone", // staff marked the task complete → field report (ES) posts
  "reportTranslated", // EN translation generated — review before reporting
  "reportApproved", // manager approved → evidence + actual cost; Brundage resolves
  "ownerIncluded", // manager included the approved summary in the owner report
] as const;
type McStage = (typeof MC_STAGES)[number];

const WO = {
  property: "Brundage Chalet",
  id: "WO-4021",
  title: "Kitchen sink — moisture check & leak",
  category: "Plumbing",
  openedAt: "Jul 14 · 8:38 AM",
  completedAt: "Jul 14 · 11:20 AM",
  manager: "You",
  assignee: { name: "Rosa M.", team: "Housekeeping" },
  estCost: 120,
  actualCost: 185,
  instruction: {
    en: "Please check under the kitchen sink for moisture, photograph the cabinet floor, and report any odor before the next guest arrives.",
    es: "Por favor, revise si hay humedad debajo del fregadero de la cocina, tome una foto del piso del gabinete e informe si detecta algún olor antes de que llegue el próximo huésped.",
  },
  fieldReport: {
    es: "Encontré una fuga debajo del fregadero. Reemplacé la manguera y confirmé que ya no hay fuga. El costo total fue de $185.",
    en: "I found a leak under the sink. I replaced the hose and confirmed there is no longer a leak. The total cost was $185.",
  },
  photos: [
    { k: "before", label: "Before · cabinet floor" },
    { k: "after", label: "After · hose replaced, dry" },
  ],
  evidence: [
    "Leak located under the kitchen sink",
    "Supply hose replaced",
    "No further leak after a 10-minute run test",
    "Cabinet floor dried — no odor",
  ],
  ownerSummary: {
    issue: "A water leak under the kitchen sink, caught on a pre-arrival moisture check.",
    resolution: "The supply hose was replaced and verified dry; the cabinet floor was cleared with no odor.",
  },
  ts: {
    instr: "8:38 AM",
    instrEs: "8:39 AM",
    instrOk: "8:41 AM",
    assigned: "8:42 AM",
    seen: "9:02 AM",
    ack: "9:05 AM",
    done: "11:14 AM",
    report: "11:16 AM",
    reportEn: "11:17 AM",
    completed: "11:20 AM",
  },
} as const;

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
  const [stage, setStage] = useState<McStage>("reported");
  const [reportSent, setReportSent] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [oaOpen, setOaOpen] = useState<string | null>(null);
  const [oaSubject, setOaSubject] = useState("");
  const [oaBody, setOaBody] = useState("");
  const [oaSent, setOaSent] = useState(false);
  const brundage = PROPS.find((p) => p.n === "Brundage Chalet") ?? null;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const say = (m: string) => {
    setToast(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2400);
  };
  const openOwnerAction = (a: OwnerAction) => {
    if (oaOpen === a.id) { setOaOpen(null); return; }
    setOaOpen(a.id);
    setOaSent(false);
    setOaSubject(a.kind === "email" ? a.subject ?? "" : "");
    setOaBody(a.body);
  };
  const sendOwnerAction = (a: OwnerAction) => {
    setOaSent(true);
    say(a.kind === "text" ? "Message sent to the guest." : "Owner report sent.");
  };

  // Brundage kitchen-sink work-order lifecycle (Maintenance Center).
  const si = MC_STAGES.indexOf(stage);
  const reached = (s: McStage) => si >= MC_STAGES.indexOf(s);
  const jobDone = reached("reportApproved"); // Brundage resolves once the field report is approved
  const started = si > 0; // any action taken beyond the initial reported state
  const ownerReady = reached("ownerIncluded");
  const workStatus = jobDone ? "Completed" : reached("taskDone") ? "In progress" : reached("assigned") ? "Assigned" : "Reported";
  const advance = (to: McStage, msg: string) => {
    setStage(to);
    say(msg);
  };
  const resetJob = () => {
    setStage("reported");
    setReportSent(false);
    say("Maintenance demo reset.");
  };
  // Open counts for Brundage — the Critical work order clears on completion.
  const criticalOpen = jobDone ? 0 : 1;
  const standardOpen = 1; // hot-tub pH ticket stays in progress either way

  return (
    <div className="rental">
      {/* executive brief — the 20-second portfolio read */}
      <div className="brief">
        <span className="eyebrow">Portfolio brief</span>
        <ul className="brief-list">
          <li>
            <span className="bdot" style={{ background: jobDone ? "var(--green)" : started ? "var(--yellow)" : "var(--red)" }} />
            <span>
              {jobDone ? (
                <>
                  <b>Brundage sink leak resolved</b> — hose replaced and verified dry; the owner report is ready; Thursday check-in is safe.
                </>
              ) : started ? (
                <>
                  <b>Brundage work order in progress</b> — the kitchen-sink job is moving through the Maintenance Center below.
                </>
              ) : (
                <>
                  <b>Brundage Chalet is red</b> — a Critical kitchen-sink work order is open ahead of Thursday&apos;s check-in.
                </>
              )}
            </span>
          </li>
          <li>
            <span className="bdot" style={{ background: "var(--yellow)" }} />
            <span>
              Portfolio occupancy is <b>72%</b> and pace runs <b>−5%</b> vs 3-year; two units carry price-drop flags.
            </span>
          </li>
          <li>
            <span className="bdot" style={{ background: "var(--green)" }} />
            <span>
              Blended RevPAR holds at <b>$295</b> and reviews average <b>4.6★</b> across the portfolio.
            </span>
          </li>
        </ul>
      </div>

      {/* one thing first — an obvious action */}
      {jobDone ? (
        <div className="onething alert done">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <p>
            <b>Resolved.</b> Brundage&apos;s kitchen-sink leak is fixed and verified — actual cost ${WO.actualCost}. The bilingual
            work-order thread is on file and the owner report is {ownerReady ? "ready to send" : "one approval away"}.
          </p>
          <button type="button" className="ot-undo" onClick={resetJob}>
            Reset
          </button>
        </div>
      ) : started ? (
        <div className="onething alert done inprog">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 6v6l4 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
          </svg>
          <p>
            <b>Work order {WO.id} in progress.</b> Move the kitchen-sink job through the <b>Maintenance Center</b> below —
            review each translation, complete, then report to the owner.
          </p>
          <button type="button" className="ot-undo" onClick={resetJob}>
            Reset
          </button>
        </div>
      ) : (
        <div className="onething alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          <div className="ot-body">
            <p>
              <b>One thing first — Brundage Chalet is red:</b> a Critical kitchen-sink work order is open ahead of Thursday&apos;s
              check-in, and a fresh 3.2★ review just posted. Send the team instruction and work it today.
            </p>
            <div className="ot-actions">
              <button type="button" className="ot-go" onClick={() => advance("instrTranslated", "Instruction translated to Spanish — review before assigning.")}>
                Send team instruction
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
              {brundage && (
                <button type="button" className="ot-ghost" onClick={() => setOpen(brundage)}>
                  Open property
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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

      {/* maintenance center — bilingual work-order thread inside the property file (DECISION-009) */}
      <div className="section">
        <div className="sh">
          <span className="eyebrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--copper-soft)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2z" />
            </svg>
            Maintenance Center
          </span>
          <span className={`mc-count ${criticalOpen ? "crit" : "clear"}`}>
            {criticalOpen} critical · {standardOpen} standard open
          </span>
        </div>

        <div className={`mc-card ${jobDone ? "done" : ""}`}>
          {/* property-file breadcrumb — the work order lives inside Brundage's Raven file */}
          <div className="mc-crumb">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <path d="M9 22V12h6v10" />
            </svg>
            {WO.property}
            <span className="mc-sep">›</span>
            Work order {WO.id}
          </div>

          <div className="mc-jobhd">
            <span className={`mtag ${jobDone ? "std" : "crit"}`}>{jobDone ? WO.category : `${WO.category} · Critical`}</span>
            <div className="mc-jobmeta">
              <div className="mc-jobt">{WO.title}</div>
              <div className="mc-jobs">
                Opened {WO.openedAt}
                {jobDone ? ` · Completed ${WO.completedAt}` : ""}
              </div>
            </div>
            <span className={`mc-pstatus ${jobDone ? "g" : started ? "y" : "r"}`}>{workStatus}</span>
          </div>

          <div className="mc-meta">
            <div>
              <span className="mc-mk">Assignee</span>
              <span className="mc-mv">{reached("assigned") ? `${WO.assignee.name} · ${WO.assignee.team}` : "Unassigned"}</span>
            </div>
            <div>
              <span className="mc-mk">Est. cost</span>
              <span className="mc-mv">${WO.estCost}</span>
            </div>
            <div>
              <span className="mc-mk">Actual cost</span>
              <span className="mc-mv">{jobDone ? `$${WO.actualCost}` : "—"}</span>
            </div>
          </div>

          <div className="mc-threadhd">
            Work-order thread
            <span className="mc-threadnote">internal · retained in the property file</span>
          </div>

          <div className="mc-thread">
            {/* 1 — manager instruction (EN original) */}
            <div className="mc-item out">
              <div className="mc-ihd">
                <span className="mc-who mgr">You · Manager</span>
                <span className="mc-time">{WO.ts.instr}</span>
              </div>
              <div className="mc-bubble">
                <div className="mc-langrow">
                  <span className="mc-lang orig">EN · Original</span>
                </div>
                <div className="mc-text">{WO.instruction.en}</div>
              </div>
              {stage === "reported" && (
                <button type="button" className="mc-btn" onClick={() => advance("instrTranslated", "Instruction translated to Spanish — review before assigning.")}>
                  Translate to Spanish
                </button>
              )}
            </div>

            {/* 2 — Spanish translation of the instruction (reviewed before assigning) */}
            {reached("instrTranslated") && (
              <div className="mc-item out">
                <div className="mc-ihd">
                  <span className="mc-who auto">Auto-translation</span>
                  <span className="mc-time">{WO.ts.instrEs}</span>
                </div>
                <div className={`mc-bubble ${reached("instrApproved") ? "" : "warn"}`}>
                  <div className="mc-langrow">
                    <span className="mc-lang mt">ES · Translation</span>
                    <span className={`mc-revstate ${reached("instrApproved") ? "ok" : "pending"}`}>
                      {reached("instrApproved") ? "approved" : "Machine translated · review before assigning"}
                    </span>
                  </div>
                  <div className="mc-text" lang="es">{WO.instruction.es}</div>
                  <div className="mc-note">Machine-generated — the English above stays the source of truth.</div>
                </div>
                {stage === "instrTranslated" && (
                  <button type="button" className="mc-btn approve" onClick={() => advance("instrApproved", "Spanish instruction approved — ready to assign.")}>
                    Review &amp; approve
                  </button>
                )}
              </div>
            )}

            {/* 3 — assign to housekeeping */}
            {stage === "instrApproved" && (
              <div className="mc-item">
                <button type="button" className="mc-btn" onClick={() => advance("assigned", `Assigned to ${WO.assignee.name} · ${WO.assignee.team}.`)}>
                  Assign to {WO.assignee.name} · {WO.assignee.team}
                </button>
              </div>
            )}

            {/* 4 — assignment + Seen / Acknowledged (staff side) */}
            {reached("assigned") && (
              <>
                <div className="mc-sysnote">
                  <span className="mc-time">{WO.ts.assigned}</span> Assigned to <b>{WO.assignee.name}</b> · {WO.assignee.team}
                </div>
                <div className="mc-item in">
                  <div className="mc-ihd">
                    <span className="mc-who staff">{WO.assignee.name}</span>
                    <span className="mc-badges">
                      <span className="mc-badge">Seen {WO.ts.seen}</span>
                      <span className="mc-badge ok">Acknowledged {WO.ts.ack}</span>
                    </span>
                  </div>
                  <div className="mc-bubble muted">Entendido — paso antes del próximo check-in.</div>
                </div>
                {stage === "assigned" && (
                  <button type="button" className="mc-check" onClick={() => advance("taskDone", "Task marked complete — field report posted.")}>
                    <span className="mc-checkbox" />
                    Mark task complete
                    <span className="mc-checkhint">staff</span>
                  </button>
                )}
              </>
            )}

            {/* 5 — staff field report (ES original, canonical) */}
            {reached("taskDone") && (
              <div className="mc-item in">
                <div className="mc-ihd">
                  <span className="mc-who staff">{WO.assignee.name}</span>
                  <span className="mc-time">{WO.ts.report}</span>
                </div>
                <div className="mc-bubble">
                  <div className="mc-langrow">
                    <span className="mc-lang orig">ES · Original</span>
                    <span className="mc-canon">canonical · as submitted</span>
                  </div>
                  <div className="mc-text" lang="es">{WO.fieldReport.es}</div>
                </div>
                {stage === "taskDone" && (
                  <button type="button" className="mc-btn" onClick={() => advance("reportTranslated", "Field report translated to English — review before reporting.")}>
                    Translate to English
                  </button>
                )}
              </div>
            )}

            {/* 6 — English translation of the field report (reviewed before reporting) */}
            {reached("reportTranslated") && (
              <div className="mc-item in">
                <div className="mc-ihd">
                  <span className="mc-who auto">Auto-translation</span>
                  <span className="mc-time">{WO.ts.reportEn}</span>
                </div>
                <div className={`mc-bubble ${jobDone ? "" : "warn"}`}>
                  <div className="mc-langrow">
                    <span className="mc-lang mt">EN · Translation</span>
                    <span className={`mc-revstate ${jobDone ? "ok" : "pending"}`}>
                      {jobDone ? "approved" : "Machine translated · review before reporting"}
                    </span>
                  </div>
                  <div className="mc-text">{WO.fieldReport.en}</div>
                  <div className="mc-note">Machine-generated — must be approved before it can appear in the owner report. The Spanish original stays the source of truth.</div>
                </div>
                {stage === "reportTranslated" && (
                  <button type="button" className="mc-btn approve" onClick={() => advance("reportApproved", `Report approved — work order complete, actual cost $${WO.actualCost}.`)}>
                    Review &amp; approve for reporting
                  </button>
                )}
              </div>
            )}

            {/* 7 — completion: evidence, photos, cost (system) */}
            {jobDone && (
              <div className="mc-item sys">
                <div className="mc-sysnote">
                  <span className="mc-time">{WO.ts.completed}</span> Work order <b>completed</b> · actual cost <b>${WO.actualCost}</b>
                </div>
                <div className="mc-evidence">
                  <div className="mc-photos">
                    {WO.photos.map((ph) => (
                      <div className={`mc-photo ${ph.k}`} key={ph.k}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                        <span>{ph.label}</span>
                        <span className="mc-genlabel">generated</span>
                      </div>
                    ))}
                  </div>
                  <ul className="mc-evlist">
                    {WO.evidence.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                  <div className="mc-cost">
                    Est. ${WO.estCost} → Actual <b>${WO.actualCost}</b> <span className="mc-costnote">parts + labor</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* owner report — privacy gate: internal by default, explicit inclusion decision */}
          {jobDone && (
            <div className="mc-owner">
              <div className="mc-ownerhd">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Owner report
                <span className={`mc-revstate ${ownerReady ? "ok" : "pending"}`}>{ownerReady ? "Ready" : "Internal by default"}</span>
              </div>
              {!ownerReady ? (
                <>
                  <div className="mc-privacy">
                    The full team thread and translations stay <b>internal</b>. Choose exactly what the owner sees — the original
                    Spanish is retained for audit, <b>not</b> shown to the owner.
                  </div>
                  <div className="mc-incl">
                    <div className="mc-incl-t">Owner will see — approved only:</div>
                    <ul className="mc-incl-list">
                      <li>Issue — {WO.ownerSummary.issue}</li>
                      <li>Resolution — {WO.ownerSummary.resolution}</li>
                      <li>Team — {WO.assignee.name} · {WO.assignee.team}</li>
                      <li>Opened {WO.openedAt} · Completed {WO.completedAt}</li>
                      <li>Actual cost — ${WO.actualCost}</li>
                      <li>Approved completion evidence + English summary</li>
                    </ul>
                  </div>
                  <button type="button" className="mc-btn approve" onClick={() => advance("ownerIncluded", "Approved summary added to the owner report.")}>
                    Include approved summary in owner report
                  </button>
                </>
              ) : (
                <div className="mc-report">
                  <div className="mc-report-subj">Brundage Chalet — kitchen-sink work order resolved</div>
                  <dl className="mc-rlist">
                    <div>
                      <dt>Issue</dt>
                      <dd>{WO.ownerSummary.issue}</dd>
                    </div>
                    <div>
                      <dt>Resolution</dt>
                      <dd>{WO.ownerSummary.resolution}</dd>
                    </div>
                    <div>
                      <dt>Team</dt>
                      <dd>
                        {WO.assignee.name} · {WO.assignee.team}
                      </dd>
                    </div>
                    <div>
                      <dt>Dates</dt>
                      <dd>
                        Opened {WO.openedAt} · Completed {WO.completedAt}
                      </dd>
                    </div>
                    <div>
                      <dt>Actual cost</dt>
                      <dd>${WO.actualCost}</dd>
                    </div>
                  </dl>
                  <div className="mc-report-foot">Approved English summary is shown to the owner · original Spanish retained for audit (not displayed).</div>
                  <div className="mc-report-act">
                    <button type="button" className="mc-btn approve" disabled={reportSent} onClick={() => { setReportSent(true); say("Owner report — simulated send (demo only)."); }}>
                      {reportSent ? "✓ Simulated" : "Send owner report"}
                    </button>
                    {reportSent && <span className="mc-sent">Demo only · Not actually sent</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mc-foot">
            <span className="mc-datalabel">
              <span className="d" /> Generated demo data · in-app messaging, translation &amp; photos are a design-partner roadmap item
            </span>
            {started && (
              <button type="button" className="mc-reset" onClick={resetJob}>
                Reset demo
              </button>
            )}
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
          {SORTED.map((p) => {
            const resolved = jobDone && p.n === WO.property;
            const flag: Flag = resolved ? "g" : p.flag;
            const word = resolved ? "Resolved" : FLAGWORD[p.flag];
            return (
            <button type="button" className="prow" key={p.n} aria-label={`Open ${p.n}`} onClick={() => setOpen(p)}>
              <span className={`dot ${flag}`} />
              <span className="pname">
                <span className="nm">{p.n}</span>
                <span className={`pill ${flag}`}>{word}</span>
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
            );
          })}
        </div>
      </div>

      {/* owner updates & follow-up — close the loop on concerns + proactive owner reports */}
      <div className="section">
        <div className="sh">
          <span className="eyebrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--copper-soft)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
              <path d="m22 6-10 7L2 6" />
            </svg>
            Owner updates &amp; follow-up
          </span>
          <span className="desc">close the loop on concerns · proactive owner reporting</span>
        </div>
        <div className="oalist">
          {OWNER_ACTIONS.map((a) => {
            const isOpen = oaOpen === a.id;
            return (
              <div className={`ocard ${a.flag}`} key={a.id}>
                <div className="oc-t">{a.title}</div>
                <div className="oc-l">{a.line}</div>
                <button type="button" className="oc-go" aria-expanded={isOpen} onClick={() => openOwnerAction(a)}>
                  {a.kind === "email" ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                      <path d="m22 6-10 7L2 6" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  )}
                  {isOpen ? "Hide draft" : a.kind === "email" ? "Email a report" : "Text the guest"}
                </button>
                {isOpen && (
                  <div className="ocompose">
                    {a.kind === "email" && (
                      <input className="oc-subj" value={oaSubject} onChange={(e) => setOaSubject(e.target.value)} placeholder="Subject" disabled={oaSent} />
                    )}
                    <textarea className="oc-body" value={oaBody} onChange={(e) => setOaBody(e.target.value)} rows={a.kind === "email" ? 8 : 3} disabled={oaSent} />
                    <div className="oc-act">
                      <button type="button" className="oc-send" disabled={oaSent} onClick={() => sendOwnerAction(a)}>
                        {oaSent ? "✓ Sent" : a.kind === "email" ? "Send report" : "Send text"}
                      </button>
                      <button type="button" className="oc-cancel" onClick={() => setOaOpen(null)}>
                        {oaSent ? "Close" : "Cancel"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="footnote">
        <b>Generated demo data.</b> Occupancy/ADR/RevPAR, maintenance tickets, reviews, and booking pace map to the Escapia GraphQL
        feed; strategy profiles &amp; owner floors are stored per property. Live <b>Escapia gateway sync</b> is the design-partner
        roadmap — nothing here is a live production account.
      </div>

      {open && (
        <Drawer
          p={
            jobDone && open.n === WO.property
              ? {
                  ...open,
                  flag: "g",
                  reason: `Kitchen-sink leak repaired & verified today (actual cost $${WO.actualCost}) — Thursday check-in protected.`,
                  maint: [
                    { tier: "Standard", st: "Resolved · today", t: "Kitchen-sink supply hose replaced — verified dry" },
                    ...open.maint.filter((m) => m.tier !== "Critical"),
                  ],
                }
              : open
          }
          onClose={() => setOpen(null)}
          onToast={say}
        />
      )}

      <div className={`demo-toast ${toast ? "show" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>

      <style jsx>{`
        .brief {
          margin-top: 16px;
          border: 1px solid var(--line);
          background: var(--panel);
          border-radius: 11px;
          padding: 13px 15px;
        }
        .brief-list {
          list-style: none;
          margin: 9px 0 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 9px;
        }
        .brief-list li {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          font-size: 13px;
          color: var(--text-soft);
          line-height: 1.5;
        }
        .brief-list :global(b) {
          color: var(--text);
          font-weight: 600;
        }
        .bdot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex: none;
          margin-top: 6px;
        }
        .onething.alert .ot-body {
          flex: 1;
          min-width: 0;
        }
        .onething.alert .ot-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 11px;
        }
        .ot-go {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font: inherit;
          font-size: 12.5px;
          font-weight: 600;
          color: #fff;
          background: var(--red);
          border: 1px solid var(--red);
          border-radius: 999px;
          padding: 7px 14px;
          cursor: pointer;
          transition: filter 0.15s;
        }
        .ot-go:hover {
          filter: brightness(1.08);
        }
        .ot-go :global(svg) {
          width: 14px;
          height: 14px;
          margin: 0;
          color: #fff;
        }
        .ot-ghost {
          font: inherit;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--text-soft);
          background: transparent;
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 7px 14px;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
        }
        .ot-ghost:hover {
          border-color: var(--copper-dim);
          color: var(--text);
        }
        .onething.alert.done {
          align-items: center;
          border-color: color-mix(in srgb, var(--green) 40%, transparent);
          background: var(--green-wash);
        }
        .onething.alert.done :global(svg) {
          color: var(--green);
        }
        .onething.alert.done p {
          flex: 1;
          min-width: 0;
        }
        .onething.alert.done :global(b) {
          color: var(--green);
        }
        .ot-undo {
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          color: var(--muted);
          background: transparent;
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 5px 12px;
          cursor: pointer;
          flex: none;
          transition: color 0.15s, border-color 0.15s;
        }
        .ot-undo:hover {
          color: var(--text);
          border-color: var(--copper-dim);
        }
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
        .oalist {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ocard {
          border: 1px solid var(--line);
          background: var(--surface);
          border-radius: 11px;
          padding: 12px 13px;
        }
        .ocard.r {
          border-color: color-mix(in srgb, var(--red) 32%, var(--line));
        }
        .oc-t {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--text);
        }
        .oc-l {
          font-size: 12px;
          color: var(--text-soft);
          line-height: 1.45;
          margin-top: 3px;
        }
        .oc-go {
          font: inherit;
          font-size: 12.5px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-top: 10px;
          padding: 7px 13px;
          border-radius: 999px;
          cursor: pointer;
          border: 1px solid var(--copper-soft);
          background: var(--copper-soft);
          color: var(--ink);
          transition: filter 0.15s;
        }
        .oc-go:hover {
          filter: brightness(1.06);
        }
        .oc-go :global(svg) {
          width: 14px;
          height: 14px;
        }
        .ocompose {
          margin-top: 11px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .oc-subj,
        .oc-body {
          font: inherit;
          width: 100%;
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 8px;
          color: var(--text);
          padding: 9px 10px;
        }
        .oc-subj {
          font-size: 12.5px;
          font-weight: 600;
        }
        .oc-body {
          font-size: 12.5px;
          line-height: 1.5;
          resize: vertical;
          white-space: pre-wrap;
        }
        .oc-subj:focus,
        .oc-body:focus {
          outline: none;
          border-color: var(--copper-dim);
        }
        .oc-subj:disabled,
        .oc-body:disabled {
          opacity: 0.7;
        }
        .oc-act {
          display: flex;
          gap: 8px;
        }
        .oc-send {
          font: inherit;
          font-size: 12.5px;
          font-weight: 600;
          padding: 7px 14px;
          border-radius: 999px;
          cursor: pointer;
          border: 1px solid var(--copper-soft);
          background: var(--copper-soft);
          color: var(--ink);
        }
        .oc-send:disabled {
          opacity: 0.7;
          cursor: default;
        }
        .oc-cancel {
          font: inherit;
          font-size: 12.5px;
          font-weight: 600;
          padding: 7px 14px;
          border-radius: 999px;
          cursor: pointer;
          border: 1px solid var(--line);
          background: transparent;
          color: var(--text-soft);
        }

        /* ── Maintenance Center — bilingual work-order thread ─── */
        .mc-count {
          font-size: 11px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          padding: 2px 9px;
          border-radius: 999px;
          border: 1px solid var(--line);
          color: var(--muted);
          white-space: nowrap;
        }
        .mc-count.crit {
          color: var(--red);
          border-color: color-mix(in srgb, var(--red) 40%, transparent);
          background: var(--red-wash);
        }
        .mc-count.clear {
          color: var(--green);
          border-color: color-mix(in srgb, var(--green) 40%, transparent);
          background: var(--green-wash);
        }
        .mc-card {
          border: 1px solid color-mix(in srgb, var(--red) 32%, var(--line));
          border-radius: 12px;
          background: var(--surface);
          padding: 14px;
        }
        .mc-card.done {
          border-color: color-mix(in srgb, var(--green) 34%, var(--line));
        }
        .mc-crumb {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--muted);
          margin-bottom: 10px;
        }
        .mc-crumb :global(svg) {
          width: 13px;
          height: 13px;
          flex: none;
          color: var(--copper-soft);
        }
        .mc-sep {
          color: var(--line);
        }
        .mc-jobhd {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          flex-wrap: wrap;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--line-soft);
        }
        .mc-jobmeta {
          flex: 1;
          min-width: 0;
        }
        .mc-jobt {
          font-size: 14px;
          font-weight: 600;
          color: var(--text);
        }
        .mc-jobs {
          font-size: 12px;
          color: var(--muted);
          margin-top: 2px;
        }
        .mc-pstatus {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 3px 8px;
          border-radius: 999px;
          border: 1px solid;
          flex: none;
          white-space: nowrap;
        }
        .mc-pstatus.r {
          color: var(--red);
          border-color: color-mix(in srgb, var(--red) 40%, transparent);
          background: var(--red-wash);
        }
        .mc-pstatus.y {
          color: var(--yellow);
          border-color: color-mix(in srgb, var(--yellow) 40%, transparent);
          background: var(--yellow-wash);
        }
        .mc-pstatus.g {
          color: var(--green);
          border-color: color-mix(in srgb, var(--green) 40%, transparent);
          background: var(--green-wash);
        }
        .mc-meta {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin: 12px 0;
        }
        .mc-meta > div {
          border: 1px solid var(--line);
          border-radius: 9px;
          background: var(--panel);
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }
        .mc-mk {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted);
        }
        .mc-mv {
          font-size: 12.5px;
          color: var(--text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .mc-threadhd {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
          font-size: 10.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--muted);
          margin: 4px 0 10px;
        }
        .mc-threadnote {
          font-size: 10px;
          font-weight: 500;
          text-transform: none;
          letter-spacing: 0;
          color: var(--copper-soft);
        }
        .mc-thread {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .mc-item {
          display: flex;
          flex-direction: column;
          gap: 7px;
          border-left: 2px solid var(--line);
          padding-left: 11px;
        }
        .mc-item.out {
          border-left-color: var(--copper-dim);
        }
        .mc-item.in {
          border-left-color: color-mix(in srgb, var(--green) 45%, var(--line));
        }
        .mc-item.sys {
          border-left-color: var(--line);
        }
        .mc-ihd {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }
        .mc-who {
          font-size: 11.5px;
          font-weight: 700;
          color: var(--text);
        }
        .mc-who.mgr {
          color: var(--copper-soft);
        }
        .mc-who.staff {
          color: color-mix(in srgb, var(--green) 70%, var(--text));
        }
        .mc-who.auto {
          color: var(--muted);
          font-weight: 600;
        }
        .mc-time {
          font-size: 10.5px;
          color: var(--muted);
          font-variant-numeric: tabular-nums;
        }
        .mc-badges {
          display: inline-flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .mc-badge {
          font-size: 9.5px;
          font-weight: 600;
          color: var(--muted);
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 1px 7px;
        }
        .mc-badge.ok {
          color: var(--green);
          border-color: color-mix(in srgb, var(--green) 40%, transparent);
          background: var(--green-wash);
        }
        .mc-bubble {
          border: 1px solid var(--line);
          border-radius: 9px;
          background: var(--panel);
          padding: 10px 11px;
        }
        .mc-bubble.warn {
          border-color: color-mix(in srgb, var(--yellow) 42%, var(--line));
          background: var(--yellow-wash);
        }
        .mc-bubble.muted {
          font-size: 12.5px;
          color: var(--text-soft);
          font-style: italic;
        }
        .mc-langrow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 6px;
        }
        .mc-lang {
          font-size: 9.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 2px 7px;
          border-radius: 999px;
        }
        .mc-lang.orig {
          color: var(--text);
          border: 1px solid var(--copper-dim);
          background: var(--copper-wash);
        }
        .mc-lang.mt {
          color: var(--muted);
          border: 1px solid var(--line);
        }
        .mc-canon {
          font-size: 10px;
          color: var(--copper-soft);
          font-weight: 600;
        }
        .mc-revstate {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          text-align: right;
        }
        .mc-revstate.pending {
          color: var(--yellow);
        }
        .mc-revstate.ok {
          color: var(--green);
        }
        .mc-text {
          font-size: 12.5px;
          color: var(--text);
          line-height: 1.55;
        }
        .mc-note {
          font-size: 11px;
          color: var(--muted);
          margin-top: 7px;
          line-height: 1.45;
        }
        .mc-sysnote {
          font-size: 11.5px;
          color: var(--muted);
          text-align: center;
          padding: 2px 0;
        }
        .mc-sysnote :global(b) {
          color: var(--text-soft);
        }
        .mc-check {
          font: inherit;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--text);
          background: var(--panel);
          border: 1px solid var(--copper-dim);
          border-radius: 9px;
          padding: 9px 12px;
          cursor: pointer;
          align-self: flex-start;
        }
        .mc-check:hover {
          border-color: var(--copper-soft);
        }
        .mc-checkbox {
          width: 15px;
          height: 15px;
          border-radius: 4px;
          border: 1.5px solid var(--copper-soft);
          flex: none;
        }
        .mc-checkhint {
          font-size: 9.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--muted);
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 1px 6px;
        }
        .mc-evidence {
          margin-top: 9px;
          font-size: 12.5px;
        }
        .mc-photos {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 10px;
        }
        .mc-photo {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 11px;
          color: var(--muted);
          border: 1px dashed var(--line);
          border-radius: 8px;
          padding: 9px 10px;
        }
        .mc-photo :global(svg) {
          width: 14px;
          height: 14px;
          flex: none;
        }
        .mc-photo span:first-of-type {
          flex: 1;
          min-width: 0;
        }
        .mc-photo.after {
          border-color: color-mix(in srgb, var(--green) 35%, var(--line));
        }
        .mc-genlabel {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--copper-soft);
          border: 1px solid var(--copper-dim);
          border-radius: 999px;
          padding: 1px 6px;
          flex: none;
        }
        .mc-evlist {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .mc-evlist li {
          position: relative;
          padding-left: 20px;
          color: var(--text-soft);
          line-height: 1.4;
        }
        .mc-evlist li::before {
          content: "✓";
          position: absolute;
          left: 0;
          top: 0;
          color: var(--green);
          font-weight: 700;
        }
        .mc-cost {
          font-size: 13px;
          color: var(--text-soft);
          margin-top: 10px;
        }
        .mc-cost :global(b) {
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          font-size: 15px;
          color: var(--text);
        }
        .mc-costnote {
          font-size: 11px;
          color: var(--muted);
          margin-left: 6px;
        }
        .mc-btn {
          font: inherit;
          font-size: 12.5px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 14px;
          border-radius: 999px;
          cursor: pointer;
          border: 1px solid var(--copper-soft);
          background: var(--copper-soft);
          color: var(--ink);
          align-self: flex-start;
          transition: filter 0.15s;
        }
        .mc-btn:hover {
          filter: brightness(1.06);
        }
        .mc-btn.approve {
          border-color: color-mix(in srgb, var(--green) 55%, transparent);
          background: color-mix(in srgb, var(--green) 22%, var(--surface));
          color: var(--text);
        }
        .mc-btn:disabled {
          opacity: 0.7;
          cursor: default;
        }
        .mc-owner {
          margin-top: 14px;
          border: 1px solid var(--copper-dim);
          background: var(--copper-wash);
          border-radius: 11px;
          padding: 13px;
        }
        .mc-ownerhd {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--copper-soft);
        }
        .mc-ownerhd :global(svg) {
          width: 15px;
          height: 15px;
          flex: none;
        }
        .mc-ownerhd .mc-revstate {
          margin-left: auto;
        }
        .mc-privacy {
          font-size: 12px;
          color: var(--text-soft);
          line-height: 1.5;
          margin-top: 9px;
        }
        .mc-privacy :global(b) {
          color: var(--text);
        }
        .mc-incl {
          margin: 10px 0;
          border: 1px solid var(--line);
          border-radius: 9px;
          background: var(--panel);
          padding: 10px 11px;
        }
        .mc-incl-t {
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--green);
          margin-bottom: 7px;
        }
        .mc-incl-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .mc-incl-list li {
          position: relative;
          padding-left: 18px;
          font-size: 12px;
          color: var(--text-soft);
          line-height: 1.45;
        }
        .mc-incl-list li::before {
          content: "✓";
          position: absolute;
          left: 0;
          top: 0;
          color: var(--green);
          font-weight: 700;
        }
        .mc-report {
          border: 1px solid var(--line);
          background: var(--panel);
          border-radius: 10px;
          padding: 12px;
        }
        .mc-report-subj {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--text);
        }
        .mc-rlist {
          margin: 9px 0 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .mc-rlist > div {
          display: grid;
          grid-template-columns: 92px 1fr;
          gap: 10px;
          align-items: baseline;
        }
        .mc-rlist dt {
          font-size: 9.5px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted);
          font-weight: 700;
        }
        .mc-rlist dd {
          margin: 0;
          font-size: 12.5px;
          color: var(--text);
          line-height: 1.5;
        }
        .mc-report-foot {
          font-size: 11px;
          color: var(--copper-soft);
          margin-top: 10px;
          line-height: 1.45;
        }
        .mc-report-act {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 11px;
          flex-wrap: wrap;
        }
        .mc-sent {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: var(--muted);
        }
        .mc-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 13px;
          padding-top: 12px;
          border-top: 1px solid var(--line-soft);
        }
        .mc-datalabel {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 11px;
          color: var(--muted);
        }
        .mc-datalabel .d {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--copper-soft);
          flex: none;
        }
        .mc-reset {
          font: inherit;
          font-size: 11.5px;
          font-weight: 600;
          color: var(--muted);
          background: transparent;
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 5px 12px;
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
        }
        .mc-reset:hover {
          color: var(--text);
          border-color: var(--copper-dim);
        }
        @media (max-width: 480px) {
          .mc-meta {
            grid-template-columns: 1fr;
          }
          .mc-photos {
            grid-template-columns: 1fr;
          }
          .mc-rlist > div {
            grid-template-columns: 1fr;
            gap: 2px;
          }
        }
        .onething.alert.done.inprog {
          border-color: color-mix(in srgb, var(--yellow) 40%, transparent);
          background: var(--yellow-wash);
        }
        .onething.alert.done.inprog :global(svg) {
          color: var(--yellow);
        }
        .onething.alert.done.inprog :global(b) {
          color: var(--text);
        }
        .rental :global(.backdrop) {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.55);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s;
          z-index: 40;
        }
        .rental :global(.backdrop.show) {
          opacity: 1;
          pointer-events: auto;
        }
        .rental :global(.drawer) {
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
        .rental :global(.drawer.show) {
          transform: none;
        }
        .rental :global(.dclose) {
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
        .rental :global(.dclose:hover) {
          color: var(--text);
        }
        .rental :global(.dclose svg) {
          width: 15px;
          height: 15px;
        }
        .rental :global(.dhd) {
          display: flex;
          gap: 11px;
          align-items: flex-start;
          padding-right: 36px;
          border-bottom: 1px solid var(--line);
          padding-bottom: 15px;
        }
        .rental :global(.dflag) {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          margin-top: 6px;
          flex: none;
        }
        .rental :global(.dflag.r) {
          background: var(--red);
        }
        .rental :global(.dflag.y) {
          background: var(--yellow);
        }
        .rental :global(.dflag.g) {
          background: var(--green);
        }
        .rental :global(.dhd h3) {
          margin: 0;
          font-family: var(--font-display);
          font-size: 23px;
          color: var(--text);
          line-height: 1.05;
        }
        .rental :global(.dreason) {
          font-size: 12.5px;
          color: var(--muted);
          margin-top: 4px;
          line-height: 1.45;
        }
        .rental :global(.dstats) {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 16px;
        }
        .rental :global(.dstats > div) {
          border: 1px solid var(--line);
          border-radius: 9px;
          background: var(--panel);
          padding: 10px 11px;
          text-align: center;
        }
        .rental :global(.dstats .dk) {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted);
        }
        .rental :global(.dstats .dv2) {
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          font-size: 17px;
          margin-top: 5px;
          display: block;
          color: var(--text);
        }
        .rental :global(.dsec) {
          font-size: 10.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--muted);
          margin: 20px 0 8px;
        }
        .rental :global(.mrow) {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 9px 0;
          border-top: 1px solid var(--line-soft);
          font-size: 12.5px;
        }
        .rental :global(.mrow:first-of-type) {
          border-top: 0;
        }
        .rental :global(.mtag) {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 1px 6px;
          border-radius: 999px;
          flex: none;
          margin-top: 1px;
        }
        .rental :global(.mtag.crit) {
          color: var(--red);
          border: 1px solid color-mix(in srgb, var(--red) 40%, transparent);
          background: var(--red-wash);
        }
        .rental :global(.mtag.std) {
          color: var(--muted);
          border: 1px solid var(--line);
        }
        .rental :global(.mrow .mt) {
          color: var(--text-soft);
        }
        .rental :global(.mrow .ms) {
          color: var(--muted);
          font-size: 11px;
          margin-top: 1px;
        }
        .rental :global(.revbox) {
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid var(--line);
          border-radius: 9px;
          background: var(--panel);
          padding: 12px;
        }
        .rental :global(.revbox .rr) {
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          font-size: 26px;
        }
        .rental :global(.revbox .rn) {
          font-size: 12px;
          color: var(--muted);
          line-height: 1.4;
        }
        .rental :global(.seg) {
          display: flex;
          border: 1px solid var(--line);
          border-radius: 9px;
          overflow: hidden;
          margin-top: 2px;
        }
        .rental :global(.seg button) {
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
        .rental :global(.seg button:last-child) {
          border-right: 0;
        }
        .rental :global(.seg button[aria-pressed="true"]) {
          color: var(--ink);
          background: var(--copper-soft);
          font-weight: 600;
        }
        .rental :global(.strat-note) {
          margin-top: 10px;
          font-size: 12.5px;
          line-height: 1.5;
          border-radius: 9px;
          padding: 11px 12px;
        }
        .rental :global(.strat-note.drop) {
          border: 1px solid color-mix(in srgb, var(--yellow) 40%, var(--line));
          background: var(--yellow-wash);
          color: var(--text);
        }
        .rental :global(.strat-note.suppress) {
          border: 1px solid var(--copper-dim);
          background: var(--copper-wash);
          color: var(--text);
        }
        .rental :global(.strat-note.ok) {
          border: 1px solid var(--line);
          background: var(--panel);
          color: var(--text-soft);
        }
        .rental :global(.strat-note b) {
          color: var(--text);
        }
        .rental :global(.ownerbox) {
          margin-top: 12px;
          border: 1px solid var(--copper-dim);
          background: var(--copper-wash);
          border-radius: 10px;
          padding: 13px;
        }
        .rental :global(.ownerbox .ot) {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--copper-soft);
        }
        .rental :global(.ownerbox .oq) {
          font-size: 13px;
          color: var(--text);
          margin-top: 7px;
          line-height: 1.55;
          font-style: italic;
        }
        .rental :global(.obtn) {
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
        .rental :global(.obtn svg) {
          width: 13px;
          height: 13px;
        }
        @media (prefers-reduced-motion: reduce) {
          .rental :global(.drawer),
          .rental :global(.backdrop) {
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
