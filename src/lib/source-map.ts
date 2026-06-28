import type { BusinessType } from "@prisma/client";

export type SourceCategory = "cash" | "sales" | "costs" | "labor" | "pipeline" | "aura" | "accounting";

export interface SourceOption {
  name: string;
  role: string;
  unlocks: string[];
  minimum?: boolean;
}

export interface SourceGroup {
  category: SourceCategory;
  label: string;
  purpose: string;
  options: SourceOption[];
}

export interface BusinessSourceMap {
  businessType: BusinessType;
  minimumAutoInput: string;
  groups: SourceGroup[];
}

const commonCash: SourceGroup = {
  category: "cash",
  label: "Cash truth",
  purpose: "Shows what actually landed, cleared, and left the business.",
  options: [
    { name: "Plaid", role: "Bank transactions", unlocks: ["cash runway", "vendor spend", "Profit First buckets"], minimum: true },
    { name: "Statement upload", role: "Fallback bank import", unlocks: ["cash runway", "category review"] },
  ],
};

const commonAccounting: SourceGroup = {
  category: "accounting",
  label: "Accounting source",
  purpose: "Adds invoice, bill, chart-of-account, and advisor-grade context.",
  options: [
    { name: "QuickBooks Online", role: "Invoices, bills, P&L categories", unlocks: ["receivables", "payables", "accountant review"], minimum: true },
    { name: "Xero", role: "Invoices, bills, P&L categories", unlocks: ["receivables", "payables", "accountant review"] },
    { name: "Sage", role: "Accounting system", unlocks: ["financial reporting", "advisor review"] },
  ],
};

const auraGroup: SourceGroup = {
  category: "aura",
  label: "Market energy",
  purpose: "Reads demand, reputation, search intent, and customer action.",
  options: [
    { name: "Google Business Profile", role: "Calls, directions, website clicks, search impressions, reviews", unlocks: ["Aura", "demand intent", "review trend"], minimum: true },
    { name: "Yelp", role: "Reviews and rating trend", unlocks: ["review health", "complaint themes"] },
    { name: "Meta / Instagram", role: "Social engagement", unlocks: ["brand momentum", "campaign response"] },
  ],
};

