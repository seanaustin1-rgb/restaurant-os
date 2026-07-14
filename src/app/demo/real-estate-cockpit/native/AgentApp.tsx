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
// A queue task can carry ways to *act* on it — a ready-to-send e-signature
// email, a call, a text, or a simulated upload — plus, for the Messages card, the
// full message body and a drafted reply. Generated demo data; "send" is a toast.
type QAction =
  | { kind: "email"; label: string; subject: string; body: string }
  | { kind: "call"; label: string; phone: string }
  | { kind: "text"; label: string; body: string }
  | { kind: "upload"; label: string; done: string };
type QMessage = { from: string; when: string; body: string; reply: string };
type Task = { s: "done" | "miss" | "open"; t: string; f?: string; actions?: QAction[]; msg?: QMessage };
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
      {
        s: "miss",
        t: "Seller disclosure — signature",
        f: "SPDS_214Highland.pdf · unsigned",
        actions: [
          {
            kind: "email",
            label: "Email for e-signature",
            subject: "Signature needed today — 214 Highland Park funds at 2 PM",
            body:
              "Hi Whitakers,\n\nWe're clear to close 214 Highland Park this afternoon — the last step is your e-signature on the seller disclosure (SPDS). I've just sent it to your email; signing within the hour keeps us on track to fund at 2 PM.\n\nI'll confirm the moment it lands. Thank you!\n\n— Priya, Cascade Realty",
          },
          { kind: "call", label: "Call the seller", phone: "(208) 555-0161" },
        ],
      },
      {
        s: "miss",
        t: "Final walkthrough form",
        f: "walkthrough_214.pdf · not uploaded",
        actions: [
          {
            kind: "email",
            label: "Email for e-signature",
            subject: "One more form — final walkthrough for 214 Highland Park",
            body:
              "Hi Whitakers,\n\nAlmost there on 214 Highland Park. The final walkthrough form just needs your e-signature — I've sent it alongside the disclosure. Sign both and we stay on schedule to fund at 2 PM.\n\nThank you!\n\n— Priya, Cascade Realty",
          },
          { kind: "upload", label: "Mark uploaded", done: "walkthrough_214.pdf marked uploaded to the closing portal." },
        ],
      },
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
      {
        s: "open",
        t: "Repair-request template ready to send",
        actions: [
          {
            kind: "email",
            label: "Send to buyer's agent",
            subject: "1102 Alderwood — repair requests",
            body:
              "Hi,\n\nFollowing today's buyer inspection at 1102 Alderwood, here are our repair requests:\n\n1. Service the HVAC and replace the failed capacitor\n2. Repair the roof flashing over the garage\n3. GFCI outlets in the kitchen + baths\n\nHappy to discuss credits vs. repairs — let me know what works for your seller.\n\n— Priya, Cascade Realty",
          },
        ],
      },
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
      {
        s: "open",
        t: "HOA estoppel requested",
        actions: [
          {
            kind: "email",
            label: "Email the HOA",
            subject: "Estoppel request — 88 Cedar Bluff",
            body:
              "Hi,\n\nWe have a closing scheduled for 88 Cedar Bluff on Jun 13 and need the HOA estoppel certificate. Could you send the current statement plus any transfer fees at your earliest convenience?\n\nThank you!\n\n— Priya, Cascade Realty",
          },
          { kind: "call", label: "Call the HOA", phone: "(208) 555-0199" },
        ],
      },
    ],
  },
  {
    type: "Messages",
    flag: "g",
    title: "3 unread messages",
    meta: "1 lead gone quiet · 2 client updates · generated",
    time: "oldest 4h",
    tasks: [
      {
        s: "open",
        t: "Jordan Blake — “are we still on for Saturday?”",
        msg: {
          from: "Jordan Blake · buyer lead",
          when: "4h ago",
          body: "Hey Priya — are we still on for Saturday to see the foothills homes? Also, is the 88 Cedar Bluff one still available?",
          reply:
            "Hi Jordan — yes, Saturday's on! Let's start at 10 AM. 88 Cedar Bluff is still available; I'll add it to our route and send the full list tonight. — Priya",
        },
      },
      {
        s: "open",
        t: "Osei family — inspection questions",
        msg: {
          from: "Osei family · under contract",
          when: "3h ago",
          body: "Hi Priya, a couple of inspection questions: is the roof issue something we should push on, and how long do we have to respond?",
          reply:
            "Great questions — the roof is worth a repair request; it's not a dealbreaker. You have 5 days to respond, so we have time. I'll send the repair-request draft this afternoon. — Priya",
        },
      },
      {
        s: "open",
        t: "Pioneer Title — confirm closing time",
        msg: {
          from: "Pioneer Title · closing",
          when: "1h ago",
          body: "Confirming the closing time for 214 Highland Park — still targeting 2:00 PM today? We need the signed disclosure + walkthrough before we can fund.",
          reply:
            "Yes, 2:00 PM today. The seller e-signatures are out now; I'll have the disclosure and walkthrough to your portal within the hour. — Priya",
        },
      },
    ],
  },
];

type LeadKind = "email" | "text" | "call" | "snooze";
interface LeadAction {
  t: string;
  kind: LeadKind;
  u?: boolean;
  phone?: string;
  tpl?: string;
  draft?: { subject?: string; body: string };
}
interface Lead {
  nm: string;
  flag: Flag;
  meta: string;
  why: string;
  primary: LeadAction;
  ghost: LeadAction;
}
const LEADS: Lead[] = [
  {
    nm: "Sam Ortega",
    flag: "r",
    meta: "Referral from Priya · new 41 min ago",
    why: "Past the 30-minute red line. Referrals contacted within 10 minutes close 3× more often.",
    primary: { t: "Call now", kind: "call", u: true, phone: "(208) 555-0148" },
    ghost: {
      t: "Send SMS template",
      kind: "text",
      draft: {
        body: "Hi Sam — Priya passed your info along, I'm with Cascade Realty. I'd love to help with your home search. Do you have 10 minutes for a quick call today? — Priya",
      },
    },
  },
  {
    nm: "The Whitfields",
    flag: "y",
    meta: "Zillow inquiry · 22 min ago",
    why: "In the 15–30 min yellow window — still recoverable if you touch it now.",
    primary: {
      t: "Send email template",
      kind: "email",
      tpl: "listings",
      draft: {
        subject: "Your Zillow inquiry — Boise homes",
        body: "Hi — thanks for reaching out on Zillow about the Boise listing. I pulled a few similar homes in your range and can set up private tours this week. What days work for you? Happy to answer anything in the meantime.\n\n— Priya, Cascade Realty",
      },
    },
    ghost: {
      t: "Text",
      kind: "text",
      draft: {
        body: "Hi! It's Priya with Cascade Realty following up on your Zillow inquiry — want me to send a couple similar listings and line up tours this week?",
      },
    },
  },
  {
    nm: "Marcus Lindqvist",
    flag: "g",
    meta: "Open-house sign-in · 6 min ago",
    why: "Fresh and under the 15-min target — a quick intro locks it in.",
    primary: {
      t: "Send intro",
      kind: "email",
      tpl: "intro",
      draft: {
        subject: "Great meeting you at the open house",
        body: "Hi Marcus — great chatting at the open house today. Here's my info and a link to homes like the one you toured. If you'd like, I can set up a few showings this week — just say the word.\n\n— Priya, Cascade Realty",
      },
    },
    ghost: { t: "Snooze", kind: "snooze" },
  },
  {
    nm: "Dana Whitfield (past client)",
    flag: "y",
    meta: "60-day nurture · re-engage",
    why: "Two new Ridgeline listings match her saved search — the automated match sequence works here.",
    primary: {
      t: "Send listing match",
      kind: "email",
      tpl: "listings",
      draft: {
        subject: "2 new listings that match your saved search",
        body: "Hi Dana — two new Ridgeline listings just hit that match what you saved: 77 Ridgeline ($465k) and 512 Foothills Dr ($548k). Want me to schedule private tours this weekend? Great to reconnect.\n\n— Priya, Cascade Realty",
      },
    },
    ghost: { t: "Skip", kind: "snooze" },
  },
];

