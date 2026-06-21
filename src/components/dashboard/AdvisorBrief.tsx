import Link from "next/link";
import { AlertTriangle, CheckCircle2, MessageSquareText, PlugZap, ShieldCheck } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard/data";
import { money, pct } from "@/lib/format";

interface BriefItem {
  label: string;
  detail: string;
  href: string;
}

function topWatchout(data: DashboardData): BriefItem {
  const cash = data.goLiveCoach.cashSafety;
  if (!cash.ready) {
    return {
      label: cash.hasAnchor ? "Cash floor is tight" : "Cash anchor is missing",
      detail: cash.detail,
      href: "/modules/go-live",
    };
  }

  const redGauge = [...data.gauges].sort((a, b) => b.usagePct - a.usagePct).find((g) => g.health === "red");
  if (redGauge) {
    return {
      label: `${redGauge.label} is over target`,
      detail: `${redGauge.label} is using ${pct(redGauge.usagePct, 0)} of its Profit First lane.`,
      href: "/dashboard",
    };
  }

  const coach = data.goLiveCoach;
  if (coach.stage === "coach") {
    return {
      label: "Go-Live is still in coach mode",
      detail: coach.recommendation,
      href: "/modules/go-live",
    };
  }

  return {
    label: "No urgent blocker visible",
    detail: "Use the conversation prompt to confirm the operator agrees with what the data is showing.",
    href: "/dashboard",
  };
}

function topWin(data: DashboardData): BriefItem {
  const ready = data.goLiveCoach.stage === "pilot_ready" || data.goLiveCoach.stage === "enforce_ready";
  if (ready) {
    return {
      label: "Profit First model is stabilizing",
      detail: data.goLiveCoach.summary,
      href: "/modules/go-live",
    };
  }

  const greenGauge = data.gauges.find((g) => g.health === "green");
  if (greenGauge) {
    return {
      label: `${greenGauge.label} is inside target`,
      detail: `${money(greenGauge.spent)} used against a ${money(greenGauge.target)} virtual target.`,
      href: "/dashboard",
    };
  }

  return {
    label: "Sales read is available",
    detail: `${money(data.revenue.revenueMTD)} revenue MTD with ${money(data.revenue.realRevenueMTD)} real revenue.`,
    href: "/dashboard",
  };
}

function missingData(data: DashboardData): BriefItem {
  const cash = data.goLiveCoach.cashSafety;
  if (!cash.hasAnchor) {
    return {
      label: "Cash balance anchor",
      detail: "Needed before the coach can judge pilot safety and runway.",
      href: "/modules/go-live",
    };
  }

  const tax = data.goLiveCoach.checks.find((c) => c.key === "tax-source");
  if (tax && !tax.ready) {
    return {
      label: "Collected sales tax",
      detail: tax.detail,
      href: "/modules/go-live",
    };
  }

  const categorization = data.goLiveCoach.checks.find((c) => c.key === "categorization");
  if (categorization && !categorization.ready) {
    return {
      label: "Transaction categorization",
      detail: categorization.detail,
      href: "/transactions",
    };
  }

  return {
    label: "Aura intent data",
    detail: "Google calls, directions, website clicks, and profile views are the next market-energy signals to wire.",
    href: "/modules/aura",
  };
}

function goLiveStatus(data: DashboardData): BriefItem {
  const coach = data.goLiveCoach;
  const ready = coach.stage === "pilot_ready" || coach.stage === "enforce_ready";
  return {
    label: ready ? "Ready to rehearse pilot" : `Still in ${coach.stageLabel}`,
    detail: coach.recommendation,
    href: "/modules/go-live",
  };
}

function conversationPrompt(data: DashboardData, watchout: BriefItem): string {
  if (watchout.href === "/modules/go-live") {
    return `Ask the operator: "${watchout.label} is the first constraint. What changed operationally this week?"`;
  }
  if (watchout.label.includes("over target")) {
    return `Ask the operator: "What drove ${watchout.label.toLowerCase()}, and is it temporary or structural?"`;
  }
  if (data.revenue.revenueMTD <= 0) {
    return 'Ask the operator: "Which data source should be connected first so this heartbeat becomes useful?"';
  }
  return 'Ask the operator: "Does this heartbeat match what you feel in the restaurant this week?"';
}

export function AdvisorBrief({ data }: { data: DashboardData }) {
  const watchout = topWatchout(data);
  const win = topWin(data);
  const missing = missingData(data);
  const goLive = goLiveStatus(data);
  const prompt = conversationPrompt(data, watchout);

  return (
    <section className="rounded-lg border border-line bg-surface px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted">Advisor mode</p>
          <h2 className="mt-1 font-display text-xl text-copper-soft">Client conversation brief</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
            A consultant/accountant view of what to celebrate, what to inspect, and what data is still missing.
          </p>
        </div>
        <Link href={watchout.href} className="rounded-md border border-line px-3 py-1.5 text-xs text-copper-soft hover:border-copper">
          Start with watchout
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
        <AdvisorCard icon="watchout" label="Top watchout" item={watchout} />
        <AdvisorCard icon="win" label="Top win" item={win} />
        <AdvisorCard icon="missing" label="Missing data" item={missing} />
        <AdvisorCard icon="go-live" label="Go-Live status" item={goLive} />
      </div>

      <div className="mt-3 rounded-lg border border-copper-dim/40 bg-copper-dim/10 px-3 py-3">
        <div className="flex items-start gap-2">
          <MessageSquareText size={15} className="mt-0.5 shrink-0 text-copper-soft" />
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">Suggested conversation</p>
            <p className="mt-1 text-sm text-[#E6E8E4]">{prompt}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function AdvisorCard({ icon, label, item }: { icon: "watchout" | "win" | "missing" | "go-live"; label: string; item: BriefItem }) {
  const Icon =
    icon === "watchout" ? AlertTriangle : icon === "win" ? CheckCircle2 : icon === "missing" ? PlugZap : ShieldCheck;
  const color =
    icon === "watchout"
      ? "text-health-yellow"
      : icon === "win" || icon === "go-live"
        ? "text-health-green"
        : "text-copper-soft";

  return (
    <Link href={item.href} className="rounded-lg border border-line bg-ink/30 px-3 py-3 transition-colors hover:border-copper">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
        <Icon size={13} className={color} /> {label}
      </div>
      <p className="mt-2 text-sm text-[#E6E8E4]">{item.label}</p>
      <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-muted">{item.detail}</p>
    </Link>
  );
}
