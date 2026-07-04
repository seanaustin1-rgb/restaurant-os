import type { DashboardData } from "@/lib/dashboard/data";
import {
  deriveAttention,
  deriveSourceTrust,
  deriveTopPressure,
} from "@/lib/dashboard/signals";
import type { ForwardCashData } from "@/lib/modules/forward-cash";
import { money } from "@/lib/format";

// Daily Digest — the once-a-day "one thing + what to watch" summary that lands in
// the operator's inbox each morning. It is DETERMINISTIC content assembled from the
// already-tested dashboard signals (deriveTopPressure / deriveAttention /
// deriveSourceTrust) plus the Forward Cash low-point — no AI, no new math, no DB.
// The pure builder + renderers here are unit-tested; the Inngest worker is thin
// wiring over them. Honest degradation: thin data reads as "no live data yet",
// never an invented pressure point.

export type DigestTone = "alert" | "info" | "ok";

export interface DigestLine {
  label: string;
  value: string;
  tone: DigestTone;
}

export interface DailyDigest {
  subject: string;
  restaurantName: string;
  dateLabel: string;
  /** "The one thing" — the single most important readout for the day. */
  oneThing: DigestLine;
  /** Up to 3 further out-of-band items, most-severe-first, excluding the one thing. */
  watchItems: DigestLine[];
  /** The Forward Cash low-point line, or null when there's no anchored balance. */
  forwardCash: DigestLine | null;
  /** Source/trust status — honest about missing required connectors. */
  sourceTrust: DigestLine;
  /** Whether anything actionable surfaced — drives the subject line (alert vs all-clear). */
  hasSignal: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Format an ISO date (YYYY-MM-DD) as "Jul 4" — no clock, safe for the pure layer. */
function dayLabel(isoDate: string): string {
  const [, m, d] = isoDate.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}`;
}

const MAX_WATCH_ITEMS = 3;

export interface DailyDigestInput {
  restaurantName: string;
  /** Human date for the digest, e.g. "Saturday, Jul 4". Passed in — no clock here. */
  dateLabel: string;
  dashboard: DashboardData;
  forwardCash: ForwardCashData;
}

/** "The one thing" line from the deterministic top-pressure signal. */
function oneThingLine(dashboard: DashboardData): DigestLine {
  const top = deriveTopPressure(dashboard);
  switch (top.state) {
    case "insufficient-data":
      return { label: "The one thing", value: "No live operating data loaded yet — connect a source to get your daily read.", tone: "info" };
    case "ok":
      return { label: "The one thing", value: "Nothing red today — set-asides and cost ratios are all in band.", tone: "ok" };
    case "pressure":
      return { label: top.label, value: top.readout, tone: "alert" };
  }
}

/** Forward Cash low-point, or null when the operator hasn't anchored a balance. */
function forwardCashLine(forwardCash: ForwardCashData): DigestLine | null {
  if (!forwardCash.hasAnchor || forwardCash.lowPoint == null) return null;
  const { balance, date } = forwardCash.lowPoint;
  if (forwardCash.breachesZero) {
    return {
      label: "Forward cash",
      value: `Balance dips to ${money(balance)} on ${dayLabel(date)} and goes negative — move a bill or a sweep before then.`,
      tone: "alert",
    };
  }
  return {
    label: "Forward cash",
    value: `Projected low-point of ${money(balance)} on ${dayLabel(date)} over the next ${forwardCash.windowDays} days.`,
    tone: "info",
  };
}

/** Source/trust line — escalates honestly when required connectors are missing. */
function sourceTrustLine(dashboard: DashboardData): DigestLine {
  const trust = deriveSourceTrust(dashboard);
  if (trust.escalate) {
    return {
      label: "Data sources",
      value: `${trust.connected}/${trust.required} required sources connected — missing ${trust.missing.join(", ")}. Freshness can't be fully trusted until these are set.`,
      tone: "alert",
    };
  }
  return {
    label: "Data sources",
    value: trust.required > 0 ? `All ${trust.required} required sources connected.` : "No required sources outstanding.",
    tone: "ok",
  };
}