// A deterministic mock CMA so the "what's my home worth" email responds to the
// address the agent types (no real data — generated demo).
function marketReport(addr: string): string {
  const seed = [...addr].reduce((a, c) => a + c.charCodeAt(0), 0);
  const mid = 380 + (seed % 260); // $380k–$639k
  const low = mid - 18;
  const high = mid + 22;
  const psf = 240 + (seed % 90);
  const dom = 12 + (seed % 22);
  const yoy = 3 + (seed % 7);
  return [
    `• Estimated value: $${low}k – $${high}k (midpoint ~$${mid}k)`,
    `• Based on 6 recent comparable sales within 0.5 mi`,
    `• Median $/sq ft: $${psf} · Median days on market: ${dom}`,
    `• Neighborhood trend: +${yoy}% year-over-year, sale-to-list 99.4%`,
  ].join("\n");
}

// Templated follow-up emails the agent can choose from, grouped by intent.
type EmailTemplate = {
  id: string;
  name: string;
  group: "New lead" | "Follow-up" | "Re-engage";
  needsAddress?: boolean;
  subject: string;
  body: (nm: string, addr?: string, report?: string) => string;
};
const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "value",
    name: "What's my home worth?",
    group: "New lead",
    needsAddress: true,
    subject: "Your home value & market report",
    body: (nm, addr, report) =>
      `Hi ${nm} — you asked what your home might be worth. Here's a quick market snapshot${addr ? ` for ${addr}` : ""}:\n\n${report ?? "[Add the property address above and generate the report to include the estimate.]"}\n\nThis is an automated estimate — I'd love to walk you through a full comparative market analysis and what it means for your timeline. Reply here or grab a time and we'll dig in.\n\n— Priya, Cascade Realty`,
  },
  {
    id: "buyerguide",
    name: "How buying works",
    group: "New lead",
    subject: "Your quick guide to buying a home",
    body: (nm) =>
      `Hi ${nm} — buying a home is a lot smoother when you know the steps. The short version:\n\n1. Get pre-approved so we know your budget\n2. Tour homes that fit your must-haves\n3. Make an offer — I'll handle the strategy & paperwork\n4. Inspection, appraisal & final walkthrough\n5. Close & get your keys\n\nWant me to send a one-pager and set up a quick call? Just reply.\n\n— Priya, Cascade Realty`,
  },
  {
    id: "preapproval",
    name: "Get pre-approved",
    group: "New lead",
    subject: "First step: getting pre-approved",
    body: (nm) =>
      `Hi ${nm} — the best first move is a pre-approval: it tells us your real budget and makes your offers far stronger in this market. It's usually a 15-minute call with a lender.\n\nI work with a couple of trusted local lenders and can introduce you today — want me to connect you?\n\n— Priya, Cascade Realty`,
  },
  {
    id: "listings",
    name: "Listings matching your search",
    group: "Follow-up",
    subject: "A few homes that match what you're looking for",
    body: (nm) =>
      `Hi ${nm} — great connecting. Based on what you're after, here are a few that just came up:\n\n• 77 Ridgeline — 3bd/2ba · $465k\n• 512 Foothills Dr — 4bd/3ba · $548k\n• 1102 Alderwood — 3bd/2ba · $432k\n\nWant me to set up private tours this week? I can also fine-tune the search — just tell me what to add or drop.\n\n— Priya, Cascade Realty`,
  },
  {
    id: "intro",
    name: "Intro follow-up (after a call)",
    group: "Follow-up",
    subject: "Great connecting today",
    body: (nm) =>
      `Hi ${nm} — great chatting today. Here's my contact info and a link to homes like the ones we discussed. Whenever you're ready, I can line up showings this week or answer anything as it comes up.\n\nTalk soon,\n— Priya, Cascade Realty`,
  },
  {
    id: "marketupdate",
    name: "Neighborhood market update",
    group: "Re-engage",
    subject: "What's happening in your neighborhood",
    body: (nm) =>
      `Hi ${nm} — it's been a bit, so I wanted to share what's happening near you: homes are selling in about 24 days at 99% of list, and prices are up ~5% year-over-year. Inventory is still tight, which is good news if you've thought about selling.\n\nCurious what your place could fetch today? I'm happy to run the numbers — no pressure.\n\n— Priya, Cascade Realty`,
  },
  {
    id: "stilllooking",
    name: "Still thinking about a move?",
    group: "Re-engage",
    subject: "Still thinking about a move?",
    body: (nm) =>
      `Hi ${nm} — checking in! Life gets busy and timing changes, so no worries if the search went quiet. If a move is still somewhere on your list, I can send fresh listings that fit and keep it low-key until you're ready.\n\nWant me to turn your search back on?\n\n— Priya, Cascade Realty`,
  },
  {
    id: "equity",
    name: "Equity / anniversary check-in",
    group: "Re-engage",
    subject: "You may have more equity than you think",
    body: (nm) =>
      `Hi ${nm} — with prices up over the last couple of years, a lot of owners have more equity than they realize. If you've been curious whether it's enough to move up (or cash out), I can put together a quick equity + value estimate for your place.\n\nWant me to run it? Takes me five minutes.\n\n— Priya, Cascade Realty`,
  },
  {
    id: "justlisted",
    name: "Just listed near you",
    group: "Re-engage",
    subject: "Just listed near you — worth a look?",
    body: (nm) =>
      `Hi ${nm} — a home just listed near you that reminded me of what you were after. These tend to move fast in this market. Want me to send the details and set up a quick tour before the weekend?\n\n— Priya, Cascade Realty`,
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
function TaskBox({ done, miss }: { done: boolean; miss: boolean }) {
  if (done)
    return (
      <span className="tbox done">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    );
  if (miss)
    return (
      <span className="tbox miss">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </span>
    );
  return <span className="tbox" />;
}

// A single queue task. If it carries actions (e-signature email, call, text,
// upload) or a message, the row expands to let you act on it right here —
// ready-to-send drafts, a tap-to-dial number, or read + reply for messages.
// Generated demo data; every send is a toast, nothing leaves the browser.
function QueueTask({ t, say }: { t: Task; say: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [compose, setCompose] = useState<Extract<QAction, { kind: "email" | "text" }> | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [reply, setReply] = useState(t.msg?.reply ?? "");
  const [replySent, setReplySent] = useState(false);

  const interactive = !!(t.actions?.length || t.msg);
  const done = t.s === "done" || uploaded;

  const pick = (a: QAction) => {
    if (a.kind === "call") { setCompose(null); setPhone((p) => (p ? null : a.phone)); return; }
    if (a.kind === "upload") { if (!uploaded) { setUploaded(true); say(a.done); } return; }
    setPhone(null);
    if (compose && compose.label === a.label) { setCompose(null); return; }
    setCompose(a);
    setSent(false);
    setSubject(a.kind === "email" ? a.subject : "");
    setBody(a.body);
  };
  const send = () => { setSent(true); say(`${compose?.kind === "email" ? "Email" : "Text"} ready — simulated send (demo only).`); };
  const sendReply = () => { setReplySent(true); say("Reply — simulated send (demo only)."); };

  if (!interactive) {
    return (
      <div className={`task ${done ? "done" : ""}`}>
        <TaskBox done={done} miss={t.s === "miss"} />
        <span className="tt">
          {t.t}
          {t.f && <span className="file">{t.f}</span>}
        </span>
      </div>
    );
  }

  return (
    <div className={`task act ${done ? "done" : ""}`}>
      <div className="task-row">
        <TaskBox done={done} miss={t.s === "miss" && !uploaded} />
        <button type="button" className="tt tt-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="tt-main">
            {t.t}
            {t.f && <span className="file">{t.f}</span>}
          </span>
          <span className="tt-cue">
            {t.msg ? (open ? "Hide" : "Read") : open ? "Hide" : "Act"}
            <svg style={{ transform: open ? "rotate(90deg)" : undefined }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </span>
        </button>
      </div>

      {open && (
        <div className="task-panel">
          {t.msg && (
            <>
              <div className="qmsg">
                <div className="qmsg-hd">
                  <span className="qmsg-from">{t.msg.from}</span>
                  <span className="qmsg-when">{t.msg.when}</span>
                </div>
                <div className="qmsg-body">{t.msg.body}</div>
              </div>
              <div className="qreply">
                <div className="qreply-hd">
                  Reply <span className="cmp-tag">drafted · edit before sending</span>
                </div>
                <textarea className="cmp-body" value={reply} onChange={(e) => setReply(e.target.value)} rows={3} disabled={replySent} />
                <div className="cmp-act">
                  <button type="button" className="btn primary" disabled={replySent} onClick={sendReply}>
                    {replySent ? "✓ Simulated" : "Send reply"}
                  </button>
                  {replySent && <span className="qsent">Demo only · not sent</span>}
                </div>
              </div>
            </>
          )}

          {t.actions?.length ? (
            <div className="lact qt-lact">
              {t.actions.map((a) => {
                const active =
                  (a.kind === "call" && phone !== null) ||
                  ((a.kind === "email" || a.kind === "text") && compose?.label === a.label);
                return (
                  <button type="button" key={a.label} className={`btn ${active ? "primary" : "ghost"}`} onClick={() => pick(a)}>
                    <span className="gp-bi">
                      {a.kind === "upload" ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                        </svg>
                      ) : (
                        <GpIcon kind={a.kind} />
                      )}
                    </span>
                    {a.label}
                  </button>
                );
              })}
            </div>
          ) : null}

          {phone && (
            <div className="lcall">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z" />
              </svg>
              <span className="lcall-n">{phone}</span>
              <span className="lcall-h">tap to dial · generated demo contact</span>
            </div>
          )}

          {compose && (
            <div className="compose">
              <div className="cmp-hd">
                <GpIcon kind={compose.kind} />
                {compose.kind === "email" ? "Email" : "Text"}
                <span className="cmp-tag">drafted · edit before sending</span>
              </div>
              {compose.kind === "email" && (
                <input className="cmp-subj" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" disabled={sent} />
              )}
              <textarea className={`cmp-body ${compose.kind}`} value={body} onChange={(e) => setBody(e.target.value)} rows={compose.kind === "email" ? 8 : 3} disabled={sent} />
              <div className="cmp-act">
                <button type="button" className="btn primary" disabled={sent} onClick={send}>
                  {sent ? "✓ Simulated" : compose.kind === "email" ? "Send email" : "Send text"}
                </button>
                <button type="button" className="btn ghost" onClick={() => setCompose(null)}>
                  {sent ? "Close" : "Cancel"}
                </button>
                {sent && <span className="qsent">Demo only · not sent</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QueueCardView({ c, say }: { c: QueueCard; say: (m: string) => void }) {
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
      {/* Keep the panel mounted (hidden, not unmounted) so each QueueTask's
          uploaded/sent/replied state survives collapsing and reopening the card —
          otherwise the demo can't actually work through the queue. */}
      <div className="qbody" hidden={!open}>
        {c.tasks.map((t, i) => (
          <QueueTask t={t} say={say} key={i} />
        ))}
      </div>
    </div>
  );
}

const EMAIL_GROUPS = ["New lead", "Follow-up", "Re-engage"] as const;

function LeadView({ l, onFire }: { l: Lead; onFire: (msg: string) => void }) {
  const [done, setDone] = useState(false);
  const [compose, setCompose] = useState<LeadAction | null>(null);
  const [templateId, setTemplateId] = useState<string>("intro");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [address, setAddress] = useState("");
  const [report, setReport] = useState("");
  const [sent, setSent] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const f = FLAG[l.flag];
  const activeTpl = EMAIL_TEMPLATES.find((t) => t.id === templateId) ?? EMAIL_TEMPLATES[0];

  const loadTpl = (id: string, addr: string, rep: string) => {
    const t = EMAIL_TEMPLATES.find((x) => x.id === id) ?? EMAIL_TEMPLATES[0];
    setTemplateId(t.id);
    setSubject(t.subject);
    setBody(t.body(l.nm, addr || undefined, rep || undefined));
  };

  const act = (a: LeadAction) => {
    if (a.kind === "email") {
      setPhone(null);
      if (compose && compose.kind === "email") {
        setCompose(null);
        return;
      }
      setCompose(a);
      setSent(false);
      setAddress("");
      setReport("");
      loadTpl(a.tpl ?? "intro", "", "");
    } else if (a.kind === "text") {
      setPhone(null);
      if (compose && compose.t === a.t) {
        setCompose(null);
        return;
      }
      setCompose(a);
      setSent(false);
      setSubject("");
      setBody(a.draft?.body ?? "");
    } else if (a.kind === "call") {
      setCompose(null);
      setPhone(phone ? null : a.phone ?? "");
    } else {
      setDone(true);
      onFire("Queued — I'll resurface this lead later.");
    }
  };
  const genReport = () => {
    const rep = marketReport(address);
    setReport(rep);
    setSubject(activeTpl.subject);
    setBody(activeTpl.body(l.nm, address, rep));
  };
  const send = () => {
    setSent(true);
    setDone(true);
    onFire(compose?.kind === "text" ? "Text sent — logged to the lead." : "Email sent — logged to the lead.");
  };

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
        <button type="button" className={l.primary.u ? "btn urgent" : "btn primary"} onClick={() => act(l.primary)}>
          {l.primary.t}
        </button>
        <button type="button" className="btn ghost" onClick={() => act(l.ghost)}>
          {l.ghost.t}
        </button>
      </div>

      {phone && (
        <div className="lcall">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z" />
          </svg>
          <span className="lcall-n">{phone}</span>
          <span className="lcall-h">tap to dial · generated demo contact</span>
        </div>
      )}

      {compose && (
        <div className="compose">
          <div className="cmp-hd">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              {compose.kind === "email" ? (
                <>
                  <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                  <path d="m22 6-10 7L2 6" />
                </>
              ) : (
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              )}
            </svg>
            {compose.kind === "email" ? "Email to" : "Text"} {l.nm}
            <span className="cmp-tag">{compose.kind === "email" ? "pick a template · edit before sending" : "AI-drafted · edit before sending"}</span>
          </div>

          {compose.kind === "email" && (
            <div className="tpick">
              {EMAIL_GROUPS.map((g) => (
                <div className="tgroup" key={g}>
                  <span className="tglabel">{g}</span>
                  <div className="tchips">
                    {EMAIL_TEMPLATES.filter((t) => t.group === g).map((t) => (
                      <button
                        type="button"
                        key={t.id}
                        className={`tchip ${templateId === t.id ? "on" : ""}`}
                        disabled={sent}
                        onClick={() => loadTpl(t.id, address, report)}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {compose.kind === "email" && activeTpl.needsAddress && (
            <div className="addr">
              <input
                className="addr-in"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Property address (if the lead didn't provide one)"
                disabled={sent}
              />
              <button type="button" className="addr-go" disabled={sent || !address.trim()} onClick={genReport}>
                {report ? "Regenerate report" : "Generate market report"}
              </button>
            </div>
          )}

          {compose.kind === "email" && (
            <input
              className="cmp-subj"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              disabled={sent}
            />
          )}
          <textarea
            className={`cmp-body ${compose.kind}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={compose.kind === "email" ? 9 : 3}
            disabled={sent}
          />
          <div className="cmp-act">
            <button type="button" className="btn primary" disabled={sent} onClick={send}>
              {sent ? "✓ Sent" : compose.kind === "text" ? "Send text" : "Send email"}
            </button>
            <button type="button" className="btn ghost" onClick={() => setCompose(null)}>
              {sent ? "Close" : "Cancel"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Time-boxed daily execution plan — checkable, generated demo data. Complements
// the Executive Brief (what's true), One Thing First (the single top move), and
// the queue/lead/calendar detail below by rolling the day into a scannable,
// scheduled checklist tied to today's closing, lead, and inspection work. Each
// item carries the *means to act* — a ready-to-send call / text / email draft —
// so the plan doesn't just say what to do, it does it (demo: sending is a toast).
type GpAction =
  | { kind: "call"; label: string; phone: string }
  | { kind: "text"; label: string; body: string }
  | { kind: "email"; label: string; subject: string; body: string }
  | { kind: "task"; label: string; done: string };
type PlanItem = {
  id: string;
  short: string;
  text: string;
  next: string;
  flag: "r" | "y" | "g";
  actions: GpAction[];
};
const GAME_PLAN: { when: string; items: PlanItem[] }[] = [
  {
    when: "Before noon",
    items: [
      {
        id: "hp-docs",
        short: "Highland Park compliance docs",
        text: "Clear 214 Highland Park compliance docs",
        next: "Upload the seller disclosure signature + final walkthrough form before the title company's noon cutoff — funding is at 2 PM.",
        flag: "r",
        actions: [
          {
            kind: "email",
            label: "Request e-signature",
            subject: "Signature needed today — 214 Highland Park funds at 2 PM",
            body:
              "Hi Whitakers,\n\nWe're clear to close 214 Highland Park this afternoon — the only thing between you and funding at 2 PM is two quick e-signatures: the seller disclosure and the final walkthrough form.\n\nI've just sent both to your email. If you can sign within the hour we stay on schedule, and I'll confirm the moment they land.\n\nThank you!",
          },
          {
            kind: "text",
            label: "Text the title officer",
            body:
              "Hi Dana — sending the signed seller disclosure + final walkthrough form over before your noon cutoff so 214 Highland Park still funds at 2 PM. I'll upload both to the portal within the hour. Anything else you need from me?",
          },
          { kind: "task", label: "Mark docs uploaded", done: "Compliance docs uploaded to the title portal." },
        ],
      },
      {
        id: "sam",
        short: "Sam Ortega",
        text: "Call Sam Ortega back",
        next: "41 min unanswered and past the 30-minute line — reach out now to keep the referral warm.",
        flag: "y",
        actions: [
          { kind: "call", label: "Call Sam", phone: "(208) 555-0147" },
          {
            kind: "text",
            label: "Text Sam",
            body:
              "Hi Sam, it's your agent at Cascade Realty — sorry I missed you! I pulled two Boise foothills homes that match what you described. Free for a quick call around 2:30, or want me to text the listings first?",
          },
          {
            kind: "email",
            label: "Email Sam",
            subject: "Two Boise foothills homes for you",
            body:
              "Hi Sam,\n\nThanks for the referral — great to connect. Based on what you're looking for, I've lined up two foothills homes worth a look and can get you in this week.\n\nWhat's the best number and time to reach you? Happy to work around your schedule.\n\nTalk soon,\nCascade Realty",
          },
        ],
      },
    ],
  },
  {
    when: "This afternoon",
    items: [
      {
        id: "inspection",
        short: "Highland Park inspection",
        text: "Confirm the Highland Park inspection window",
        next: "Verify the inspector lands 12–2 PM so it clears before the 2 PM funding.",
        flag: "y",
        actions: [
          {
            kind: "text",
            label: "Text the inspector",
            body:
              "Hi Mark — confirming the 214 Highland Park inspection lands between 12 and 2 PM today. Funding's at 2, so I need it wrapped by ~1:45. Are we good on timing?",
          },
          { kind: "call", label: "Call the inspector", phone: "(208) 555-0132" },
        ],
      },
      {
        id: "cedar",
        short: "88 Cedar Bluff listing",
        text: "Prep tomorrow's 88 Cedar Bluff listing appointment",
        next: "Pull comps + a quick CMA for the 9 AM Wednesday walk-through.",
        flag: "g",
        actions: [
          {
            kind: "text",
            label: "Text the sellers",
            body:
              "Hi Priya — confirming our listing appointment tomorrow (Wed) at 9 AM for 88 Cedar Bluff. I'll bring recent comps and a pricing recommendation. See you then!",
          },
          {
            kind: "email",
            label: "Email the prep",
            subject: "Your 88 Cedar Bluff listing — prep for tomorrow at 9 AM",
            body:
              "Hi Priya,\n\nLooking forward to tomorrow at 9. Ahead of it I'm pulling recent Cedar Bluff comps and a quick CMA so we can talk list price with real numbers.\n\nIf anything's changed on the home — updates, repairs, timing — reply here and I'll fold it in.\n\nSee you at 9!",
          },
        ],
      },
    ],
  },
  {
    when: "Before end of day",
    items: [
      {
        id: "ridgeline",
        short: "Ridgeline sellers",
        text: "Send the Ridgeline sellers the “convert to listing” note",
        next: "Market's accelerating (99.4% list-to-sale) — ask for signatures while the window's open.",
        flag: "g",
        actions: [
          {
            kind: "email",
            label: "Email the sellers",
            subject: "The window to list Ridgeline is open right now",
            body:
              "Hi,\n\nQuick market note on your Ridgeline home: homes are selling at 99.4% of list and days-on-market just dropped a week — the strongest seller window we've seen this quarter.\n\nList now and we catch that momentum. I've attached a quick value estimate — want to grab 15 minutes this week to talk timing?\n\nBest,\nCascade Realty",
          },
          {
            kind: "text",
            label: "Text a nudge",
            body:
              "Hi — the market's moving in your favor on Ridgeline (99.4% list-to-sale, days-on-market down a week). Great window to list. Have 15 minutes this week to talk timing?",
          },
        ],
      },
    ],
  },
];
const PLAN_TOTAL = GAME_PLAN.reduce((n, b) => n + b.items.length, 0);

function GpIcon({ kind }: { kind: GpAction["kind"] }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "call") return (<svg {...common}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z" /></svg>);
  if (kind === "text") return (<svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>);
  if (kind === "email") return (<svg {...common}><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /><path d="m22 6-10 7L2 6" /></svg>);
  return (<svg {...common}><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>);
}

function GamePlanItem({ it, checked, onToggle, say }: { it: PlanItem; checked: boolean; onToggle: () => void; say: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [compose, setCompose] = useState<Extract<GpAction, { kind: "text" | "email" }> | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const pick = (a: GpAction) => {
    if (a.kind === "call") {
      setCompose(null);
      setPhone((p) => (p ? null : a.phone));
      return;
    }
    if (a.kind === "task") {
      if (!checked) { onToggle(); say(a.done); }
      return;
    }
    setPhone(null);
    if (compose && compose.label === a.label) { setCompose(null); return; }
    setCompose(a);
    setSent(false);
    setSubject(a.kind === "email" ? a.subject : "");
    setBody(a.body);
  };
  const send = () => {
    setSent(true);
    if (!checked) onToggle();
    say(compose?.kind === "text" ? `Text sent · ${it.short}` : `Email sent · ${it.short}`);
  };

  return (
    <div className={`gp-item ${it.flag} ${checked ? "done" : ""}`}>
      <div className="gp-row">
        <button type="button" className="gp-box" aria-pressed={checked} aria-label={checked ? "Mark not done" : "Mark done"} onClick={onToggle}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </button>
        <button type="button" className="gp-main" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="gp-txt">{it.text}</span>
          <span className="gp-next">{it.next}</span>
          <span className="gp-cue">
            {open ? "Hide actions" : "Take action"}
            <svg className={open ? "flip" : ""} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>
      </div>

      {open && (
        <div className="gp-actions">
          <div className="lact gp-lact">
            {it.actions.map((a) => {
              const active = (a.kind === "call" && phone !== null) || ((a.kind === "text" || a.kind === "email") && compose?.label === a.label);
              return (
                <button type="button" key={a.label} className={`btn ${active ? "primary" : "ghost"}`} onClick={() => pick(a)}>
                  <span className="gp-bi"><GpIcon kind={a.kind} /></span>
                  {a.label}
                </button>
              );
            })}
          </div>

          {phone && (
            <div className="lcall">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z" />
              </svg>
              <span className="lcall-n">{phone}</span>
              <span className="lcall-h">tap to dial · generated demo contact</span>
            </div>
          )}

          {compose && (
            <div className="compose">
              <div className="cmp-hd">
                <GpIcon kind={compose.kind} />
                {compose.kind === "email" ? "Email" : "Text"} · {it.short}
                <span className="cmp-tag">{compose.kind === "email" ? "drafted · edit before sending" : "AI-drafted · edit before sending"}</span>
              </div>
              {compose.kind === "email" && (
                <input className="cmp-subj" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" disabled={sent} />
              )}
              <textarea className={`cmp-body ${compose.kind}`} value={body} onChange={(e) => setBody(e.target.value)} rows={compose.kind === "email" ? 8 : 3} disabled={sent} />
              <div className="cmp-act">
                <button type="button" className="btn primary" disabled={sent} onClick={send}>
                  {sent ? "✓ Sent" : compose.kind === "text" ? "Send text" : "Send email"}
                </button>
                <button type="button" className="btn ghost" onClick={() => setCompose(null)}>
                  {sent ? "Close" : "Cancel"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Agent Business Coach — a fractional-COO voice modeled on real-estate growth
// coaches: gamify leading indicators (reps, not GCI), protect the agent's own
// Profit First margins, and turn every insight into an action taken right now.
// Generated-data-only, like the rest of the demo.
const COACH_KPIS: { l: string; v: string; goal: string; frac: number; note: string }[] = [
  { l: "Conversations", v: "6", goal: "12", frac: 0.5, note: "+2 vs your daily average · 4-day streak" },
  { l: "Contact rate", v: "38%", goal: "40%", frac: 0.95, note: "2 dials from today's target" },
  { l: "Database touches", v: "9", goal: "15", frac: 0.6, note: "6 more keeps your sphere warm" },
];
const COACH_PF: { l: string; v: string; note: string; ok?: boolean }[] = [
  { l: "Pipeline net", v: "$48,200", note: "your side after the split · 3 files closing this week" },
  { l: "Tax reserve", v: "$14,460", note: "30% held · on track", ok: true },
  { l: "Safe owner pay", v: "$6,800", note: "you can pay yourself this now" },
  { l: "Cash runway", v: "5.2 mo", note: "fixed costs covered if the pipeline paused" },
];
const COACH_ASKS: { q: string; a: string }[] = [
  { q: "What's my one number today?", a: "Conversations — you're at 6 of 12. Nothing else on this screen outranks getting to twelve real conversations. Appointments follow reps, not wishes." },
  { q: "Can I pay myself yet?", a: "Yes. $6,800 is safe with your tax reserve already funded. Take it — underpaying yourself isn't discipline, it's a leak." },
  { q: "Should I buy more leads?", a: "Not yet. At a 2.1% appointment rate you'd be pouring water into a leaky bucket. Get your contact rate over 3% for two weeks, then we scale spend." },
];
const COACH_TEXT =
  "Hi Sam — Priya with Cascade Realty. Sorry I missed you earlier. I've already pulled three homes that fit what you described and can get you in this week. What's easier for a quick 10-minute call — today at 4, or tomorrow morning?";

function AgentCoach({ say }: { say: (m: string) => void }) {
  const [draft, setDraft] = useState(false);
  const [body, setBody] = useState(COACH_TEXT);
  const [sent, setSent] = useState(false);
  const [phone, setPhone] = useState(false);
  const [ask, setAsk] = useState<number | null>(null);

  return (
    <div className="section">
      <div className="sh">
        <span className="eyebrow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--copper-soft)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4M12 18v4M5 5l2 2M17 17l2 2M2 12h4M18 12h4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
          </svg>
          Agent Business Coach · Profit First
        </span>
        <span className="desc">your plain-talk AI coach · generated demo</span>
      </div>

      <div className="coach">
        {/* plain-talk assistant — jumps straight to the insight, peer-to-peer */}
        <div className="coach-say">
          <span className="coach-ava">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M5 5l2 2M17 17l2 2M2 12h4M18 12h4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
            </svg>
          </span>
          <p className="coach-line">
            Morning, Priya. Your money&apos;s in good shape — today&apos;s gap is <b>reps, not results</b>. Two conversations
            before noon and the week takes care of itself.
          </p>
        </div>

        {/* gamified leading indicators */}
        <div className="coach-block">
          <span className="eyebrow">Today&apos;s scoreboard · leading indicators</span>
          <div className="coach-kpis">
            {COACH_KPIS.map((k) => (
              <div className="ckpi" key={k.l}>
                <div className="ck-top">
                  <span className="ck-l">{k.l}</span>
                  <span className="ck-v">
                    {k.v}
                    <small> / {k.goal}</small>
                  </span>
                </div>
                <div className="ck-bar">
                  <span className="ck-fill" style={{ width: `${Math.round(k.frac * 100)}%` }} />
                </div>
                <div className="ck-note">{k.note}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Profit First — the agent's own income treated like a business */}
        <div className="coach-block">
          <span className="eyebrow">Profit First · your commission income</span>
          <div className="coach-pf">
            {COACH_PF.map((r) => (
              <div className="pf-row" key={r.l}>
                <span className="pf-l">
                  {r.l}
                  {r.ok && (
                    <svg className="pf-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </span>
                <span className="pf-v">{r.v}</span>
                <span className="pf-note">{r.note}</span>
              </div>
            ))}
          </div>
        </div>

        {/* lead-spend coaching guardrail */}
        <div className="coach-guard">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <div>
            <b>Lead-spend guardrail.</b> You&apos;re at <b>$1,240/mo</b> on portal leads at a <b>2.1%</b> appointment rate.
            Rule: don&apos;t scale spend under <b>3%</b> — the leak is speed-to-lead, not volume. Fix the Sam-Ortega gap
            first, then we open the tap.
          </div>
        </div>

        {/* drive instant action — the next move, right now */}
        <div className="coach-next">
          <p className="cn-head">
            <span className="cn-kicker">Next action, right now</span>
            <b>Sam Ortega — referral, 41 min cold.</b> A referral going cold is money you already earned walking out the
            door. One text stops the bleed.
          </p>
          <div className="lact">
            <button type="button" className={`btn ${draft ? "primary" : "ghost"}`} onClick={() => { setDraft((d) => !d); setPhone(false); setSent(false); }}>
              <span className="gp-bi"><GpIcon kind="text" /></span>
              Draft the text
            </button>
            <button type="button" className={`btn ${phone ? "primary" : "ghost"}`} onClick={() => { setPhone((p) => !p); setDraft(false); }}>
              <span className="gp-bi"><GpIcon kind="call" /></span>
              Call Sam now
            </button>
          </div>

          {phone && (
            <div className="lcall">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z" />
              </svg>
              <span className="lcall-n">(208) 555-0142</span>
              <span className="lcall-h">Twilio click-to-dial · generated demo contact</span>
            </div>
          )}

          {draft && (
            <div className="compose">
              <div className="cmp-hd">
                <GpIcon kind="text" />
                Text · Sam Ortega
                <span className="cmp-tag">AI-drafted · edit before sending</span>
              </div>
              <textarea className="cmp-body text" value={body} onChange={(e) => setBody(e.target.value)} rows={4} disabled={sent} />
              <div className="cmp-act">
                <button type="button" className="btn primary" disabled={sent} onClick={() => { setSent(true); say("Text queued to Sam Ortega · Twilio trigger (demo only · not sent)"); }}>
                  {sent ? "✓ Sent via Twilio" : "Send via Twilio"}
                </button>
                <button type="button" className="btn ghost" onClick={() => setDraft(false)}>
                  {sent ? "Close" : "Cancel"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ask the coach — plain-talk Q&A */}
        <div className="coach-ask">
          <span className="eyebrow">Ask your coach</span>
          <div className="ask-chips">
            {COACH_ASKS.map((qa, i) => (
              <button type="button" key={qa.q} className={`ask-chip ${ask === i ? "on" : ""}`} onClick={() => setAsk((a) => (a === i ? null : i))}>
                {qa.q}
              </button>
            ))}
          </div>
          {ask !== null && (
            <div className="ask-ans">
              <span className="coach-ava sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4M12 18v4M5 5l2 2M17 17l2 2M2 12h4M18 12h4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
                </svg>
              </span>
              <p>{COACH_ASKS[ask].a}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgentApp() {
  const [guardResolved, setGuardResolved] = useState(false);
  const [handled, setHandled] = useState(false);
  const [planDone, setPlanDone] = useState<Record<string, boolean>>({});
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
      {/* executive brief — the 20-second read before the first task */}
      <div className="brief">
        <span className="eyebrow">Your morning</span>
        <ul className="brief-list">
          <li>
            <span className="bdot" style={{ background: handled ? "var(--green)" : "var(--red)" }} />
            <span>
              {handled ? (
                <>
                  <b>214 Highland Park is open</b> — the missing docs are queued; funding at 2 PM is back on track.
                </>
              ) : (
                <>
                  <b>214 Highland Park funds at 2 PM</b> — 2 compliance docs still missing. This is today&apos;s first move.
                </>
              )}
            </span>
          </li>
          <li>
            <span className="bdot" style={{ background: "var(--yellow)" }} />
            <span>
              <b>Sam Ortega</b> (referral) has been unanswered <b>41 min</b> — past the 30-minute line and cooling.
            </span>
          </li>
          <li>
            <span className="bdot" style={{ background: "var(--green)" }} />
            <span>
              3 files closing this week are on track; the market is <b>accelerating</b> in your favor.
            </span>
          </li>
        </ul>
      </div>

      {/* one thing first — an obvious action */}
      {handled ? (
        <div className="onething done">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <p>
            <b>On it.</b> The Highland Park file is open below — walkthrough form and seller disclosure flagged to upload
            before the 2 PM funding. Next: answer Sam Ortega.
          </p>
          <button type="button" className="ot-undo" onClick={() => setHandled(false)}>
            Undo
          </button>
        </div>
      ) : (
        <div className="onething">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          <div className="ot-body">
            <p>
              <b>One thing first — funding today:</b> 214 Highland Park funds at 2 PM but two compliance items (seller
              disclosure signature, final walkthrough form) are still missing. Clear them first, then work the queue.
            </p>
            <div className="ot-actions">
              <button type="button" className="ot-go" onClick={() => { setHandled(true); say("Highland Park file opened — docs flagged to upload."); }}>
                Open the file
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

      {/* agent business coach — the fractional-COO advisor voice */}
      <AgentCoach say={say} />

      {/* today's game plan — time-boxed, checkable rollup of the day */}
      <div className="section gameplan">
        <div className="sh">
          <span className="eyebrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--copper-soft)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Today · game plan
          </span>
          <span className="desc">
            {Object.values(planDone).filter(Boolean).length} of {PLAN_TOTAL} done · tap to check off
          </span>
        </div>
        <div className="gp-buckets">
          {GAME_PLAN.map((bucket) => (
            <div className="gp-bucket" key={bucket.when}>
              <div className="gp-when">{bucket.when}</div>
              {bucket.items.map((it) => (
                <GamePlanItem
                  it={it}
                  key={it.id}
                  checked={!!planDone[it.id]}
                  say={say}
                  onToggle={() => {
                    const nowDone = !planDone[it.id];
                    setPlanDone((p) => ({ ...p, [it.id]: nowDone }));
                    if (nowDone) say(`Checked off · ${it.short}`);
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

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
            <QueueCardView c={c} say={say} key={c.title} />
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
        .onething {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          border: 1px solid var(--copper-dim);
          background: var(--copper-wash);
          border-radius: 11px;
          padding: 12px 14px;
          margin-top: 12px;
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
        .gameplan .gp-buckets {
          display: flex;
          flex-direction: column;
          gap: 13px;
        }
        .gp-bucket {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .gp-when {
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--copper-soft);
        }
        .agent :global(.gp-item) {
          border: 1px solid var(--line);
          background: var(--surface);
          border-radius: 10px;
          overflow: hidden;
          transition: border-color 0.15s;
        }
        .agent :global(.gp-item.r) {
          border-color: color-mix(in srgb, var(--red) 34%, var(--line));
        }
        .agent :global(.gp-item.y) {
          border-color: color-mix(in srgb, var(--yellow) 32%, var(--line));
        }
        .agent :global(.gp-row) {
          display: flex;
          gap: 11px;
          align-items: flex-start;
          padding: 10px 12px;
        }
        .agent :global(.gp-box) {
          flex: none;
          width: 19px;
          height: 19px;
          border-radius: 6px;
          border: 1.5px solid var(--copper-dim);
          background: transparent;
          display: grid;
          place-items: center;
          margin-top: 1px;
          padding: 0;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .agent :global(.gp-box svg) {
          width: 12px;
          height: 12px;
          color: var(--ink);
          opacity: 0;
          transition: opacity 0.12s;
        }
        .agent :global(.gp-item.done .gp-box) {
          background: var(--green);
          border-color: var(--green);
        }
        .agent :global(.gp-item.done .gp-box svg) {
          opacity: 1;
        }
        .agent :global(.gp-main) {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
          text-align: left;
          font: inherit;
          background: transparent;
          border: 0;
          padding: 0;
          cursor: pointer;
        }
        .agent :global(.gp-txt) {
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
          line-height: 1.35;
        }
        .agent :global(.gp-next) {
          font-size: 11.5px;
          color: var(--text-soft);
          line-height: 1.4;
        }
        .agent :global(.gp-item.done .gp-txt) {
          color: var(--muted);
          text-decoration: line-through;
        }
        .agent :global(.gp-item.done .gp-next) {
          color: var(--muted);
        }
        .agent :global(.gp-cue) {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 3px;
          font-size: 11px;
          font-weight: 600;
          color: var(--copper-soft);
        }
        .agent :global(.gp-cue svg) {
          width: 13px;
          height: 13px;
          transition: transform 0.15s;
        }
        .agent :global(.gp-cue svg.flip) {
          transform: rotate(180deg);
        }
        .agent :global(.gp-actions) {
          border-top: 1px solid var(--line);
          padding: 11px 12px 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .agent :global(.gp-lact) {
          flex-wrap: wrap;
        }
        .agent :global(.gp-lact .btn) {
          display: inline-flex;
          align-items: center;
        }
        .agent :global(.gp-bi) {
          display: inline-flex;
          margin-right: 6px;
        }
        .agent :global(.gp-bi svg) {
          width: 13px;
          height: 13px;
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

        /* agent business coach */
        .agent :global(.coach) {
          border: 1px solid var(--copper-dim);
          border-radius: 12px;
          background: var(--surface);
          padding: 15px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .agent :global(.coach-say) {
          display: flex;
          gap: 11px;
          align-items: flex-start;
        }
        .agent :global(.coach-ava) {
          flex: none;
          width: 30px;
          height: 30px;
          border-radius: 9px;
          border: 1px solid var(--copper-dim);
          background: var(--copper-wash);
          color: var(--copper-soft);
          display: grid;
          place-items: center;
        }
        .agent :global(.coach-ava svg) {
          width: 17px;
          height: 17px;
        }
        .agent :global(.coach-ava.sm) {
          width: 24px;
          height: 24px;
        }
        .agent :global(.coach-ava.sm svg) {
          width: 14px;
          height: 14px;
        }
        .agent :global(.coach-line) {
          font-size: 13.5px;
          line-height: 1.5;
          color: var(--text);
          margin: 2px 0 0;
        }
        .agent :global(.coach-line b) {
          color: var(--text);
          font-weight: 700;
        }
        .agent :global(.coach-block) {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }
        .agent :global(.coach-kpis) {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 9px;
        }
        .agent :global(.ckpi) {
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--panel);
          padding: 10px 11px;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .agent :global(.ck-top) {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 6px;
        }
        .agent :global(.ck-l) {
          font-size: 11px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: 600;
        }
        .agent :global(.ck-v) {
          font-family: var(--font-mono);
          font-size: 17px;
          color: var(--text);
          line-height: 1;
        }
        .agent :global(.ck-v small) {
          font-size: 11px;
          color: var(--muted);
        }
        .agent :global(.ck-bar) {
          height: 5px;
          border-radius: 999px;
          background: var(--line);
          overflow: hidden;
        }
        .agent :global(.ck-fill) {
          display: block;
          height: 100%;
          border-radius: 999px;
          background: var(--copper-soft);
        }
        .agent :global(.ck-note) {
          font-size: 11px;
          color: var(--text-soft);
          line-height: 1.35;
        }
        .agent :global(.coach-pf) {
          border: 1px solid var(--line);
          border-radius: 10px;
          overflow: hidden;
        }
        .agent :global(.pf-row) {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          grid-template-areas: "label value" "note note";
          gap: 2px 10px;
          padding: 9px 12px;
          background: var(--panel);
        }
        .agent :global(.pf-row + .pf-row) {
          border-top: 1px solid var(--line);
        }
        .agent :global(.pf-l) {
          grid-area: label;
          font-size: 12.5px;
          color: var(--text);
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .agent :global(.pf-ok) {
          width: 12px;
          height: 12px;
          color: var(--green);
        }
        .agent :global(.pf-v) {
          grid-area: value;
          font-family: var(--font-mono);
          font-size: 14px;
          color: var(--text);
          text-align: right;
        }
        .agent :global(.pf-note) {
          grid-area: note;
          font-size: 11px;
          color: var(--muted);
          line-height: 1.35;
        }
        .agent :global(.coach-guard) {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 11px 12px;
          border: 1px solid var(--yellow);
          border-radius: 10px;
          background: color-mix(in srgb, var(--yellow) 9%, transparent);
        }
        .agent :global(.coach-guard svg) {
          width: 16px;
          height: 16px;
          flex: none;
          margin-top: 1px;
          color: var(--yellow);
        }
        .agent :global(.coach-guard div) {
          font-size: 12px;
          line-height: 1.5;
          color: var(--text-soft);
        }
        .agent :global(.coach-guard b) {
          color: var(--text);
          font-weight: 700;
        }
        .agent :global(.coach-next) {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .agent :global(.cn-head) {
          margin: 0;
          font-size: 12.5px;
          line-height: 1.5;
          color: var(--text-soft);
        }
        .agent :global(.cn-head b) {
          color: var(--text);
          font-weight: 700;
        }
        .agent :global(.cn-kicker) {
          display: block;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          font-weight: 700;
          color: var(--copper-soft);
          margin-bottom: 4px;
        }
        .agent :global(.coach-ask) {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }
        .agent :global(.ask-chips) {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }
        .agent :global(.ask-chip) {
          border: 1px solid var(--line);
          background: var(--panel);
          color: var(--text-soft);
          border-radius: 999px;
          padding: 6px 12px;
          font: inherit;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
        }
        .agent :global(.ask-chip:hover) {
          border-color: var(--copper-dim);
          color: var(--text);
        }
        .agent :global(.ask-chip.on) {
          border-color: var(--copper-soft);
          background: var(--copper-wash);
          color: var(--copper-soft);
        }
        .agent :global(.ask-ans) {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 11px 12px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--panel);
        }
        .agent :global(.ask-ans p) {
          margin: 0;
          font-size: 12.5px;
          line-height: 1.5;
          color: var(--text);
        }
        @media (max-width: 560px) {
          .agent :global(.coach-kpis) {
            grid-template-columns: 1fr;
          }
        }

        .queue {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .agent :global(.qcard) {
          border: 1px solid var(--line);
          border-radius: 12px;
          background: var(--surface);
          overflow: hidden;
        }
        .agent :global(.qcard.r) {
          border-color: color-mix(in srgb, var(--red) 40%, var(--line));
        }
        .agent :global(.qcard.y) {
          border-color: color-mix(in srgb, var(--yellow) 38%, var(--line));
        }
        .agent :global(.qhead) {
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
        .agent :global(.qhead:hover) {
          background: var(--raise);
        }
        .agent :global(.qic) {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          border: 1px solid var(--line);
          background: var(--panel);
          display: grid;
          place-items: center;
          color: var(--copper-soft);
        }
        .agent :global(.qmid) {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .agent :global(.qtype) {
          font-size: 9.5px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted);
          font-weight: 600;
        }
        .agent :global(.qtitle) {
          font-size: 14.5px;
          color: var(--text);
        }
        .agent :global(.qmeta) {
          font-size: 12px;
          color: var(--muted);
        }
        .agent :global(.qwarn) {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 5px;
          font-size: 11.5px;
          color: var(--red);
        }
        .agent :global(.qwarn svg) {
          width: 13px;
          height: 13px;
          flex: none;
        }
        .agent :global(.qright) {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .agent :global(.qtime) {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-soft);
          white-space: nowrap;
        }
        .agent :global(.qchev) {
          color: var(--muted);
          display: inline-flex;
          transition: transform 0.18s;
        }
        .agent :global(.qbody) {
          padding: 4px 15px 14px 61px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          border-top: 1px solid var(--line-soft);
        }
        .agent :global(.qbody[hidden]) {
          display: none;
        }
        .agent :global(.task) {
          display: flex;
          gap: 9px;
          align-items: flex-start;
          font-size: 12.5px;
        }
        .agent :global(.tbox) {
          width: 16px;
          height: 16px;
          border-radius: 5px;
          border: 1px solid var(--line);
          flex: none;
          margin-top: 1px;
          display: grid;
          place-items: center;
        }
        .agent :global(.tbox.done) {
          background: var(--green);
          border-color: var(--green);
          color: var(--ink);
        }
        .agent :global(.tbox.miss) {
          border-color: color-mix(in srgb, var(--red) 50%, var(--line));
        }
        .agent :global(.tbox svg) {
          width: 11px;
          height: 11px;
        }
        .agent :global(.task .tt) {
          color: var(--text-soft);
        }
        .agent :global(.task.done .tt) {
          color: var(--muted);
          text-decoration: line-through;
        }
        .agent :global(.task .file) {
          display: block;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--red);
          margin-top: 2px;
        }
        /* interactive queue tasks — act / read + reply */
        .agent :global(.task.act) {
          display: block;
        }
        .agent :global(.task-row) {
          display: flex;
          gap: 9px;
          align-items: flex-start;
        }
        .agent :global(.tt-btn) {
          font: inherit;
          text-align: left;
          background: transparent;
          border: 0;
          padding: 0;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 10px;
          flex: 1;
          min-width: 0;
        }
        .agent :global(.tt-main) {
          min-width: 0;
        }
        .agent :global(.tt-cue) {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          flex: none;
          font-size: 11px;
          font-weight: 600;
          color: var(--copper-soft);
        }
        .agent :global(.tt-cue svg) {
          width: 13px;
          height: 13px;
          transition: transform 0.18s;
        }
        .agent :global(.task-panel) {
          margin: 9px 0 4px 25px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .agent :global(.qt-lact) {
          flex-wrap: wrap;
        }
        .agent :global(.qmsg) {
          border: 1px solid var(--line);
          border-radius: 9px;
          background: var(--panel);
          padding: 10px 11px;
        }
        .agent :global(.qmsg-hd) {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 5px;
        }
        .agent :global(.qmsg-from) {
          font-size: 12px;
          font-weight: 600;
          color: var(--text);
        }
        .agent :global(.qmsg-when) {
          font-size: 11px;
          color: var(--muted);
        }
        .agent :global(.qmsg-body) {
          font-size: 12.5px;
          color: var(--text-soft);
          line-height: 1.5;
        }
        .agent :global(.qreply-hd) {
          font-size: 11px;
          font-weight: 600;
          color: var(--muted);
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .agent :global(.qsent) {
          align-self: center;
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: var(--muted);
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
        .agent :global(.lead) {
          border: 1px solid var(--line);
          border-radius: 11px;
          background: var(--surface);
          padding: 13px 14px;
          margin-top: 10px;
        }
        .agent :global(.lead.r) {
          border-color: color-mix(in srgb, var(--red) 40%, var(--line));
          background: var(--red-wash);
        }
        .agent :global(.lead.y) {
          border-color: color-mix(in srgb, var(--yellow) 38%, var(--line));
        }
        .agent :global(.lead.done) {
          opacity: 0.5;
        }
        .agent :global(.lead.done .lact) {
          pointer-events: none;
        }
        .agent :global(.lhead) {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: baseline;
          flex-wrap: wrap;
        }
        .agent :global(.lnm) {
          font-size: 14.5px;
          color: var(--text);
        }
        .agent :global(.lflag) {
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .agent :global(.lflag.r) {
          color: var(--red);
        }
        .agent :global(.lflag.y) {
          color: var(--yellow);
        }
        .agent :global(.lflag.g) {
          color: var(--green);
        }
        .agent :global(.lflag svg) {
          width: 12px;
          height: 12px;
        }
        .agent :global(.lmeta) {
          font-size: 12.5px;
          color: var(--muted);
          margin-top: 2px;
        }
        .agent :global(.lwhy) {
          font-size: 12.5px;
          color: var(--text-soft);
          margin-top: 8px;
          line-height: 1.5;
        }
        .agent :global(.lact) {
          display: flex;
          gap: 8px;
          margin-top: 10px;
          flex-wrap: wrap;
        }
        .agent :global(.lcall) {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 10px;
          border: 1px solid var(--line);
          border-radius: 9px;
          background: var(--surface);
          padding: 10px 12px;
        }
        .agent :global(.lcall svg) {
          width: 15px;
          height: 15px;
          color: var(--copper-soft);
          flex: none;
        }
        .agent :global(.lcall-n) {
          font-family: var(--font-mono);
          font-size: 16px;
          color: var(--copper-soft);
        }
        .agent :global(.lcall-h) {
          font-size: 11px;
          color: var(--muted);
        }
        .agent :global(.compose) {
          margin-top: 10px;
          border: 1px solid var(--copper-dim);
          border-radius: 10px;
          background: var(--panel);
          padding: 12px 13px;
        }
        .agent :global(.tpick) {
          margin-top: 11px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .agent :global(.tgroup) {
          display: flex;
          align-items: baseline;
          gap: 8px;
          flex-wrap: wrap;
        }
        .agent :global(.tglabel) {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted);
          min-width: 62px;
        }
        .agent :global(.tchips) {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .agent :global(.tchip) {
          font: inherit;
          font-size: 11.5px;
          color: var(--text-soft);
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 5px 11px;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s, background 0.15s;
        }
        .agent :global(.tchip:hover) {
          border-color: var(--copper-dim);
          color: var(--text);
        }
        .agent :global(.tchip.on) {
          color: var(--ink);
          background: var(--copper-soft);
          border-color: var(--copper-soft);
          font-weight: 600;
        }
        .agent :global(.addr) {
          display: flex;
          gap: 8px;
          margin-top: 10px;
          flex-wrap: wrap;
        }
        .agent :global(.addr-in) {
          flex: 1;
          min-width: 180px;
          font: inherit;
          font-size: 13px;
          color: var(--text);
          background: var(--surface);
          border: 1px solid var(--copper-dim);
          border-radius: 8px;
          padding: 8px 10px;
        }
        .agent :global(.addr-in:focus) {
          outline: none;
          border-color: var(--copper-soft);
        }
        .agent :global(.addr-go) {
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          color: var(--ink);
          background: var(--copper-soft);
          border: 1px solid var(--copper-soft);
          border-radius: 8px;
          padding: 8px 14px;
          cursor: pointer;
          flex: none;
        }
        .agent :global(.addr-go:disabled) {
          opacity: 0.5;
          cursor: default;
        }
        .agent :global(.cmp-hd) {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--text);
        }
        .agent :global(.cmp-hd svg) {
          width: 15px;
          height: 15px;
          color: var(--copper-soft);
          flex: none;
        }
        .agent :global(.cmp-tag) {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--muted);
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 2px 8px;
          margin-left: auto;
        }
        .agent :global(.cmp-subj) {
          width: 100%;
          margin-top: 10px;
          font: inherit;
          font-size: 13px;
          color: var(--text);
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 8px 10px;
        }
        .agent :global(.cmp-body) {
          width: 100%;
          margin-top: 8px;
          font: inherit;
          font-size: 13px;
          color: var(--text-soft);
          line-height: 1.5;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 9px 11px;
          resize: vertical;
        }
        .agent :global(.cmp-body.text) {
          border-radius: 14px;
        }
        .agent :global(.cmp-subj:focus),
        .agent :global(.cmp-body:focus) {
          outline: none;
          border-color: var(--copper-dim);
        }
        .agent :global(.cmp-subj:disabled),
        .agent :global(.cmp-body:disabled) {
          opacity: 0.7;
        }
        .agent :global(.cmp-act) {
          display: flex;
          gap: 8px;
          margin-top: 10px;
          flex-wrap: wrap;
        }
        .agent :global(.cmp-act .btn.primary:disabled) {
          background: var(--green);
          border-color: var(--green);
          color: var(--ink);
          cursor: default;
          filter: none;
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
        .agent :global(.btn) {
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
        .agent :global(.btn:hover) {
          filter: brightness(1.08);
        }
        .agent :global(.btn.primary) {
          background: var(--copper-soft);
          border-color: var(--copper-soft);
          color: var(--ink);
        }
        .agent :global(.btn.urgent) {
          background: var(--red);
          border-color: var(--red);
          color: #fff;
        }
        .agent :global(.btn.ghost) {
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