export const SOURCE_MAPS: Record<BusinessType, BusinessSourceMap> = {
  RESTAURANT: {
    businessType: "RESTAURANT",
    minimumAutoInput: "Plaid + POS. MarginEdge and Google Business Profile make it sharper, but bank plus sales is enough to create a useful heartbeat.",
    groups: [
      commonCash,
      {
        category: "sales",
        label: "Sales and guest activity",
        purpose: "Turns daily restaurant activity into momentum and allocation basis.",
        options: [
          { name: "Toast", role: "POS sales, guests, orders, labor hours, sales tax", unlocks: ["sales momentum", "tax vault", "labor pressure"], minimum: true },
          { name: "Square / Clover / Lightspeed", role: "POS sales", unlocks: ["sales momentum", "allocation basis"] },
        ],
      },
      {
        category: "costs",
        label: "Food cost and AP",
        purpose: "Moves COGS from estimated to invoice-backed.",
        options: [
          { name: "MarginEdge", role: "Invoices, COGS, inventory, recipe/menu analysis", unlocks: ["true food cost", "vendor price pressure", "AP timing"] },
          { name: "Restaurant365 / MarketMan / Craftable", role: "Restaurant back office", unlocks: ["invoice-backed COGS", "inventory pressure"] },
        ],
      },
      {
        ...commonAccounting,
        options: commonAccounting.options.map((option) => ({ ...option, minimum: false })),
      },
      {
        ...auraGroup,
        options: auraGroup.options.map((option) => ({ ...option, minimum: false })),
      },
    ],
  },
  SERVICE: {
    businessType: "SERVICE",
    minimumAutoInput: "Plaid + accounting. A CRM or scheduling feed becomes the next unlock once cash and invoices are flowing.",
    groups: [
      commonCash,
      commonAccounting,
      {
        category: "pipeline",
        label: "Client pipeline",
        purpose: "Shows whether upcoming work can support the next cash cycle.",
        options: [
          { name: "HubSpot / Salesforce", role: "Deals, clients, expected close timing", unlocks: ["pipeline health", "lead conversion"], minimum: true },
          { name: "Stripe / Square", role: "Payments", unlocks: ["paid vs. promised revenue"] },
        ],
      },
      auraGroup,
    ],
  },
  CONTRACTOR: {
    businessType: "CONTRACTOR",
    minimumAutoInput: "Plaid + QuickBooks. Add Jobber, Housecall Pro, or ServiceTitan when job margin and schedule capacity matter.",
    groups: [
      commonCash,
      commonAccounting,
      {
        category: "pipeline",
        label: "Jobs and schedule",
        purpose: "Connects booked work, materials, labor, and cash timing.",
        options: [
          { name: "Jobber", role: "Jobs, estimates, scheduling, invoices", unlocks: ["job margin", "capacity", "receivables"], minimum: true },
          { name: "Housecall Pro", role: "Field-service jobs", unlocks: ["job margin", "crew utilization"] },
          { name: "ServiceTitan", role: "Larger field-service operations", unlocks: ["technician performance", "dispatch pressure"] },
        ],
      },
      auraGroup,
    ],
  },
  REAL_ESTATE_BROKERAGE: {
    businessType: "REAL_ESTATE_BROKERAGE",
    minimumAutoInput: "Start with bank (Plaid) + QuickBooks/Xero — that alone gives Company Dollar, runway, break-even, and Profit First. CRM and market data are upgrades, not requirements.",
    groups: [
      commonCash,
      commonAccounting,
      {
        category: "pipeline",
        label: "Commission pipeline (useful upgrade)",
        purpose: "Optional upgrade. Add a CRM or transaction system to unlock the pending pipeline, expected commission, agent splits and caps, and lead ROI. You do not need this to start.",
        options: [
          { name: "Follow Up Boss / Lofty / kvCORE", role: "CRM pipeline and lead source", unlocks: ["commission pipeline", "lead ROI"] },
          { name: "Brokermint / Dotloop / SkySlope", role: "Transaction management", unlocks: ["pending closings", "deal margin"] },
          { name: "MLS export", role: "Listings and statuses", unlocks: ["listing pace", "pipeline confidence"] },
        ],
      },
      {
        category: "aura",
        label: "Market & reputation (premium layer)",
        purpose: "Optional premium layer. Market and reputation signals — referral demand, portal/ad ROI, and local momentum before commissions land.",
        options: [
          { name: "Google Business Profile", role: "Calls, website clicks, search impressions, reviews", unlocks: ["referral momentum", "local demand"] },
          { name: "Zillow / Realtor.com", role: "Lead and profile activity", unlocks: ["portal ROI", "listing attention"] },
          { name: "Meta / Google Ads", role: "Ad spend and leads", unlocks: ["lead ROI", "campaign pressure"] },
        ],
      },
    ],
  },
  VACATION_RENTAL: {
    businessType: "VACATION_RENTAL",
    minimumAutoInput: "Plaid + booking platform. Accounting adds owner payouts and cleaner property-level profit.",
    groups: [
      commonCash,
      commonAccounting,
      {
        category: "sales",
        label: "Bookings and occupancy",
        purpose: "Shows occupancy, ADR, RevPAR, booking pace, platform fees, and future cash.",
        options: [
          { name: "Airbnb / Vrbo / Booking.com", role: "Bookings, payouts, reviews", unlocks: ["occupancy", "booking pace", "guest Aura"], minimum: true },
          { name: "Guesty / Hostaway / OwnerRez / Lodgify", role: "Property-management system", unlocks: ["property profit", "owner payouts", "maintenance drag"] },
        ],
      },
      {
        category: "costs",
        label: "Turns and maintenance",
        purpose: "Shows cleaning, laundry, supplies, repairs, and unit-level drag.",
        options: [
          { name: "QuickBooks classes / locations", role: "Property-level cost tagging", unlocks: ["unit profitability", "maintenance drag"], minimum: true },
          { name: "Jobber / Breezeway", role: "Turnover and maintenance work", unlocks: ["turn cost", "service reliability"] },
        ],
      },
      auraGroup,
    ],
  },
  RETAIL: {
    businessType: "RETAIL",
    minimumAutoInput: "Plaid + POS or ecommerce. Inventory is the main upgrade once cash and sales are flowing.",
    groups: [
      commonCash,
      commonAccounting,
      {
        category: "sales",
        label: "Sales and channels",
        purpose: "Tracks store/ecommerce sales, returns, and channel performance.",
        options: [
          { name: "Square", role: "POS sales, tenders, refunds, item/category sales", unlocks: ["store sales", "gross margin"], minimum: true },
          { name: "Clover", role: "POS sales, employees, tenders, and inventory add-ons", unlocks: ["store sales", "payroll context", "gross margin"] },
          { name: "Shopify POS", role: "Store and ecommerce sales, orders, returns, inventory", unlocks: ["channel mix", "sales momentum", "inventory pressure"], minimum: true },
          { name: "Lightspeed Retail", role: "POS, inventory, vendors, purchase orders, multi-location retail", unlocks: ["inventory pressure", "gross margin", "sell-through"] },
          { name: "Helcim / GoDaddy POS / Revel / Other POS", role: "Sales, refunds, tenders, and item/category exports", unlocks: ["store sales", "payment mix"] },
        ],
      },
      {
        category: "costs",
        label: "Inventory and margin",
        purpose: "Shows inventory pressure, sell-through, and gross-margin drag.",
        options: [
          { name: "Shopify / Lightspeed / Square / Clover inventory", role: "Stock, item costs, variants, vendors, and adjustments", unlocks: ["inventory pressure", "gross margin"], minimum: true },
        ],
      },
      auraGroup,
    ],
  },
};

export function sourceMapFor(type: BusinessType | null | undefined): BusinessSourceMap {
  return SOURCE_MAPS[type ?? "RESTAURANT"] ?? SOURCE_MAPS.RESTAURANT;
}