/**
 * Assemble the day's digest from the shared signals. Pure — the caller supplies the
 * already-loaded DashboardData and ForwardCashData plus a preformatted date label.
 */
export function buildDailyDigest(input: DailyDigestInput): DailyDigest {
  const oneThing = oneThingLine(input.dashboard);
  const topPressure = deriveTopPressure(input.dashboard);
  const topId = topPressure.state === "pressure" ? topPressure.id : null;

  const watchItems: DigestLine[] = deriveAttention(input.dashboard)
    .filter((item) => item.id !== topId)
    .slice(0, MAX_WATCH_ITEMS)
    .map((item) => ({
      label: item.label,
      value: item.readout,
      tone: item.severity === "red" ? "alert" : "info",
    }));

  const forwardCash = forwardCashLine(input.forwardCash);
  const sourceTrust = sourceTrustLine(input.dashboard);

  const hasSignal =
    oneThing.tone === "alert" ||
    forwardCash?.tone === "alert" ||
    sourceTrust.tone === "alert" ||
    watchItems.length > 0;

  const subject = oneThing.tone === "alert"
    ? `${input.restaurantName}: ${oneThing.label} needs attention`
    : forwardCash?.tone === "alert"
      ? `${input.restaurantName}: cash dips below zero this month`
      : hasSignal
        ? `${input.restaurantName}: your daily read for ${input.dateLabel}`
        : `${input.restaurantName}: all clear for ${input.dateLabel}`;

  return { subject, restaurantName: input.restaurantName, dateLabel: input.dateLabel, oneThing, watchItems, forwardCash, sourceTrust, hasSignal };
}

const TONE_MARK: Record<DigestTone, string> = { alert: "⚠", info: "•", ok: "✓" };

/** Plain-text rendering — the always-present email body (some clients strip HTML). */
export function renderDigestText(d: DailyDigest): string {
  const lines: string[] = [`${d.restaurantName} — ${d.dateLabel}`, ""];
  lines.push(`THE ONE THING`, `${TONE_MARK[d.oneThing.tone]} ${d.oneThing.label}: ${d.oneThing.value}`, "");
  if (d.watchItems.length > 0) {
    lines.push("ALSO WATCHING");
    for (const w of d.watchItems) lines.push(`${TONE_MARK[w.tone]} ${w.label}: ${w.value}`);
    lines.push("");
  }
  if (d.forwardCash) lines.push(`${TONE_MARK[d.forwardCash.tone]} ${d.forwardCash.label}: ${d.forwardCash.value}`, "");
  lines.push(`${TONE_MARK[d.sourceTrust.tone]} ${d.sourceTrust.label}: ${d.sourceTrust.value}`);
  return lines.join("\n");
}

const TONE_COLOR: Record<DigestTone, string> = { alert: "#c0392b", info: "#7a6a55", ok: "#2e7d5b" };

function htmlLine(l: DigestLine): string {
  return `<p style="margin:0 0 10px"><strong style="color:${TONE_COLOR[l.tone]}">${escapeHtml(l.label)}:</strong> ${escapeHtml(l.value)}</p>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** HTML rendering — a simple, email-client-safe layout (inline styles only). */
export function renderDigestHtml(d: DailyDigest): string {
  const watch = d.watchItems.length > 0
    ? `<h3 style="font:600 12px sans-serif;letter-spacing:.05em;text-transform:uppercase;color:#7a6a55;margin:18px 0 8px">Also watching</h3>${d.watchItems.map(htmlLine).join("")}`
    : "";
  const cash = d.forwardCash ? htmlLine(d.forwardCash) : "";
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#2a2622">
      <p style="font:600 13px sans-serif;color:#7a6a55;margin:0 0 4px">${escapeHtml(d.restaurantName)} · ${escapeHtml(d.dateLabel)}</p>
      <h2 style="font:600 12px sans-serif;letter-spacing:.05em;text-transform:uppercase;color:#7a6a55;margin:0 0 8px">The one thing</h2>
      ${htmlLine(d.oneThing)}
      ${watch}
      ${cash ? `<hr style="border:none;border-top:1px solid #eee;margin:16px 0" />${cash}` : ""}
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
      ${htmlLine(d.sourceTrust)}
    </div>
  `;
}
