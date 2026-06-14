import { Plug, AlertTriangle, ExternalLink, MessageSquare } from "lucide-react";
import type { AuraData, AuraSourceCard } from "@/lib/modules/aura";
import { count } from "@/lib/format";
import { AuraMeter, FractionalStars } from "./AuraMeter";

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SourceCard({ card }: { card: AuraSourceCard }) {
  if (card.state === "live") {
    return (
      <div className="rounded-lg border border-line bg-surface px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted">{card.label}</span>
          {card.profileUrl && (
            <a href={card.profileUrl} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-copper-soft">
              <ExternalLink size={12} />
            </a>
          )}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="tnum text-2xl text-[#E6E8E4]">{card.rating != null ? card.rating.toFixed(1) : "—"}</span>
          <FractionalStars rating={card.rating} size={13} />
        </div>
        <div className="mt-0.5 text-[11px] text-muted">{count(card.reviewCount)} reviews</div>
      </div>
    );
  }
  if (card.state === "error") {
    return (
      <div className="rounded-lg border border-health-red/40 bg-surface px-4 py-3">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-health-red">
          <AlertTriangle size={12} /> {card.label}
        </span>
        <p className="mt-1 line-clamp-2 text-[11px] text-muted" title={card.detail ?? ""}>
          {card.detail ?? "Fetch failed"}
        </p>
      </div>
    );
  }
  // not_configured
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface/50 px-4 py-3">
      <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
        <Plug size={12} /> {card.label}
      </span>
      <p className="mt-1 text-[11px] text-muted/80">Not connected</p>
      {card.detail && <p className="mt-0.5 font-mono text-[10px] text-muted/70">{card.detail}</p>}
    </div>
  );
}

export function AuraModule({ data }: { data: AuraData }) {
  const liveCount = data.sources.filter((s) => s.state === "live").length;

  return (
    <div className="space-y-6">
      {/* Aura Meter — the headline reputation gauge */}
      <div className="relative rounded-lg border border-line bg-surface px-4 py-5">
        <div className="flex items-start justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted">Overall reputation</span>
          <span className="text-[11px] text-muted">
            {data.configuredCount}/{data.totalSources} sources connected
          </span>
        </div>
        <div className="mt-2">
          <AuraMeter
            rating={data.overallRating}
            health={data.health}
            totalReviews={data.totalReviews}
            liveCount={liveCount}
          />
        </div>
      </div>

      {/* Connect prompt when nothing is wired */}
      {data.configuredCount === 0 && (
        <div className="rounded-lg border border-dashed border-line p-6 text-center">
          <p className="text-sm text-[#E6E8E4]">No review sources connected yet.</p>
          <p className="mx-auto mt-1 max-w-md text-[11px] leading-relaxed text-muted">
            Aura is wired and waiting — set a source&apos;s API keys in the environment and it appears here
            automatically. The cards below list exactly which variables each source needs.
          </p>
        </div>
      )}

      {/* Per-source cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {data.sources.map((card) => (
          <SourceCard key={card.source} card={card} />
        ))}
      </div>

      {/* Recent reviews feed */}
      {data.recent.length > 0 && (
        <div className="rounded-lg border border-line bg-surface p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted">
            <MessageSquare size={12} /> Recent reviews
          </h2>
          <div className="space-y-3">
            {data.recent.map((r, i) => (
              <div key={`${r.source}-${i}`} className="border-b border-line/60 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[11px] text-muted">
                    <span className="text-[#E6E8E4]">{r.author}</span>
                    <span className="rounded-full border border-line px-1.5 py-px text-[10px] capitalize">{r.source}</span>
                  </span>
                  <span className="flex items-center gap-2 text-[11px] text-muted">
                    <FractionalStars rating={r.rating} size={12} />
                    {fmtDate(r.createdAt)}
                  </span>
                </div>
                {r.text && (
                  <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-muted">
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:text-copper-soft">
                        {r.text}
                      </a>
                    ) : (
                      r.text
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Honest footnote */}
      <p className="text-[11px] leading-relaxed text-muted">
        Overall rating is weighted by each source&apos;s review count, so a 4.6 on 800 Google reviews outweighs a
        4.0 on 30 Yelp reviews. Sources cache hourly. Instagram is engagement, not ratings, so the social signal
        here is Facebook recommendations (a positive/negative recommendation maps to 5/1 stars); IG engagement is
        a later add.
      </p>
    </div>
  );
}
