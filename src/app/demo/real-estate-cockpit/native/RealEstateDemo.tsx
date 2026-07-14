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
import { useEffect, useRef, useState } from "react";
import AgentApp from "./AgentApp";
import RentalCockpit from "./RentalCockpit";

// ── Morning briefing audio (go-live preview) ─────────────────────────────────
// Speaks the sign-in briefing aloud so you can hear what a broker/agent gets on
// login. Uses the browser's built-in speech synthesis — no backend, no network,
// so it works on-device today. Pass an optional `audioSrc` to play a pre-recorded
// premium voice clip instead; that's the only change needed to upgrade the voice
// at go-live. Voice/AI is a design-partner roadmap item — nothing records or sends.
const BROKER_BRIEFING =
  "Good morning, Luke. Here's Cascade Realty at a glance. One thing needs you before anything else — a compliance exposure: Whitaker Cole has a missing-disclosure file past deadline. Company-dollar retention is at twenty-eight point four percent against your thirty percent target, with about nine thousand dollars at risk as three agents near their cap. The good news — cash oxygen is healthy at forty-seven days, lead return is blending to four point two times, and the market is accelerating in your favor. Clear the compliance file first, then we'll work the roster.";
const AGENT_BRIEFING =
  "Good morning, Priya. Here's your day. First move: two-fourteen Highland Park funds at two p.m., but two compliance documents are still missing — clear those first. A referral, Sam Ortega, has been unanswered forty-one minutes and is cooling past the thirty-minute line — reach out now. And three files closing this week are on track, with the market moving in your favor. Let's make it a great day.";

function BriefingPlayer({ script, audioSrc }: { script: string; audioSrc?: string }) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<"idle" | "playing" | "nosound">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const hasTTS = typeof window !== "undefined" && "speechSynthesis" in window;
    setSupported(hasTTS || !!audioSrc);
    // Prime the voice list — some browsers populate it asynchronously.
    if (hasTTS) {
      try {
        window.speechSynthesis.getVoices();
      } catch {
        /* ignore */
      }
    }
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
      audioRef.current?.pause();
      if (startTimer.current) clearTimeout(startTimer.current);
    };
  }, [audioSrc]);

  const stop = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (startTimer.current) {
      clearTimeout(startTimer.current);
      startTimer.current = null;
    }
    setStatus("idle");
  };

  const pickVoice = (): SpeechSynthesisVoice | null => {
    const vs = window.speechSynthesis.getVoices();
    if (!vs.length) return null;
    return vs.find((v) => /^en[-_]us$/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || vs[0];
  };

  const start = () => {
    setStatus("playing"); // optimistic; onstart confirms, the timeout corrects if it stays silent
    // Pre-recorded premium clip path — drop in `audioSrc` at go-live and this wins.
    if (audioSrc) {
      const a = audioRef.current ?? new Audio(audioSrc);
      audioRef.current = a;
      a.onplaying = () => setStatus("playing");
      a.onended = () => setStatus("idle");
      a.onerror = () => setStatus("nosound");
      a.currentTime = 0;
      a.play().catch(() => setStatus("nosound"));
      return;
    }
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setStatus("nosound");
      return;
    }
    const synth = window.speechSynthesis;
    if (synth.speaking) synth.cancel();
    const voice = pickVoice();
    // Split into sentences so no single utterance trips Chrome's ~15-second cutoff.
    const parts = (script.match(/[^.!?]+[.!?]*/g) ?? [script]).map((p) => p.trim()).filter(Boolean);
    let started = false;
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p);
      if (voice) u.voice = voice;
      u.lang = voice?.lang || "en-US";
      u.rate = 1;
      u.pitch = 1;
      u.onstart = () => {
        started = true;
        setStatus("playing");
        if (startTimer.current) {
          clearTimeout(startTimer.current);
          startTimer.current = null;
        }
      };
      if (i === parts.length - 1) u.onend = () => setStatus("idle");
      u.onerror = () => {
        if (!started) setStatus("nosound");
      };
      synth.speak(u);
    });
    // If nothing has begun ~1.6s after the tap, audio is almost certainly muted / no voice.
    if (startTimer.current) clearTimeout(startTimer.current);
    startTimer.current = setTimeout(() => {
      if (!started) setStatus("nosound");
    }, 1600);
  };

  if (!supported) return null;
  const playing = status === "playing";
  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
      <button
        type="button"
        onClick={playing ? stop : start}
        aria-label={playing ? "Stop the morning briefing" : "Play your morning briefing"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "7px 13px",
          borderRadius: 999,
          border: "1px solid var(--copper-dim)",
          background: "var(--copper-wash)",
          color: "var(--copper-soft)",
          font: "inherit",
          fontSize: 12.5,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {playing ? (
            <>
              <rect x="6" y="5" width="4" height="14" />
              <rect x="14" y="5" width="4" height="14" />
            </>
          ) : (
            <>
              <path d="M11 5 6 9H2v6h4l5 4z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
            </>
          )}
        </svg>
        {playing ? "Stop briefing" : "Play your morning briefing"}
        {!audioSrc && (
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.7 }}>demo voice</span>
        )}
      </button>
      {status === "nosound" && (
        <span style={{ fontSize: 11, color: "var(--muted)", maxWidth: 340, lineHeight: 1.4 }}>
          No sound? Turn the volume up — and on iPhone flip the silent switch off. This plays through your device&apos;s built-in voice; a premium voice can be dropped in for go-live.
        </span>
      )}
    </div>
  );
}

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

