import { Star } from "lucide-react";
import type { HealthStatus } from "@/lib/profit-first/calculator";

// The Aura Meter — a banded semicircular reputation gauge. Reputation is a
// "higher is better" lens on a 1–5 scale (the floor on every review platform is
// 1, so the dial runs 1→5, giving the meaningful 4.0–5.0 region real room
// instead of wasting half the arc on impossible territory). The colored zones
// mirror bandRating() in @/lib/modules/aura exactly: <4.0 at risk, 4.0–4.5
// watch, ≥4.5 strong. The needle lands where the count-weighted overall rating
// sits, in its band's color.

// Hex mirrors tailwind.config health.* (SVG strokes need literal colors).
const HEALTH_HEX: Record<HealthStatus, string> = {
  green: "#5FA777",
  yellow: "#D9A35E",
  red: "#C8643A",
};
const TRACK_HEX = "#232623"; // line
const MUTED_HEX = "#8A8F89"; // muted

// Geometry. Upper semicircle, center (CX,CY), radius R. Angle is measured
// counter-clockwise from the +x axis with y flipped for screen space, so 180°
// is the left end (value 1), 0° the right end (value 5), 90° the top (value 3).
const CX = 110;
const CY = 110;
const R = 86;
const STROKE = 13;

function pt(deg: number, r = R) {
  const a = (deg * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Map a 1–5 rating onto the arc: 1→180°, 5→0° (45° per star). */
function angleFor(v: number) {
  return 180 - 45 * (clamp(v, 1, 5) - 1);
}

/** Minor arc from `fromDeg` to `toDeg` over the top (clockwise on screen). */
function arc(fromDeg: number, toDeg: number, r = R) {
  const a = pt(fromDeg, r);
  const b = pt(toDeg, r);
  const large = Math.abs(fromDeg - toDeg) > 180 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

// Band zones, in rating space — must stay in lockstep with bandRating().
const BANDS: { from: number; to: number; band: HealthStatus }[] = [
  { from: 1.0, to: 4.0, band: "red" },
  { from: 4.0, to: 4.5, band: "yellow" },
  { from: 4.5, to: 5.0, band: "green" },
];

/** Five outline stars with a clipped filled overlay — renders fractional ratings honestly. */
export function FractionalStars({ rating, size = 14 }: { rating: number | null; size?: number }) {
  if (rating == null) return <span className="text-muted">—</span>;
  const fill = `${clamp((rating / 5) * 100, 0, 100)}%`;
  const row = (filled: boolean) =>
    [1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        size={size}
        className={filled ? "shrink-0 fill-copper-soft text-copper-soft" : "shrink-0 text-line"}
      />
    ));
  return (
    <span
      className="relative inline-flex"
      title={`${rating.toFixed(2)} of 5`}
      aria-label={`${rating.toFixed(2)} out of 5 stars`}
    >
      <span className="inline-flex gap-0.5">{row(false)}</span>
      <span className="absolute inset-0 inline-flex gap-0.5 overflow-hidden" style={{ width: fill }}>
        {row(true)}
      </span>
    </span>
  );
}

export function AuraMeter({
  rating,
  health,
  totalReviews,
  liveCount,
}: {
  rating: number | null;
  health: HealthStatus;
  totalReviews: number;
  liveCount: number;
}) {
  const hex = HEALTH_HEX[health];
  const tip = pt(angleFor(rating ?? 1), R - 4);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 220 126" className="w-full max-w-[300px]" role="img" aria-label="Reputation meter">
        {/* Band track — the active band is solid, the rest dimmed, so you see
            where you sit and what "good" looks like at a glance. */}
        {BANDS.map((b) => {
          const active = rating != null && rating >= b.from && (rating < b.to || (b.to === 5 && rating <= 5));
          return (
            <path
              key={b.band}
              d={arc(angleFor(b.from), angleFor(b.to))}
              stroke={rating == null ? TRACK_HEX : HEALTH_HEX[b.band]}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              opacity={rating == null ? 1 : active ? 1 : 0.22}
            />
          );
        })}

        {/* Integer tick labels just outside the arc. */}
        {[1, 2, 3, 4, 5].map((v) => {
          const p = pt(angleFor(v), R + 14);
          return (
            <text
              key={v}
              x={p.x}
              y={p.y + 3}
              textAnchor="middle"
              fontSize="9"
              fill={MUTED_HEX}
              className="tnum"
            >
              {v}
            </text>
          );
        })}

        {/* Needle + hub, in the active band's color. Hidden until a rating exists. */}
        {rating != null && (
          <>
            <line x1={CX} y1={CY} x2={tip.x} y2={tip.y} stroke={hex} strokeWidth={3} strokeLinecap="round" />
            <circle cx={CX} cy={CY} r={5} fill={hex} />
            <circle cx={CX} cy={CY} r={5} fill="none" stroke={TRACK_HEX} strokeWidth={1.5} />
          </>
        )}

        {/* Center readout. */}
        <text
          x={CX}
          y={CY - 22}
          textAnchor="middle"
          fontSize="30"
          fontWeight={600}
          fill={rating == null ? MUTED_HEX : hex}
          className="tnum"
        >
          {rating != null ? rating.toFixed(2) : "—"}
        </text>
        <text x={CX} y={CY - 8} textAnchor="middle" fontSize="9" fill={MUTED_HEX}>
          {rating != null ? "out of 5" : "no ratings yet"}
        </text>
      </svg>

      <div className="-mt-1">
        <FractionalStars rating={rating} size={18} />
      </div>
      <p className="mt-2 text-[11px] text-muted">
        {totalReviews.toLocaleString("en-US")} review{totalReviews === 1 ? "" : "s"} across {liveCount} connected
        source{liveCount === 1 ? "" : "s"}
        {rating != null ? " · count-weighted" : ""}
      </p>
      <p className="mt-0.5 text-[10px] text-muted/70">
        <span className="text-health-green">≥4.5 strong</span> ·{" "}
        <span className="text-health-yellow">4.0–4.5 watch</span> ·{" "}
        <span className="text-health-red">&lt;4.0 at risk</span>
      </p>
    </div>
  );
}
