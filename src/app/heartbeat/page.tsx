import type { Metadata } from "next";
import { HeartbeatLanding } from "@/components/heartbeat/HeartbeatLanding";

export const metadata: Metadata = {
  title: "OutFront Data — the financial heartbeat your back office never gave you",
  description:
    "A live cash-allocating dashboard. Know what you actually keep, how many days of runway you have, and prove your Profit First set-asides are safe before a dollar moves.",
};

export default function HeartbeatPage() {
  return <HeartbeatLanding />;
}