// Directional trend chip — every tracked metric carries a quantified change.
type Dir = "up" | "down" | "flat";
function Trend({ dir, good, children }: { dir: Dir; good?: boolean; children: React.ReactNode }) {
  const arrow = dir === "flat" ? "→" : dir === "up" ? "▲" : "▼";
  const cls = dir === "flat" ? "flat" : (good ?? dir === "up") ? "good" : "bad";
  return (
    <span className={`trend ${cls}`}>
      {arrow} {children}
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
  trend: { dir: Dir; good: boolean; label: string };
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
    trend: { dir: "down", good: false, label: "1.2 pts vs last mo" },
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
    trend: { dir: "up", good: true, label: "5 days vs last mo" },
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
    trend: { dir: "up", good: true, label: "0.4× vs last mo" },
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
    trend: { dir: "up", good: true, label: "0.1 vs last mo" },
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

type ApptKind = "showing" | "closing" | "listing" | "inspection" | "call" | "open";
interface AgentAppt {
  when: string;
  kind: ApptKind;
  what: string;
  who: string;
}
const APPT_LABEL: Record<ApptKind, string> = {
  showing: "Showing",
  closing: "Closing",
  listing: "Listing",
  inspection: "Inspection",
  call: "Call",
  open: "Open house",
};

interface AgentRow {
  key: string;
  name: string;
  role: string;
  gci: string;
  capPct: number;
  cap: string;
  roi: string;
  tone: Tone;
  status: string;
  flag?: string;
  detail: { pipeline: string; response: string; note: string };
  cal: AgentAppt[];
}

// Exceptions-first: the two agents who need the broker lead the roster.
const AGENTS: AgentRow[] = [
  {
    key: "whitaker",
    name: "Whitaker Cole",
    role: "Senior agent",
    gci: "$41.2k",
    capPct: 0.86,
    cap: "86% to cap",
    roi: "0.8×",
    tone: "red",
    status: "Needs you",
    flag: "Missing legal disclosures on a Pending file — 26h in, past the 24h deadline.",
    detail: {
      pipeline: "4 active · 1 Pending at risk · 2 buyer-side, 1 listing",
      response: "Avg response 9.1h — slowest on the roster",
      note: "Strong closer, weak on compliance hygiene. The disclosure gap is a liability today; his lead ROI is under 1× because spend outruns closings.",
    },
    cal: [
      { when: "Wed 2:00 PM", kind: "closing", what: "214 Highland Park", who: "Osei family" },
      { when: "Thu 11:00 AM", kind: "listing", what: "88 Cedar Bluff", who: "Rivera" },
      { when: "Fri 4:30 PM", kind: "showing", what: "3 homes · foothills", who: "Jordan Blake" },
    ],
  },
  {
    key: "chloe",
    name: "Chloe Bennett",
    role: "Agent",
    gci: "$22.8k",
    capPct: 0.34,
    cap: "34% to cap",
    roi: "1.1×",
    tone: "yellow",
    status: "Stalled",
    flag: "Pipeline hasn't advanced a stage in 11 days — 3 leads going cold.",
    detail: {
      pipeline: "5 active · 0 Pending · all buyer-side, early stage",
      response: "Avg response 5.4h",
      note: "Volume is fine, conversion is stuck. A coaching touch on follow-up cadence likely unblocks two of the three cold leads.",
    },
    cal: [
      { when: "Wed 5:00 PM", kind: "showing", what: "1102 Alderwood", who: "The Whitfields" },
      { when: "Thu 1:00 PM", kind: "call", what: "Saved-search match", who: "Dana Whitfield" },
      { when: "Sat 10:00 AM", kind: "open", what: "77 Ridgeline", who: "public" },
    ],
  },
  {
    key: "priya",
    name: "Priya Nair",
    role: "Top producer",
    gci: "$68.5k",
    capPct: 0.71,
    cap: "71% to cap",
    roi: "6.9×",
    tone: "green",
    status: "On track",
    detail: {
      pipeline: "6 active · 2 Pending · balanced buy/list",
      response: "Avg response 1.2h — fastest on the roster",
      note: "The blend's best lead ROI. Nearing cap — company dollar on her deals compresses next month; nothing to fix.",
    },
    cal: [
      { when: "Wed 3:30 PM", kind: "closing", what: "9 Maple Row", who: "Nguyen" },
      { when: "Fri 9:00 AM", kind: "listing", what: "512 Foothills Dr", who: "Park" },
    ],
  },
  {
    key: "theo",
    name: "Theo Alvarez",
    role: "Agent",
    gci: "$31.0k",
    capPct: 0.48,
    cap: "48% to cap",
    roi: "3.4×",
    tone: "green",
    status: "On track",
    detail: {
      pipeline: "4 active · 1 Pending · listing-heavy",
      response: "Avg response 2.8h",
      note: "Steady, on-target lead ROI. No action needed this week.",
    },
    cal: [
      { when: "Thu 2:00 PM", kind: "inspection", what: "640 Birchwood", who: "Alvarez buyer" },
      { when: "Fri 12:00 PM", kind: "listing", what: "210 Sun Valley Rd", who: "Kowalski" },
    ],
  },
  {
    key: "sofia",
    name: "Sofia Reyes",
    role: "Agent",
    gci: "$27.6k",
    capPct: 0.4,
    cap: "40% to cap",
    roi: "3.0×",
    tone: "green",
    status: "On track",
    detail: {
      pipeline: "3 active · 1 Pending · buyer-side",
      response: "Avg response 3.1h",
      note: "Right at the target ROI line. Consistent; watch for a lead-volume dip.",
    },
    cal: [
      { when: "Wed 4:00 PM", kind: "showing", what: "2 condos · downtown", who: "Reyes referral" },
      { when: "Fri 3:00 PM", kind: "closing", what: "45 Aspen Ct — prep", who: "Delgado" },
    ],
  },
  {
    key: "drew",
    name: "Drew Halloran",
    role: "New agent",
    gci: "$12.4k",
    capPct: 0.16,
    cap: "16% to cap",
    roi: "2.2×",
    tone: "green",
    status: "Ramping",
    detail: {
      pipeline: "2 active · 0 Pending · buyer-side",
      response: "Avg response 4.0h",
      note: "First quarter on the desk. ROI already above break-even — ramping as expected.",
    },
    cal: [
      { when: "Thu 10:30 AM", kind: "open", what: "Shadowing Priya", who: "77 Ridgeline" },
      { when: "Fri 1:30 PM", kind: "showing", what: "First solo showing", who: "Lindqvist" },
    ],
  },
];

// Per-agent GCI month-over-month change.
const GCI_TREND: Record<string, { dir: Dir; good: boolean; label: string }> = {
  whitaker: { dir: "up", good: true, label: "8%" },
  chloe: { dir: "down", good: false, label: "4%" },
  priya: { dir: "up", good: true, label: "15%" },
  theo: { dir: "up", good: true, label: "6%" },
  sofia: { dir: "flat", good: true, label: "2%" },
  drew: { dir: "up", good: true, label: "22%" },
};

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
      <span className="gtrend">
        <Trend dir={g.trend.dir} good={g.trend.good}>
          {g.trend.label}
        </Trend>
      </span>
      <svg className="info" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
    </button>
  );
}

