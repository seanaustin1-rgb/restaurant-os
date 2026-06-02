import { MetricCard } from "./MetricCard";
import { money, money2 } from "@/lib/format";

export interface RevenueData {
  revenueMTD: number;
  realRevenueMTD: number;
  checkAverage: number;
  revPASH: number;
}

export function RevenueRow({ data }: { data: RevenueData }) {
  return (
    <section>
      <h2 className="mb-2 font-display text-lg text-copper-soft">Revenue</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Revenue MTD" value={money(data.revenueMTD)} sub="total sales" />
        <MetricCard label="Real Revenue MTD" value={money(data.realRevenueMTD)} sub="sales − COGS" />
        <MetricCard label="Check Average" value={money2(data.checkAverage)} sub="per check" />
        <MetricCard label="RevPASH" value={money2(data.revPASH)} sub="per seat-hour" />
      </div>
    </section>
  );
}
