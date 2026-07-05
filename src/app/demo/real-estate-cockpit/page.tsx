/**
 * Public real-estate demo — the three-page cockpit (Broker · Agent · Rental).
 *
 * Phase 1: served full-bleed from the self-contained, design-approved asset in
 * `/public/demo/real-estate-cockpit.html` so it renders exactly as reviewed, with
 * zero SSR/hydration risk. `/demo(.*)` is already public in `src/middleware.ts`.
 *
 * Phase 2 (next): port this to native React components in the Tailwind design
 * system, driven by generated demo data, then wired to a demo-DB brokerage/rental
 * tenant. Until then this static overlay is the live demo on outfrontdata.com.
 */
export const metadata = {
  title: "OutFront Data — Real Estate Demo",
  description:
    "Live demo: brokerage executive cockpit, the agent frontline app, and vacation-rental management — one engine, generated data.",
};

export default function RealEstateCockpitDemoPage() {
  return (
    <iframe
      src="/demo/real-estate-cockpit.html"
      title="OutFront Data — Real Estate Demo"
      className="fixed inset-0 h-full w-full border-0"
      style={{ zIndex: 100 }}
    />
  );
}
