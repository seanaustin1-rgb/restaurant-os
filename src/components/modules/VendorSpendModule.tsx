import type { VendorSpendData } from "@/lib/modules/vendor-spend";
import { money, pct } from "@/lib/format";

// Server component — static read-only view, no client interactivity needed.
export function VendorSpendModule({ data }: { data: VendorSpendData }) {
  if (!data.hasData) {
    return (
      <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
        No spend in this period yet. Import a statement or connect a bank to see vendor spend.
      </div>
    );
  }

  const max = data.vendors[0]?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="text-[11px] uppercase tracking-wider text-muted">Total Spend</span>
          <div className="tnum mt-1 text-2xl text-[#E6E8E4]">{money(data.totalSpend)}</div>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="text-[11px] uppercase tracking-wider text-muted">Vendors</span>
          <div className="tnum mt-1 text-2xl text-[#E6E8E4]">{data.vendorCount}</div>
        </div>
      </div>

      {/* Vendor list — table on desktop, cards on phone/tablet */}
      <div className="overflow-hidden rounded-lg border border-line">
        <table className="hidden w-full text-sm sm:table">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-4 py-2 font-medium">Vendor</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 text-right font-medium">Txns</th>
              <th className="px-4 py-2 text-right font-medium">Spend</th>
              <th className="px-4 py-2 text-right font-medium">Share</th>
            </tr>
          </thead>
          <tbody>
            {data.vendors.map((v) => (
              <tr key={v.vendor} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-2">
                  <div className="font-mono text-xs text-[#E6E8E4]">{v.vendor}</div>
                  <div className="mt-1 h-1 w-28 overflow-hidden rounded-full bg-ink">
                    <div className="h-full rounded-full bg-copper" style={{ width: `${max > 0 ? (v.total / max) * 100 : 0}%` }} />
                  </div>
                </td>
                <td className="px-4 py-2 text-xs text-muted">{v.categoryName ?? "—"}</td>
                <td className="tnum px-4 py-2 text-right text-muted">{v.count}</td>
                <td className="tnum px-4 py-2 text-right text-[#E6E8E4]">{money(v.total)}</td>
                <td className="tnum px-4 py-2 text-right text-muted">{pct(v.share, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="divide-y divide-line/60 sm:hidden">
          {data.vendors.map((v) => (
            <div key={v.vendor} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 flex-1 break-words font-mono text-xs text-[#E6E8E4]">{v.vendor}</span>
                <span className="tnum shrink-0 text-[#E6E8E4]">{money(v.total)}</span>
              </div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-ink">
                <div className="h-full rounded-full bg-copper" style={{ width: `${max > 0 ? (v.total / max) * 100 : 0}%` }} />
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-xs text-muted">
                <span>{v.categoryName ?? "—"}</span>
                <span className="tnum ml-auto">{v.count} txns · {pct(v.share, 0)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
