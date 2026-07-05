/**
 * Native React port of the real-estate demo (Phase 2, in progress).
 *
 * Lives alongside the shipped iframe demo at `/demo/real-estate-cockpit`. Once
 * the Agent app + Rental cockpit are ported natively, this replaces the iframe
 * route and gets wired to a demo-DB brokerage/rental tenant. `/demo(.*)` is
 * already public in `src/middleware.ts`.
 */
import RealEstateDemo from "./RealEstateDemo";

export const metadata = {
  title: "OutFront Data — Real Estate Demo (native)",
  description:
    "Native React port of the three-page real-estate cockpit — brokerage executive view, agent frontline app, and vacation-rental management.",
};

export default function RealEstateCockpitNativeDemoPage() {
  return <RealEstateDemo />;
}
