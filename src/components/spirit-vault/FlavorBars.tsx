// Flavor + texture as a labeled bar chart (server-renderable, no client JS).
// Guests read it without a legend — clearer than a radar/web for a placemat/menu.
const AXES = ["Sweet", "Oak", "Spice", "Fruit", "Smoke", "Earth", "Herbal"] as const;

function Bar({ label, value, tex = false }: { label: string; value: number; tex?: boolean }) {
  const pct = Math.max(0, Math.min(10, value)) * 10;
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 font-mono text-[0.6rem] uppercase tracking-wide text-muted">{label}</span>
      <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-line">
        <span className={`block h-full rounded-full ${tex ? "bg-copper-dim" : "bg-copper"}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="w-3 shrink-0 text-right font-mono text-[0.6rem] tabular-nums text-muted">{value}</span>
    </div>
  );
}

export function FlavorBars({
  flavor,
  body,
  finish,
}: {
  flavor: Record<string, number>;
  body?: number | null;
  finish?: number | null;
}) {
  return (
    <div className="space-y-1">
      <p className="mb-1.5 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-copper-dim">Flavor · 0–10</p>
      {AXES.map((a) => (
        <Bar key={a} label={a} value={typeof flavor[a] === "number" ? flavor[a] : 0} />
      ))}
      {(body != null || finish != null) && (
        <div className="mt-2 space-y-1 border-t border-line pt-2">
          {body != null && <Bar label="Body" value={body} tex />}
          {finish != null && <Bar label="Finish" value={finish} tex />}
        </div>
      )}
    </div>
  );
}