// Clickable calendar entry → a voice-driven AI appointment assistant (DEMO mock).
// Live speech-to-text + AI writing to the CRM/calendar is a backend follow-up (Codex lane).
function ApptDrawer({ appt, onClose }: { appt: AgentAppt; onClose: () => void }) {
  const [phase, setPhase] = useState<"idle" | "listening" | "parsed">("idle");
  const [recap, setRecap] = useState<"idle" | "listening" | "done">("idle");
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const [emailOpen, setEmailOpen] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);
  const who = appt.who;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const t = timers.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      t.forEach(clearTimeout);
    };
  }, [onClose]);

  const listen = () => {
    setPhase("listening");
    timers.current.push(setTimeout(() => setPhase("parsed"), 1300));
  };
  const logRecap = () => {
    setRecap("listening");
    timers.current.push(setTimeout(() => setRecap("done"), 1300));
  };
  const apply = (id: string) => setApplied((p) => ({ ...p, [id]: true }));

  const ACTIONS = [
    {
      id: "resched",
      icon: <path d="M3 4v6h6M3.5 15a9 9 0 1 0 2.1-9.4L3 8" />,
      label: (
        <>
          Reschedule <b>{appt.what}</b> → Thu 2:00 PM
        </>
      ),
      done: "Moved to Thu 2:00 PM · calendar updated",
    },
    {
      id: "hist",
      icon: <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
      label: (
        <>
          Add to <b>{who}</b>&apos;s history: &ldquo;wants a home-warranty quote before signing&rdquo;
        </>
      ),
      done: `Logged to ${who}'s client record`,
    },
    {
      id: "email",
      icon: <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6" />,
      label: (
        <>
          Draft a follow-up email to <b>{who}</b>
        </>
      ),
      done: "Draft ready below",
      isEmail: true,
    },
    {
      id: "remind",
      icon: <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />,
      label: (
        <>
          Set reminder: &ldquo;send <b>{who}</b> the utility-transfer checklist&rdquo; · Mon 8:00 AM
        </>
      ),
      done: "Reminder set on your calendar · you'll be alerted Mon 8:00 AM",
    },
  ];

  return (
    <>
      <div className="backdrop show" onClick={onClose} />
      <aside className="apptd show" role="dialog" aria-modal="true" aria-label="Appointment assistant">
        <button type="button" className="apptd-x" aria-label="Close" onClick={onClose} ref={closeRef}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="apptd-hd">
          <span className={`akind ${appt.kind}`}>{APPT_LABEL[appt.kind]}</span>
          <div className="apptd-when">{appt.when}</div>
        </div>
        <h3 className="apptd-what">{appt.what}</h3>
        <div className="apptd-who">{who}</div>

        {/* update by voice */}
        <div className="vsec">
          <span className="vlabel">Update by voice</span>
          <button type="button" className={`mic ${phase === "listening" ? "live" : ""}`} onClick={listen}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
            </svg>
            {phase === "idle" ? "Speak to update" : phase === "listening" ? "Listening…" : "Re-record"}
          </button>
          {phase === "listening" && <div className="vwave"><span /><span /><span /><span /><span /></div>}
          {phase === "parsed" && (
            <>
              <div className="vquote">
                &ldquo;Move {who}&apos;s {appt.what.toLowerCase()} to Thursday at 2 — and note they want a home-warranty
                quote before signing. Remind me to send the utility-transfer checklist Monday.&rdquo;
              </div>
              <div className="vcap">AI picked up 4 actions — apply the ones you want:</div>
              {ACTIONS.map((a) => (
                <div className={`vact ${applied[a.id] ? "done" : ""}`} key={a.id}>
                  <span className="vact-ic">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      {a.icon}
                    </svg>
                  </span>
                  <span className="vact-t">{applied[a.id] ? a.done : a.label}</span>
                  {applied[a.id] ? (
                    <svg className="vact-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    <button
                      type="button"
                      className="vact-go"
                      onClick={() => {
                        apply(a.id);
                        if (a.isEmail) setEmailOpen(true);
                      }}
                    >
                      {a.isEmail ? "Open draft" : "Apply"}
                    </button>
                  )}
                </div>
              ))}
              {emailOpen && (
                <div className="vemail">
                  <div className="vem-row"><span>To</span> {who}</div>
                  <div className="vem-row"><span>Subject</span> Following up on your {appt.what.toLowerCase()}</div>
                  <div className="vem-body">
                    Hi {who} — great connecting today. As promised I&apos;ll send over the home-warranty quote before we
                    sign, and I&apos;ve noted your questions. I&apos;ll also forward the utility-transfer checklist so
                    everything&apos;s ready for closing. Anything else on your mind, just reply here.
                  </div>
                  <button type="button" className="vem-send" disabled={applied.emailsent} onClick={() => apply("emailsent")}>
                    {applied.emailsent ? "✓ Sent" : "Send email"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* after the appointment */}
        <div className="vsec">
          <span className="vlabel">After the appointment</span>
          <button type="button" className={`mic ${recap === "listening" ? "live" : ""}`} onClick={logRecap}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
            </svg>
            {recap === "idle" ? "Log how it went" : recap === "listening" ? "Listening…" : "Re-record recap"}
          </button>
          {recap === "listening" && <div className="vwave"><span /><span /><span /><span /><span /></div>}
          {recap === "done" && (
            <>
              <div className="vquote">
                &ldquo;{who} is ready to move forward — really happy with the place. They asked about the school-district
                boundary, and mentioned wanting to look at a rental property in the fall.&rdquo;
              </div>
              <div className="vsent">
                <span className="vsent-dot" /> Positive · client ready to proceed
              </div>
              <div className="vlog">
                <div className="vlog-row">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  Recap saved to {who}&apos;s client history
                </div>
                <div className="vlog-row">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  Answered: school-district boundary sent to {who}
                </div>
                <div className="vlog-row future">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
                  Future expectation — <b>revisit rental-property purchase (fall)</b> → reminder set for <b>Sep 1</b>, you&apos;ll be alerted
                </div>
              </div>
            </>
          )}
        </div>

        <div className="apptd-foot">Generated demo — voice &amp; AI actions are mocked. Live capture writes to the CRM &amp; calendar (roadmap).</div>
      </aside>

      <style jsx>{`
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
        .apptd {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(460px, 100%);
          background: var(--surface);
          border-left: 1px solid var(--line);
          z-index: 50;
          transform: translateX(101%);
          transition: transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
          overflow-y: auto;
          padding: 22px 20px 40px;
        }
        .apptd.show {
          transform: none;
        }
        .apptd-x {
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
        .apptd-x:hover {
          color: var(--text);
        }
        .apptd-x :global(svg) {
          width: 15px;
          height: 15px;
        }
        .apptd-hd {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-right: 36px;
        }
        .apptd .akind {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 2px 7px;
          border-radius: 999px;
          border: 1px solid var(--line);
          flex: none;
        }
        .apptd .akind.closing {
          color: var(--green);
          border-color: color-mix(in srgb, var(--green) 40%, transparent);
          background: var(--green-wash);
        }
        .apptd .akind.showing,
        .apptd .akind.listing,
        .apptd .akind.open {
          color: var(--copper-soft);
          border-color: var(--copper-dim);
          background: var(--copper-wash);
        }
        .apptd .akind.inspection {
          color: var(--yellow);
          border-color: color-mix(in srgb, var(--yellow) 40%, transparent);
          background: var(--yellow-wash);
        }
        .apptd .akind.call {
          color: var(--muted);
        }
        .apptd-when {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-soft);
        }
        .apptd-what {
          margin: 12px 0 0;
          font-family: var(--font-display);
          font-size: 23px;
          color: var(--text);
          line-height: 1.1;
        }
        .apptd-who {
          font-size: 13px;
          color: var(--copper-soft);
          margin-top: 3px;
        }
        .vsec {
          margin-top: 20px;
          border-top: 1px solid var(--line);
          padding-top: 15px;
        }
        .vlabel {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--muted);
        }
        .mic {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 9px;
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          color: var(--ink);
          background: var(--copper-soft);
          border: 1px solid var(--copper-soft);
          border-radius: 999px;
          padding: 8px 15px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .mic:hover {
          background: var(--copper);
        }
        .mic.live {
          color: #fff;
          background: var(--red);
          border-color: var(--red);
        }
        .mic :global(svg) {
          width: 15px;
          height: 15px;
        }
        .vwave {
          display: flex;
          align-items: center;
          gap: 4px;
          height: 26px;
          margin-top: 11px;
        }
        .vwave span {
          width: 3px;
          height: 100%;
          border-radius: 3px;
          background: var(--red);
          animation: vw 0.9s ease-in-out infinite;
        }
        .vwave span:nth-child(2) { animation-delay: 0.12s; }
        .vwave span:nth-child(3) { animation-delay: 0.24s; }
        .vwave span:nth-child(4) { animation-delay: 0.36s; }
        .vwave span:nth-child(5) { animation-delay: 0.48s; }
        @keyframes vw {
          0%, 100% { transform: scaleY(0.3); opacity: 0.5; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        .vquote {
          margin-top: 12px;
          border-left: 2px solid var(--copper-dim);
          padding: 2px 0 2px 12px;
          font-size: 13.5px;
          font-style: italic;
          color: var(--text-soft);
          line-height: 1.55;
        }
        .vcap {
          margin-top: 12px;
          font-size: 11.5px;
          color: var(--muted);
        }
        .vact {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 8px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--panel);
          padding: 10px 12px;
        }
        .vact.done {
          border-color: color-mix(in srgb, var(--green) 40%, var(--line));
          background: var(--green-wash);
        }
        .vact-ic {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: 1px solid var(--line);
          background: var(--surface);
          color: var(--copper-soft);
          display: grid;
          place-items: center;
          flex: none;
        }
        .vact-ic :global(svg) {
          width: 15px;
          height: 15px;
        }
        .vact-t {
          flex: 1;
          min-width: 0;
          font-size: 12.5px;
          color: var(--text-soft);
          line-height: 1.4;
        }
        .vact.done .vact-t {
          color: var(--text);
        }
        .vact-go {
          font: inherit;
          font-size: 11.5px;
          font-weight: 600;
          color: var(--ink);
          background: var(--copper-soft);
          border: 1px solid var(--copper-soft);
          border-radius: 999px;
          padding: 5px 12px;
          cursor: pointer;
          flex: none;
        }
        .vact-go:hover {
          background: var(--copper);
        }
        .vact-check {
          width: 17px;
          height: 17px;
          color: var(--green);
          flex: none;
        }
        .vemail {
          margin-top: 10px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--panel);
          padding: 12px 13px;
        }
        .vem-row {
          font-size: 12.5px;
          color: var(--text-soft);
          padding: 3px 0;
          border-bottom: 1px solid var(--line-soft);
        }
        .vem-row span {
          display: inline-block;
          width: 52px;
          color: var(--muted);
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .vem-body {
          margin-top: 9px;
          font-size: 12.5px;
          color: var(--text-soft);
          line-height: 1.55;
        }
        .vem-send {
          margin-top: 11px;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          color: var(--ink);
          background: var(--copper-soft);
          border: 1px solid var(--copper-soft);
          border-radius: 999px;
          padding: 6px 13px;
          cursor: pointer;
        }
        .vem-send:disabled {
          background: var(--green);
          border-color: var(--green);
          cursor: default;
        }
        .vsent {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--green);
        }
        .vsent-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--green);
        }
        .vlog {
          margin-top: 11px;
          display: flex;
          flex-direction: column;
          gap: 9px;
        }
        .vlog-row {
          display: flex;
          gap: 9px;
          align-items: flex-start;
          font-size: 12.5px;
          color: var(--text-soft);
          line-height: 1.45;
        }
        .vlog-row :global(svg) {
          width: 15px;
          height: 15px;
          flex: none;
          margin-top: 1px;
          color: var(--green);
        }
        .vlog-row.future {
          border-top: 1px solid var(--line-soft);
          padding-top: 9px;
        }
        .vlog-row.future :global(svg) {
          color: var(--copper-soft);
        }
        .vlog-row :global(b) {
          color: var(--text);
        }
        .apptd-foot {
          margin-top: 22px;
          border-top: 1px solid var(--line);
          padding-top: 12px;
          font-size: 11px;
          color: var(--muted);
          line-height: 1.5;
        }
        @media (prefers-reduced-motion: reduce) {
          .apptd,
          .backdrop {
            transition: none;
          }
          .vwave span {
            animation: none;
          }
        }
      `}</style>
    </>
  );
}

function BrokerCockpit() {
  const [openGauge, setOpenGauge] = useState<string | null>(null);
  const [tickerOpen, setTickerOpen] = useState(false);
  const [openAgent, setOpenAgent] = useState<string | null>(null);
  const [openCal, setOpenCal] = useState<string | null>(null);
  const [activeAppt, setActiveAppt] = useState<AgentAppt | null>(null);
  const [handled, setHandled] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const [reveal, setReveal] = useState<"call" | "email" | null>(null);
  const [sent, setSent] = useState(false);
  const [openBrief, setOpenBrief] = useState<number | null>(null);
  const active = FIN_GAUGES.find((g) => g.key === openGauge) ?? null;
  const needNow = handled ? 1 : 2;

  const openFile = () => {
    setFileOpen(true);
    setReveal(null);
    setSent(false);
    setOpenBrief(null);
  };
  const resolveFile = () => {
    setHandled(true);
    setFileOpen(false);
    setReveal(null);
  };

  const BRIEF: { dot: string; text: React.ReactNode; fix: React.ReactNode; action?: { label: string; onClick: () => void } }[] = [
    {
      dot: handled ? "var(--green)" : "var(--red)",
      text: handled ? (
        <>
          <b>Whitaker&apos;s disclosure file is resolved</b> — the exposure cleared; Chloe&apos;s stalled pipeline is the
          only item still needing you.
        </>
      ) : (
        <>
          <b>One compliance exposure</b> needs you before anything else — a missing-disclosure file past deadline.
        </>
      ),
      fix: (
        <>
          Open Whitaker&apos;s Highland Park file, send the disclosure reminder, and mark it resolved once both forms are
          uploaded. Clearing it removes the liability before the Friday close.
        </>
      ),
      action: { label: "Open the compliance file", onClick: openFile },
    },
    {
      dot: "var(--yellow)",
      text: (
        <>
          Company-dollar retention is <b>28.4%</b> vs a 30% target — ≈$2.4k of company dollar soft, $9.4k at risk as three
          agents near cap.
        </>
      ),
      fix: (
        <>
          Reallocate the two lowest-ROI agents&apos; lead budgets this week and coach pipeline conversion — that recovers
          ≈<b>$2.4k</b> of company dollar and protects the $9.4k nearing cap.
        </>
      ),
    },
    {
      dot: "var(--green)",
      text: (
        <>
          Cash oxygen holds at <b>47 days</b> and lead ROI blends to <b>4.2×</b>; the market is accelerating in your favor.
        </>
      ),
      fix: (
        <>
          Lead with the <b>4.6★</b> company reputation in listing pitches — a quiet trust asset that wins seller mandates
          while the market runs hot.
        </>
      ),
    },
  ];

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
            Executive Cockpit · Wed, June 11
          </span>
          <h1>Welcome, Luke</h1>
          <div className="sub">Cascade Realty Group · Boise, ID · 12 agents</div>
          <BriefingPlayer script={BROKER_BRIEFING} />
        </div>
        <span className="badge partial">
          <span className="tnum">3/4</span> sources
        </span>
      </div>

      {/* executive brief — the 20-second read; each line expands to a suggested fix */}
      <div className="brief">
        <span className="eyebrow">Executive brief · tap a line for the fix</span>
        <ul className="brief-list">
          {BRIEF.map((b, i) => (
            <li key={i}>
              <button type="button" className="brow" aria-expanded={openBrief === i} onClick={() => setOpenBrief(openBrief === i ? null : i)}>
                <span className="bdot" style={{ background: b.dot }} />
                <span className="btext">{b.text}</span>
                <svg className="bchev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {openBrief === i && (
                <div className="bfix">
                  <span className="bfix-label">Suggested fix</span>
                  <p>{b.fix}</p>
                  {b.action && (
                    <button type="button" className="bfix-go" onClick={b.action.onClick}>
                      {b.action.label}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {handled ? (
        <div className="onething done">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <p>
            <b>Resolved.</b> Whitaker&apos;s disclosure reminder is sent and the compliance clock is acknowledged. Next up:
            Chloe Bennett&apos;s stalled pipeline.
          </p>
          <button type="button" className="ot-undo" onClick={() => { setHandled(false); setFileOpen(false); }}>
            Undo
          </button>
        </div>
      ) : (
        <div className="onething">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2zM9 21h6M10 17v4M14 17v4" />
          </svg>
          <div className="ot-body">
            <p>
              <b>One thing first — compliance red flag:</b> Whitaker Cole has missing legal disclosures on a Pending file —
              26h in, past the 24h deadline. Clear it before it&apos;s a liability, then Chloe Bennett&apos;s stalled
              pipeline.
            </p>
            <div className="ot-actions">
              <button type="button" className="ot-go" onClick={openFile}>
                Open Whitaker&apos;s file
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
              <button type="button" className="ot-ghost" onClick={() => setHandled(true)}>
                Mark handled
              </button>
            </div>
          </div>
        </div>
      )}

      {/* the actual file — opens on "Open Whitaker's file" with real remediation actions */}
      {fileOpen && !handled && (
        <div className="cfile">
          <div className="cfile-hd">
            <div>
              <span className="eyebrow">Compliance file · 214 Highland Park</span>
              <div className="cfile-title">Whitaker Cole · Pending · funds Fri Jun 13</div>
            </div>
            <span className="cflag">26h past 24h deadline</span>
            <button type="button" className="cfile-x" aria-label="Close file" onClick={() => setFileOpen(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="cfile-sub">2 required disclosures missing before close:</div>
          <div className="cdocs">
            <div className="cdoc">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6M9 15l6-6M15 15 9 9" />
              </svg>
              <div>
                <div className="cdoc-t">Seller Property Disclosure (SPDS) — unsigned</div>
                <div className="cdoc-f">SPDS_214Highland.pdf</div>
              </div>
            </div>
            <div className="cdoc">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6M12 18v-6M9 15h6" />
              </svg>
              <div>
                <div className="cdoc-t">Lead-Based Paint Disclosure — not uploaded</div>
                <div className="cdoc-f">LBP_214Highland.pdf · awaiting Whitaker</div>
              </div>
            </div>
          </div>

          <div className="cfile-actions">
            <button type="button" className={`cbtn ${reveal === "call" ? "on" : ""}`} onClick={() => setReveal(reveal === "call" ? null : "call")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z" />
              </svg>
              Call Whitaker
            </button>
            <button type="button" className={`cbtn ${reveal === "email" ? "on" : ""}`} onClick={() => { setReveal(reveal === "email" ? null : "email"); setSent(false); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                <path d="m22 6-10 7L2 6" />
              </svg>
              Send reminder
            </button>
            <button type="button" className="cbtn resolve" onClick={resolveFile}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Mark resolved
            </button>
          </div>

          {reveal === "call" && (
            <div className="creveal">
              <span className="crk">Direct line</span>
              <a className="cphone" href="tel:+12085550142">(208) 555-0142</a>
              <span className="crhint">mobile · best before showings · generated demo contact</span>
            </div>
          )}
          {reveal === "email" && (
            <div className="cemail">
              <div className="cem-row"><span>To</span> Whitaker Cole &lt;whitaker@cascaderealty.demo&gt;</div>
              <div className="cem-row"><span>Subject</span> 214 Highland Park — 2 disclosures needed before Friday close</div>
              <div className="cem-body">
                Hi Whitaker — the Seller Property Disclosure signature and the Lead-Based Paint form are still outstanding
                on 214 Highland Park. It funds Friday and is already past the 24-hour compliance window. Can you sign the
                SPDS and upload the LBP today so we clear the file? I&apos;ve attached both forms. Thanks — reply here or
                call if anything&apos;s unclear.
              </div>
              <button type="button" className="cem-send" disabled={sent} onClick={() => { setSent(true); }}>
                {sent ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    Sent to Whitaker
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
                    </svg>
                    Send reminder
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

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

      {/* agent roster — exceptions first, click through to detail */}
      <div className="section">
        <div className="st">
          <span className="eyebrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--copper-soft)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Agent roster
          </span>
          <span className="rmeta">
            12 agents · <b className={needNow > 1 ? "rneed" : "rok"}>{needNow} need you now</b>
          </span>
        </div>
        <div className="roster">
          {AGENTS.map((a) => {
            const cleared = a.key === "whitaker" && handled;
            const tone: Tone = cleared ? "green" : a.tone;
            const status = cleared ? "Opened" : a.status;
            const isOpen = openAgent === a.key;
            return (
              <div className="arow-wrap" key={a.key}>
                <button
                  type="button"
                  className="arow"
                  aria-expanded={isOpen}
                  onClick={() => { setOpenAgent(isOpen ? null : a.key); setOpenCal(null); }}
                >
                  <span className="adot" style={{ background: TONE[tone] }} />
                  <span className="aname">
                    {a.name}
                    <small>{a.role}</small>
                  </span>
                  <span className="acap">
                    <span className="capbar">
                      <span className="capfill" style={{ width: `${Math.round(a.capPct * 100)}%`, background: TONE[tone] }} />
                    </span>
                    <small>{a.cap}</small>
                  </span>
                  <span className="agci">
                    {a.gci}
                    <small>GCI MTD</small>
                    <Trend dir={GCI_TREND[a.key].dir} good={GCI_TREND[a.key].good}>
                      {GCI_TREND[a.key].label} MoM
                    </Trend>
                  </span>
                  <span className="astatus" style={{ color: TONE[tone] }}>
                    {status}
                  </span>
                  <svg className="achev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="adetail">
                    {(cleared || a.flag) && (
                      <div className={`aflag ${cleared ? "aflag-clear" : ""}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                          {cleared ? (
                            <path d="M20 6 9 17l-5-5" />
                          ) : (
                            <path d="M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                          )}
                        </svg>
                        <span>
                          {cleared
                            ? "Disclosure file opened from the cockpit — compliance clock acknowledged, awaiting upload."
                            : a.flag}
                        </span>
                      </div>
                    )}
                    <div className="astats">
                      <div className="astat">
                        <span className="ak">Pipeline</span>
                        <span className="av">{a.detail.pipeline}</span>
                      </div>
                      <div className="astat">
                        <span className="ak">Responsiveness</span>
                        <span className="av">{a.detail.response}</span>
                      </div>
                      <div className="astat">
                        <span className="ak">Lead ROI</span>
                        <span className="av">{a.roi} return on lead spend</span>
                      </div>
                    </div>
                    <p className="anote">{a.detail.note}</p>
                    <div className="acal">
                      <button
                        type="button"
                        className="acal-h"
                        aria-expanded={openCal === a.key}
                        onClick={() => setOpenCal(openCal === a.key ? null : a.key)}
                      >
                        <svg className="acal-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M3 10h18M8 2v4M16 2v4" />
                        </svg>
                        <span className="acal-htxt">Real-estate calendar</span>
                        <span className="acal-count">{a.cal.length} this week</span>
                        <svg className="acal-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                      {openCal === a.key && (
                        <div className="acal-body">
                          <div className="acal-sync">Appointments sync to the client file in your CRM.</div>
                          {a.cal.map((c, i) => (
                            <button type="button" className="acal-row" key={i} onClick={() => setActiveAppt(c)}>
                              <span className="acal-when">{c.when}</span>
                              <span className={`akind ${c.kind}`}>{APPT_LABEL[c.kind]}</span>
                              <span className="acal-what">
                                {c.what}
                                <small>{c.who}</small>
                              </span>
                              <svg className="acal-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 6l6 6-6 6" />
                              </svg>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

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

      {/* your week — follow-ups + upcoming appointments (parity with the agent) */}
      <div className="section">
        <div className="st">
          <span className="eyebrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--copper-soft)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M3 10h18M8 2v4M16 2v4" />
            </svg>
            Your week · follow-ups &amp; appointments
          </span>
          <span style={{ fontSize: "10.5px", color: "var(--muted)", opacity: 0.8 }}>from your connected calendar · live sync on roadmap</span>
        </div>
        <div className="bcal">
          <div className="bcal-col">
            <div className="bcal-h">Follow up on</div>
            {([
              ["r", "Chloe Bennett — stalled-pipeline check-in", "overdue 2d"],
              ["y", "Lead-vendor renewal — go/no-go", "by Jun 20"],
              ["g", "Q3 recruiting — 2 candidates to call back", "this week"],
            ] as [string, string, string][]).map(([flag, t, when]) => (
              <div className="bfollow" key={t}>
                <span className={`fdot ${flag}`} />
                <span className="ft">{t}</span>
                <span className="fw">{when}</span>
              </div>
            ))}
          </div>
          <div className="bcal-col">
            <div className="bcal-h">Coming up</div>
            {([
              { when: "Wed 3:00 PM", kind: "call", what: "Agent 1:1s", who: "Whitaker & Chloe" },
              { when: "Thu 10:00 AM", kind: "call", what: "Brokerage P&L review", who: "leadership" },
              { when: "Fri 9:00 AM", kind: "call", what: "New-agent onboarding", who: "2 new starts" },
              { when: "Mon 8:30 AM", kind: "call", what: "Investor update", who: "investors" },
            ] as AgentAppt[]).map((c) => (
              <button type="button" className="bappt" key={c.what} onClick={() => setActiveAppt(c)}>
                <span className="atm">{c.when}</span>
                <span className="at">
                  {c.what}
                  {c.who ? ` — ${c.who}` : ""}
                </span>
                <svg className="bappt-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* company aura — reputation intelligence for the brokerage */}
      <div className="section">
        <div className="st">
          <span className="eyebrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--copper-soft)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l2.4 5.5L20 9l-4 3.9L17 19l-5-2.8L7 19l1-6.1L4 9l5.6-.5z" />
            </svg>
            Company Aura · reputation
          </span>
          <span style={{ fontSize: "10.5px", color: "var(--muted)", opacity: 0.8 }}>Google + Zillow · updated daily</span>
        </div>
        <div className="aura">
          <div className="aura-top">
            <div className="aura-score">
              <span className="asc">4.6</span>
              <div>
                <div className="astars">
                  ★★★★★ <Trend dir="up" good>0.1 vs last mo</Trend>
                </div>
                <div className="asub">218 reviews · 3.4h avg response</div>
                <div className="asub">4.5★ average over the last 4 weeks — trending up</div>
              </div>
            </div>
            <div className="aura-srcs">
              <div className="asrc">
                <span>Google</span>
                <b>4.7</b>
                <small>142 reviews · <Trend dir="up" good>0.1</Trend></small>
              </div>
              <div className="asrc">
                <span>Zillow</span>
                <b>4.5</b>
                <small>76 reviews · <Trend dir="flat">steady</Trend></small>
              </div>
            </div>
          </div>
          <div className="aura-intent">
            <div className="aint">
              <b>1,240</b>
              <span>profile views</span>
              <Trend dir="up" good>12% vs last mo</Trend>
            </div>
            <div className="aint">
              <b>86</b>
              <span>direction requests</span>
              <Trend dir="up" good>9 vs last mo</Trend>
            </div>
            <div className="aint">
              <b>52</b>
              <span>calls this month</span>
              <Trend dir="up" good>6 vs last mo</Trend>
            </div>
          </div>
          <div className="aura-rev">
            <span className="arev-stars">★★★★★</span>
            <span className="arev-q">&ldquo;Cascade made our first sale effortless — responsive, honest, and on top of every deadline.&rdquo;</span>
            <span className="arev-m">Google · 2 days ago</span>
          </div>
        </div>
      </div>

      <div className="footnote">
        Every figure is <b>generated demo data</b>. Native React port in progress — Agent app &amp; Rental cockpit land next,
        then this replaces the iframe and wires to a demo-DB tenant.
      </div>

      {activeAppt && <ApptDrawer appt={activeAppt} onClose={() => setActiveAppt(null)} />}

      {/*
        Broker cockpit styles live HERE, co-located with the markup they scope.
        styled-jsx only tags DOM elements rendered by the component that owns the
        <style jsx> block — so anything rendered by child components (GaugeCard →
        GaugeDial / HealthWord) does NOT receive the scope class. Those inner
        selectors are therefore anchored on `.gauges` (this component's own
        markup) via :global(...) so they reach the child-rendered elements.
      */}
      <style jsx>{`
        .card {
          border: 1px solid var(--line);
          background: var(--surface);
          border-radius: 12px;
        }
        .pad {
          padding: 18px;
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
        .onething .ot-body {
          flex: 1;
          min-width: 0;
        }
        .onething .ot-actions {
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
          color: var(--ink);
          background: var(--copper-soft);
          border: 1px solid var(--copper-soft);
          border-radius: 999px;
          padding: 7px 14px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .ot-go:hover {
          background: var(--copper);
          border-color: var(--copper);
        }
        .ot-go :global(svg) {
          width: 14px;
          height: 14px;
          margin: 0;
          color: var(--ink);
        }
        .ot-ghost {
          font: inherit;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--copper-soft);
          background: transparent;
          border: 1px solid var(--copper-dim);
          border-radius: 999px;
          padding: 7px 14px;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
        }
        .ot-ghost:hover {
          border-color: var(--copper-soft);
          color: var(--text);
        }
        .onething.done {
          align-items: center;
          border-color: color-mix(in srgb, var(--green) 40%, transparent);
          background: var(--green-wash);
        }
        .onething.done :global(svg) {
          color: var(--green);
        }
        .onething.done p {
          flex: 1;
          min-width: 0;
        }
        .onething.done :global(b) {
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
          flex-direction: column;
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
        .brow {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          width: 100%;
          text-align: left;
          font: inherit;
          font-size: 13px;
          color: var(--text-soft);
          line-height: 1.5;
          background: transparent;
          border: 0;
          padding: 2px 0;
          cursor: pointer;
        }
        .brow .btext {
          flex: 1;
          min-width: 0;
        }
        .brow .bchev {
          width: 14px;
          height: 14px;
          flex: none;
          color: var(--muted);
          margin-top: 3px;
          transition: transform 0.2s;
        }
        .brow[aria-expanded="true"] .bchev {
          transform: rotate(180deg);
          color: var(--copper-soft);
        }
        .bfix {
          margin: 6px 0 2px 17px;
          border-left: 2px solid var(--copper-dim);
          padding: 2px 0 2px 11px;
        }
        .bfix-label {
          font-size: 9.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--copper-soft);
        }
        .bfix p {
          margin: 4px 0 0;
          font-size: 12.5px;
          color: var(--text-soft);
          line-height: 1.5;
        }
        .bfix-go {
          margin-top: 9px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          color: var(--ink);
          background: var(--copper-soft);
          border: 1px solid var(--copper-soft);
          border-radius: 999px;
          padding: 6px 12px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .bfix-go:hover {
          background: var(--copper);
        }
        .bfix-go :global(svg) {
          width: 13px;
          height: 13px;
        }
        /* ── compliance file panel ─────────────────────────────── */
        .cfile {
          margin-top: 10px;
          border: 1px solid var(--copper-dim);
          background: var(--panel);
          border-radius: 12px;
          padding: 15px 16px;
        }
        .cfile-hd {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .cfile-hd > div:first-child {
          flex: 1;
          min-width: 0;
        }
        .cfile-title {
          font-family: var(--font-display);
          font-size: 18px;
          color: var(--text);
          margin-top: 3px;
        }
        .cflag {
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--red);
          border: 1px solid color-mix(in srgb, var(--red) 40%, transparent);
          background: var(--red-wash);
          border-radius: 999px;
          padding: 4px 9px;
          white-space: nowrap;
          flex: none;
        }
        .cfile-x {
          width: 26px;
          height: 26px;
          border-radius: 7px;
          border: 1px solid var(--line);
          background: var(--surface);
          color: var(--muted);
          cursor: pointer;
          display: grid;
          place-items: center;
          flex: none;
        }
        .cfile-x:hover {
          color: var(--text);
        }
        .cfile-x :global(svg) {
          width: 13px;
          height: 13px;
        }
        .cfile-sub {
          margin-top: 12px;
          font-size: 12px;
          color: var(--muted);
        }
        .cdocs {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .cdoc {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          border: 1px solid var(--line);
          border-radius: 9px;
          background: var(--surface);
          padding: 10px 12px;
        }
        .cdoc :global(svg) {
          width: 17px;
          height: 17px;
          flex: none;
          margin-top: 1px;
        }
        .cdoc-t {
          font-size: 13px;
          color: var(--text);
        }
        .cdoc-f {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--muted);
          margin-top: 2px;
        }
        .cfile-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 13px;
        }
        .cbtn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font: inherit;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--text-soft);
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 7px 13px;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
        }
        .cbtn:hover,
        .cbtn.on {
          border-color: var(--copper-dim);
          color: var(--text);
        }
        .cbtn :global(svg) {
          width: 14px;
          height: 14px;
        }
        .cbtn.resolve {
          color: var(--ink);
          background: var(--green);
          border-color: var(--green);
        }
        .cbtn.resolve:hover {
          filter: brightness(1.08);
        }
        .creveal {
          margin-top: 11px;
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 6px 10px;
          border: 1px solid var(--line);
          border-radius: 9px;
          background: var(--surface);
          padding: 11px 13px;
        }
        .crk {
          font-size: 9.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted);
        }
        .cphone {
          font-family: var(--font-mono);
          font-size: 18px;
          color: var(--copper-soft);
          text-decoration: none;
        }
        .crhint {
          font-size: 11px;
          color: var(--muted);
        }
        .cemail {
          margin-top: 11px;
          border: 1px solid var(--line);
          border-radius: 9px;
          background: var(--surface);
          padding: 12px 13px;
        }
        .cem-row {
          font-size: 12.5px;
          color: var(--text-soft);
          padding: 3px 0;
          border-bottom: 1px solid var(--line-soft);
        }
        .cem-row span {
          display: inline-block;
          width: 58px;
          color: var(--muted);
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .cem-body {
          margin-top: 9px;
          font-size: 12.5px;
          color: var(--text-soft);
          line-height: 1.55;
        }
        .cem-send {
          margin-top: 11px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font: inherit;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--ink);
          background: var(--copper-soft);
          border: 1px solid var(--copper-soft);
          border-radius: 999px;
          padding: 7px 14px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .cem-send:hover:not(:disabled) {
          background: var(--copper);
        }
        .cem-send:disabled {
          color: var(--ink);
          background: var(--green);
          border-color: var(--green);
          cursor: default;
        }
        .cem-send :global(svg) {
          width: 14px;
          height: 14px;
        }
        /* ── your week: follow-ups + appointments ──────────────── */
        .bcal {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 10px;
        }
        @media (max-width: 640px) {
          .bcal {
            grid-template-columns: 1fr;
          }
        }
        .bcal-col {
          border: 1px solid var(--line);
          border-radius: 12px;
          background: var(--surface);
          padding: 13px 14px;
        }
        .bcal-h {
          font-size: 9.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--muted);
          margin-bottom: 4px;
        }
        .bfollow {
          display: flex;
          align-items: baseline;
          gap: 9px;
          padding: 9px 0;
          border-top: 1px solid var(--line-soft);
          font-size: 13px;
        }
        .bfollow:first-of-type {
          border-top: 0;
        }
        .fdot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex: none;
          align-self: center;
        }
        .fdot.r {
          background: var(--red);
        }
        .fdot.y {
          background: var(--yellow);
        }
        .fdot.g {
          background: var(--green);
        }
        .bfollow .ft {
          flex: 1;
          min-width: 0;
          color: var(--text-soft);
        }
        .bfollow .fw {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--muted);
          white-space: nowrap;
        }
        .bappt {
          display: flex;
          gap: 11px;
          align-items: baseline;
          width: 100%;
          padding: 9px 0;
          border: 0;
          border-top: 1px solid var(--line-soft);
          background: transparent;
          font: inherit;
          font-size: 13px;
          text-align: left;
          cursor: pointer;
        }
        .bappt:first-of-type {
          border-top: 0;
        }
        .bappt:hover {
          background: var(--raise);
        }
        .bappt .atm {
          font-family: var(--font-mono);
          font-size: 11.5px;
          color: var(--copper-soft);
          white-space: nowrap;
          min-width: 82px;
        }
        .bappt .at {
          flex: 1;
          min-width: 0;
          color: var(--text-soft);
        }
        .bappt .bappt-go {
          width: 14px;
          height: 14px;
          flex: none;
          color: var(--muted);
          align-self: center;
        }
        /* ── company aura: reputation ──────────────────────────── */
        .aura {
          border: 1px solid var(--line);
          border-radius: 12px;
          background: var(--surface);
          padding: 15px 16px;
          margin-top: 10px;
        }
        .aura-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }
        .aura-score {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .aura-score .asc {
          font-family: var(--font-display);
          font-size: 40px;
          line-height: 1;
          color: var(--text);
        }
        .astars {
          color: var(--copper-soft);
          font-size: 14px;
          letter-spacing: 2px;
        }
        .asub {
          font-size: 12px;
          color: var(--muted);
          margin-top: 3px;
        }
        .aura-srcs {
          display: flex;
          gap: 10px;
        }
        .asrc {
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--panel);
          padding: 9px 13px;
          text-align: center;
        }
        .asrc span {
          display: block;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted);
        }
        .asrc b {
          font-family: var(--font-mono);
          font-size: 17px;
          font-weight: 400;
          color: var(--text);
          display: block;
          margin-top: 3px;
        }
        .asrc small {
          font-size: 10px;
          color: var(--muted);
        }
        .aura-intent {
          display: flex;
          gap: 10px;
          margin-top: 13px;
        }
        .aint {
          flex: 1;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--panel);
          padding: 10px;
          text-align: center;
        }
        .aint b {
          font-family: var(--font-mono);
          font-size: 18px;
          font-weight: 400;
          color: var(--copper-soft);
          display: block;
        }
        .aint span {
          font-size: 10.5px;
          color: var(--muted);
        }
        .aint :global(.trend) {
          display: block;
          margin-top: 3px;
        }
        .astars :global(.trend) {
          margin-left: 4px;
          vertical-align: 1px;
        }
        .aura-rev {
          margin-top: 13px;
          border-top: 1px solid var(--line);
          padding-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .arev-stars {
          color: var(--copper-soft);
          font-size: 12px;
          letter-spacing: 2px;
        }
        .arev-q {
          font-size: 13px;
          color: var(--text-soft);
          line-height: 1.5;
          font-style: italic;
        }
        .arev-m {
          font-size: 11px;
          color: var(--muted);
        }
        .roster {
          margin-top: 10px;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: var(--panel);
          overflow: hidden;
        }
        .arow-wrap {
          border-top: 1px solid var(--line-soft);
        }
        .arow-wrap:first-of-type {
          border-top: 0;
        }
        .arow {
          width: 100%;
          display: grid;
          grid-template-columns: auto 1.4fr 1.3fr 0.9fr auto 18px;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          font: inherit;
          text-align: left;
          color: inherit;
          background: transparent;
          border: 0;
          cursor: pointer;
          transition: background 0.15s;
        }
        .arow:hover {
          background: var(--surface);
        }
        .arow[aria-expanded="true"] {
          background: var(--surface);
        }
        .adot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex: none;
        }
        .aname {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--text);
          line-height: 1.2;
          min-width: 0;
        }
        .aname :global(small) {
          display: block;
          font-size: 10.5px;
          font-weight: 400;
          color: var(--muted);
          margin-top: 2px;
        }
        .acap {
          min-width: 0;
        }
        .capbar {
          display: block;
          height: 5px;
          border-radius: 999px;
          background: var(--line);
          overflow: hidden;
        }
        .capfill {
          display: block;
          height: 100%;
          border-radius: 999px;
        }
        .acap :global(small) {
          display: block;
          font-size: 10px;
          color: var(--muted);
          margin-top: 4px;
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
        }
        .agci {
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          font-size: 14px;
          color: var(--text);
          text-align: right;
          line-height: 1.15;
        }
        .agci :global(small) {
          display: block;
          font-family: var(--font-display);
          font-size: 9.5px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted);
          margin-top: 2px;
        }
        .agci :global(.trend) {
          display: block;
          margin-top: 2px;
          font-size: 10px;
        }
        .astatus {
          font-size: 11.5px;
          font-weight: 600;
          text-align: right;
          white-space: nowrap;
        }
        .arow :global(.achev) {
          width: 16px;
          height: 16px;
          color: var(--muted);
          transition: transform 0.2s, color 0.2s;
        }
        .arow[aria-expanded="true"] :global(.achev) {
          transform: rotate(180deg);
          color: var(--copper-soft);
        }
        .adetail {
          padding: 4px 16px 16px 34px;
          background: var(--surface);
        }
        .aflag {
          display: flex;
          gap: 9px;
          align-items: flex-start;
          border: 1px solid color-mix(in srgb, var(--red) 35%, transparent);
          background: var(--red-wash);
          border-radius: 9px;
          padding: 10px 12px;
          font-size: 12.5px;
          color: var(--text-soft);
          line-height: 1.45;
        }
        .aflag :global(svg) {
          width: 14px;
          height: 14px;
          flex: none;
          margin-top: 2px;
          color: var(--red);
        }
        .aflag.aflag-clear {
          border-color: color-mix(in srgb, var(--green) 40%, transparent);
          background: var(--green-wash);
        }
        .aflag.aflag-clear :global(svg) {
          color: var(--green);
        }
        .astats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px 18px;
          margin-top: 12px;
        }
        .astat {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .astat .ak {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted);
          font-weight: 600;
        }
        .astat .av {
          font-size: 12.5px;
          color: var(--text-soft);
        }
        .anote {
          margin: 11px 0 0;
          font-size: 12.5px;
          color: var(--muted);
          line-height: 1.55;
        }
        .acal {
          margin-top: 13px;
          border-top: 1px solid var(--line-soft);
          padding-top: 11px;
        }
        .acal-h {
          display: flex;
          align-items: center;
          gap: 7px;
          width: 100%;
          font: inherit;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--copper-soft);
          background: transparent;
          border: 0;
          padding: 3px 0;
          cursor: pointer;
        }
        .acal-h :global(.acal-ico) {
          width: 13px;
          height: 13px;
          flex: none;
        }
        .acal-h .acal-htxt {
          flex: none;
        }
        .acal-h .acal-count {
          font-family: var(--font-mono);
          font-weight: 400;
          text-transform: none;
          letter-spacing: 0;
          font-size: 10.5px;
          color: var(--muted);
          margin-left: auto;
        }
        .acal-h :global(.acal-chev) {
          width: 14px;
          height: 14px;
          flex: none;
          color: var(--muted);
          transition: transform 0.2s;
        }
        .acal-h[aria-expanded="true"] :global(.acal-chev) {
          transform: rotate(180deg);
          color: var(--copper-soft);
        }
        .acal-sync {
          font-size: 11px;
          color: var(--muted);
          margin: 4px 0 2px;
        }
        .acal-row {
          display: flex;
          align-items: baseline;
          gap: 10px;
          width: 100%;
          padding: 7px 0;
          border: 0;
          border-top: 1px solid var(--line-soft);
          background: transparent;
          font: inherit;
          font-size: 12.5px;
          text-align: left;
          cursor: pointer;
        }
        .acal-row:first-of-type {
          border-top: 0;
        }
        .acal-row:hover {
          background: var(--raise);
        }
        .acal-row .acal-go {
          width: 13px;
          height: 13px;
          flex: none;
          color: var(--muted);
          align-self: center;
        }
        .acal-when {
          font-family: var(--font-mono);
          font-size: 11.5px;
          color: var(--text-soft);
          white-space: nowrap;
          min-width: 84px;
          flex: none;
        }
        .akind {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 2px 7px;
          border-radius: 999px;
          border: 1px solid var(--line);
          white-space: nowrap;
          flex: none;
          align-self: center;
        }
        .akind.closing {
          color: var(--green);
          border-color: color-mix(in srgb, var(--green) 40%, transparent);
          background: var(--green-wash);
        }
        .akind.showing,
        .akind.listing,
        .akind.open {
          color: var(--copper-soft);
          border-color: var(--copper-dim);
          background: var(--copper-wash);
        }
        .akind.inspection {
          color: var(--yellow);
          border-color: color-mix(in srgb, var(--yellow) 40%, transparent);
          background: var(--yellow-wash);
        }
        .akind.call {
          color: var(--muted);
        }
        .acal-what {
          flex: 1;
          min-width: 0;
          color: var(--text-soft);
        }
        .acal-what :global(small) {
          display: block;
          color: var(--muted);
          font-size: 11px;
          margin-top: 1px;
        }
        .rmeta {
          font-size: 11.5px;
          color: var(--muted);
        }
        .rmeta :global(.rneed) {
          color: var(--red);
          font-weight: 600;
        }
        .rmeta :global(.rok) {
          color: var(--green);
          font-weight: 600;
        }
        @media (max-width: 640px) {
          .arow {
            grid-template-columns: auto 1fr auto auto 18px;
            gap: 10px;
          }
          .acap {
            display: none;
          }
          .agci {
            font-size: 13px;
          }
          .agci :global(small) {
            display: none;
          }
          .astatus {
            font-size: 11px;
          }
          .adetail {
            padding-left: 16px;
          }
        }
        .gauges {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
          gap: 8px;
          margin-top: 12px;
        }
        .gauges :global(.gauge) {
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
        .gauges :global(.gauge:hover) {
          border-color: var(--copper-dim);
        }
        .gauges :global(.gauge[aria-expanded="true"]) {
          border-color: var(--copper-soft);
          background: var(--copper-wash);
        }
        .gauges :global(.gauge .glabel) {
          font-size: 9.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted);
          line-height: 1.2;
        }
        .gauges :global(.gauge .info) {
          position: absolute;
          top: 7px;
          right: 8px;
          width: 13px;
          height: 13px;
          color: var(--muted);
          opacity: 0.45;
        }
        .gauges :global(.gauge:hover .info) {
          opacity: 0.8;
        }
        .gauges :global(.gauge[aria-expanded="true"] .info) {
          opacity: 0;
        }
        .gauges :global(.gwrap) {
          position: relative;
          width: 88px;
          height: 88px;
          margin-top: 7px;
        }
        .gauges :global(.gwrap svg) {
          width: 100%;
          height: 100%;
          display: block;
        }
        .gauges :global(.gval) {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .gauges :global(.gval .v) {
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          font-size: 19px;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .gauges :global(.gval .u) {
          font-size: 8.5px;
          color: var(--muted);
          margin-top: 2px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .gauges :global(.gauge .word) {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 600;
          margin-top: 6px;
        }
        .gauges :global(.gauge .word svg) {
          width: 11px;
          height: 11px;
        }
        .gauges :global(.gtrend) {
          margin-top: 3px;
          line-height: 1;
        }
        @media (min-width: 820px) {
          .gauges {
            gap: 14px;
          }
          .gauges :global(.gwrap) {
            width: 108px;
            height: 108px;
          }
          .gauges :global(.gval .v) {
            font-size: 23px;
          }
          .gauges :global(.gauge) {
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
                <BriefingPlayer script={AGENT_BRIEFING} />
              </div>
              <span className="badge partial">
                <span className="tnum">2</span> need you now
              </span>
            </div>
            <AgentApp />
          </div>
        )}
        {tab === "rental" && (
          <div className="card pad">
            <div className="header">
              <div>
                <span className="eyebrow" style={{ color: "var(--copper-soft)" }}>
                  Vacation-Rental Cockpit
                </span>
                <h1>Sawtooth Retreats</h1>
                <div className="sub">June 2026 · McCall &amp; Sun Valley, ID · 7 properties · 6 owners</div>
              </div>
              <span className="badge partial">
                <span className="tnum">Escapia</span> connected
              </span>
            </div>
            <RentalCockpit />
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
        .demo-root :global(.trend) {
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          font-size: 10.5px;
          font-weight: 600;
          white-space: nowrap;
        }
        .demo-root :global(.trend.good) {
          color: var(--green);
        }
        .demo-root :global(.trend.bad) {
          color: var(--red);
        }
        .demo-root :global(.trend.flat) {
          color: var(--muted);
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
      `}</style>
    </div>
  );
}
