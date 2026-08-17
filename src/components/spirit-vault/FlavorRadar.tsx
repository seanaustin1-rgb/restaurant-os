// Pure server-renderable flavor radar (7-axis). No client JS.
const AXES = ["Sweet", "Oak", "Spice", "Fruit", "Smoke", "Earth", "Herbal"] as const;

export function FlavorRadar({
  flavor,
  size = 88,
  stroke = "#D9A35E",
  fill = "rgba(200,135,58,0.22)",
  grid = "rgba(216,163,94,0.18)",
}: {
  flavor: Record<string, number>;
  size?: number;
  stroke?: string;
  fill?: string;
  grid?: string;
}) {
  const c = size / 2;
  const R = size / 2 - 6;
  const n = AXES.length;
  const pt = (i: number, r: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [c + Math.cos(a) * r, c + Math.sin(a) * r];
  };
  const ringPts = (g: number) => AXES.map((_, i) => pt(i, R * g).map((v) => v.toFixed(1)).join(",")).join(" ");
  const poly = AXES.map((ax, i) => pt(i, R * ((flavor[ax] || 0) / 10)).map((v) => v.toFixed(1)).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Flavor profile">
      {[0.5, 1].map((g) => (
        <polygon key={g} points={ringPts(g)} fill="none" stroke={grid} strokeWidth={0.7} />
      ))}
      {AXES.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={c} y1={c} x2={x.toFixed(1)} y2={y.toFixed(1)} stroke={grid} strokeWidth={0.5} />;
      })}
      <polygon points={poly} fill={fill} stroke={stroke} strokeWidth={1.3} strokeLinejoin="round" />
    </svg>
  );
}
