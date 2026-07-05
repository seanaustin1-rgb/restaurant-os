/**
 * Public real-estate demo — the three-page cockpit (Broker · Agent · Rental).
 *
 * Now served by the native React port (`native/RealEstateDemo`), driven by
 * generated demo data with scoped styled-jsx so nothing leaks into the app.
 * `/demo(.*)` is already public in `src/middleware.ts`.
 *
 * The original design-approved static asset is retained at
 * `/demo/real-estate-cockpit.html` as a directly-reachable reference / instant
 * rollback. Next step (operator-gated): wire the generated data to a demo-DB
 * brokerage/rental tenant (DEMO_DATABASE_URL only).
 */
import RealEstateDemo from "./native/RealEstateDemo";

export const metadata = {
  title: "OutFront Data — Real Estate Demo",
  description:
    "Live demo: brokerage executive cockpit, the agent frontline app, and vacation-rental management — one engine, generated data.",
};

export default function RealEstateCockpitDemoPage() {
  return <RealEstateDemo />;
}
