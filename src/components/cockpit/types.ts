/**
 * TEMP local mirror of the agreed `BrokerageCockpitData` contract
 * (executive-cockpit-tile-set.md §3 + Codex redline §5.1/§5.2).
 *
 * Codex owns the REAL type in the data lane. When it lands, delete this file and
 * import from there — the components below are written against this shape ONLY,
 * so the swap is a one-line import change with no component rework.
 */

export type CockpitStatus = "green" | "yellow" | "red" | "unknown";

export interface CockpitAura {
  overallRating: number | null;
  totalReviews: number;
  hasAnyData: boolean;
}

export interface AgentRow {
  agentId: string; // canonical — NOT a per-source external id
  name: string;
  email: string | null;
  companyDollar: number;
  retainedYield: number;
  capRemaining: number | null;
  capProgressPct: number | null;
  pipelineCompanyDollar: number;
  leadSpend: number;
  roi: number | null; // attributedGci ÷ leadSpend
  health: "green" | "yellow" | "red";
  sourceConfidence: "imported" | "profile_assumption" | "mixed";
  note?: string;
}

export interface BrokerageCockpitData {
  restaurantId: string;
  name: string;
  periodLabel: string;
  industryType: "REAL_ESTATE_BROKERAGE";

  dealHealth: {
    closedGci: number;
    pipelineGci: number;
    closedVolume: number; // Σ sale price
    sideCount: number;
    trendPts: number | null; // weekly ▲/▼
  };
  ledgerHealth: {
    companyDollar: number;
    companyDollarPct: number | null; // company dollar ÷ GCI
    cashPosition: number | null; // QBO
    status: CockpitStatus;
  };
  companyDollarRetention: {
    pct: number | null;
    targetPct: number;
    atRiskFromCaps: number; // company dollar lost as agents cap out
    status: CockpitStatus;
  };
  // Mirrors `DashboardCashSafety & { floorDaysTarget }`; only fields the view renders.
  cashSafety: {
    currentCash: number | null;
    oxygenDays: number | null;
    netCashChangePeriod: number | null;
    floorDaysTarget: number; // brokerage default 120 (band 90–180)
    status: CockpitStatus;
  };
  agentProduction: {
    activeAgents: number;
    totalCompanyDollar: number;
    topContributors: AgentRow[];
    bottomContributors: AgentRow[];
  };
  marketAura: {
    market: {
      activeToPendingRatio: number | null;
      medianDom: number | null;
      newListings: number | null;
      trendPts: number | null;
    } | null; // null until a real MLS/RESO source is connected
    aura: CockpitAura;
  };
  topPressure: {
    metricKey: string;
    label: string;
    currentValue: number;
    targetValue: number;
    readout: string;
  } | null;
  sourceTrust: {
    connected: number;
    required: number;
    missing: string[];
    status: "healthy" | "partial";
  };
}
