import { loadFlightView, type FlightPourView, type FlightView } from "@/lib/spirit-vault/flight-view";

// Standalone, print-ready tasting placemat (US-Letter landscape). Public,
// single-tenant via SPIRIT_VAULT_RESTAURANT_ID, PUBLISHED flights only. Its own
// HTML document — no app chrome. Rich per pour from the vault dossier.

const TENANT = process.env.SPIRIT_VAULT_RESTAURANT_ID?.trim();
const AXES = ["Sweet", "Oak", "Spice", "Fruit", "Smoke", "Earth", "Herbal"] as const;

function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function money(n: number | null): string {
  if (n == null) return "";
  return "$" + n.toFixed(2).replace(/\.00$/, "");
}

function radarSvg(flavor: Record<string, number>): string {
  const size = 88, c = size / 2, R = size / 2 - 7, n = AXES.length;
  const pt = (i: number, r: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [c + Math.cos(a) * r, c + Math.sin(a) * r];
  };
  const ring = (g: number) => AXES.map((_, i) => pt(i, R * g).map((v) => v.toFixed(1)).join(",")).join(" ");
  const grid = [0.5, 1].map((g) => `<polygon points="${ring(g)}" fill="none" stroke="rgba(122,85,38,.22)" stroke-width="0.6"/>`).join("");
  const spokes = AXES.map((_, i) => {
    const [x, y] = pt(i, R);
    return `<line x1="${c}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(122,85,38,.16)" stroke-width="0.5"/>`;
  }).join("");
  const poly = AXES.map((ax, i) => pt(i, R * ((flavor[ax] || 0) / 10)).map((v) => v.toFixed(1)).join(",")).join(" ");
  return `<svg class="radar" viewBox="0 0 ${size} ${size}" aria-hidden="true">${grid}${spokes}<polygon points="${poly}" fill="rgba(200,135,58,.28)" stroke="#9A6B2F" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
}

function bfRow(label: string, v: number | null): string {
  if (v == null) return "";
  const pct = Math.max(0, Math.min(10, v)) * 10;
  return `<div class="bfrow"><span class="k">${label}</span><span class="bar"><i style="width:${pct}%"></i></span><span class="num">${v}</span></div>`;
}

function stat(k: string, v: string | null | undefined): string {
  if (!v) return "";
  return `<div class="stat"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`;
}

function prodRow(k: string, v: string | null): string {
  return v ? `<div class="row"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>` : "";
}

function glass(p: FlightPourView): string {
  const stats = [stat("Strength", p.proof), stat("Age", p.age), stat("Distillery", p.origin)].join("");
  const notes = p.topNotes.length ? `<div class="notes"><div class="k-lab">Top notes</div><div class="v">${p.topNotes.map(esc).join(" · ")}</div></div>` : "";
  const taste = p.taste ? `<div class="taste">${esc(p.taste)}</div>` : "";
  const bf = `<div class="bf">${bfRow("Body", p.body)}${bfRow("Finish", p.finish)}</div>`;
  const prod = p.mash || p.cask ? `<div class="prod">${prodRow("Mash", p.mash)}${prodRow("Cask", p.cask)}</div>` : "";
  return `<div class="glass">
    <div class="ring"><span class="n">${String(p.order).padStart(2, "0")}</span><span class="oz">1 oz</span></div>
    <div class="gname">${esc(p.name)}</div>
    ${p.style ? `<div class="gstyle">${esc(p.style)}</div>` : ""}
    ${stats ? `<div class="stats">${stats}</div>` : ""}
    ${radarSvg(p.flavor)}
    ${bf}
    ${notes}
    ${taste}
    ${prod}
  </div>`;
}

function placematHtml(v: FlightView): string {
  const cols = Math.min(Math.max(v.pours.length, 1), 6);
  const narrative = v.description
    ? `<div class="narrative"><div class="lab">The through-line</div><p>${esc(v.description)}</p></div>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(v.name)} — placemat</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=DM+Sans:wght@400;500&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
<style>
  :root{--parchment:#F5EFE2;--ink:#2A2418;--ink-soft:#5B513C;--copper:#9A6B2F;--copper-deep:#7A5526;--gold:#C8873A;--gold-light:#D9A35E;--band:#17130C;--band-text:#ECE1CB;--display:'Cormorant Garamond',Georgia,serif;--body:'DM Sans',system-ui,sans-serif;--mono:'Space Mono',ui-monospace,monospace}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#3a3730;font-family:var(--body);color:var(--ink);padding:24px;-webkit-font-smoothing:antialiased}
  .bar{max-width:11in;margin:0 auto 12px;display:flex;justify-content:flex-end}
  .bar button{font-family:var(--mono);font-size:12px;letter-spacing:.06em;color:#efe6d2;background:#17130c;border:1px solid #4a3f28;border-radius:6px;padding:8px 14px;cursor:pointer}
  .sheet{width:11in;height:8.5in;margin:0 auto;background:var(--parchment);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.4)}
  .band{background:var(--band);color:var(--band-text);padding:.3in .55in .26in;position:relative;display:flex;align-items:flex-end;justify-content:space-between;gap:.5in}
  .band::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent)}
  .venue{font-family:var(--mono);font-size:8px;letter-spacing:.34em;text-transform:uppercase;color:var(--gold-light)}
  .fname{font-family:var(--display);font-weight:600;font-size:28px;line-height:1;color:var(--band-text);margin-top:5px}
  .price{font-family:var(--mono);font-weight:700;font-size:25px;color:var(--gold-light);line-height:1;text-align:right}
  .price-sub{font-family:var(--mono);font-size:7.5px;letter-spacing:.16em;text-transform:uppercase;color:#9c876a;margin-top:4px;text-align:right}
  .narrative{padding:.13in .55in .1in;display:grid;grid-template-columns:.9in 1fr;gap:.26in;align-items:start}
  .narrative .lab{font-family:var(--mono);font-size:7.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--copper);padding-top:3px}
  .narrative p{font-family:var(--display);font-size:14px;line-height:1.28;color:var(--ink)}
  .flight{flex:1;display:grid;grid-template-columns:repeat(${cols},1fr)}
  .glass{display:flex;flex-direction:column;padding:.16in .2in .14in;border-right:1px solid rgba(122,85,38,.18)}
  .glass:last-child{border-right:0}
  .ring{width:1.4in;height:1.4in;margin:0 auto;border-radius:50%;border:1.6px solid var(--gold);box-shadow:inset 0 0 0 5px var(--parchment),inset 0 0 0 6px rgba(200,135,58,.3);display:flex;align-items:center;justify-content:center;position:relative;flex:none}
  .ring .n{font-family:var(--display);font-size:30px;color:rgba(154,107,47,.34)}
  .ring .oz{position:absolute;bottom:13px;font-family:var(--mono);font-size:7px;letter-spacing:.18em;text-transform:uppercase;color:rgba(122,85,38,.5)}
  .gname{font-family:var(--display);font-weight:600;font-size:19px;line-height:1.02;color:var(--ink);text-align:center;margin-top:9px}
  .gstyle{font-family:var(--display);font-style:italic;font-size:12px;color:var(--copper-deep);text-align:center;margin-top:1px;line-height:1.15}
  .stats{display:flex;margin-top:.11in;padding:.08in 0;border-top:1px solid rgba(122,85,38,.22);border-bottom:1px solid rgba(122,85,38,.22)}
  .stat{flex:1;text-align:center;border-right:1px solid rgba(122,85,38,.14)}
  .stat:last-child{border-right:0}
  .stat .k{font-family:var(--mono);font-size:5.6px;letter-spacing:.13em;text-transform:uppercase;color:var(--copper)}
  .stat .v{font-family:var(--mono);font-size:9.5px;color:var(--ink);margin-top:2px}
  .radar{width:88px;height:88px;display:block;margin:.12in auto .04in}
  .bf{margin-top:.02in}
  .bfrow{display:flex;align-items:center;gap:7px;margin-bottom:5px}
  .bfrow .k{font-family:var(--mono);font-size:6.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--copper);width:.42in;flex:none}
  .bar2{}
  .bfrow .bar{flex:1;height:5px;border-radius:3px;background:rgba(122,85,38,.16);overflow:hidden}
  .bfrow .bar i{display:block;height:100%;background:var(--gold)}
  .bfrow .num{font-family:var(--mono);font-size:8px;color:var(--ink-soft);width:12px;text-align:right;flex:none}
  .notes{margin-top:.12in}
  .k-lab{font-family:var(--mono);font-size:6px;letter-spacing:.16em;text-transform:uppercase;color:var(--copper)}
  .notes .v{font-size:10.5px;color:var(--ink);margin-top:2px;line-height:1.3}
  .taste{margin-top:.1in;font-size:10.5px;color:var(--ink-soft);line-height:1.4}
  .prod{margin-top:auto;padding-top:.1in}
  .prod .row{display:flex;gap:6px;font-size:9px;line-height:1.3;margin-top:3px}
  .prod .k{font-family:var(--mono);font-size:5.6px;letter-spacing:.1em;text-transform:uppercase;color:var(--copper);flex:none;width:.42in;padding-top:1px}
  .prod .v{color:var(--ink-soft)}
  .foot{background:var(--band);height:.3in;display:flex;align-items:center;justify-content:space-between;padding:0 .55in;color:#9c876a}
  .foot .l{font-family:var(--mono);font-size:7px;letter-spacing:.22em;text-transform:uppercase}
  .foot .box{width:14px;height:14px;border:1px solid rgba(216,163,94,.5);border-radius:3px}
  .foot .qr{display:flex;align-items:center;gap:7px}
  @media print{body{background:none;padding:0}.bar{display:none}.sheet{box-shadow:none}@page{size:letter landscape;margin:0}}
</style></head><body>
  <div class="bar"><button onclick="window.print()">Print placemat</button></div>
  <div class="sheet">
    <div class="band">
      <div><div class="venue">${esc(v.venueName ?? "Spirit Vault")}</div><div class="fname">${esc(v.name)}</div></div>
      <div><div class="price">${money(v.totalPriceUsd)}</div><div class="price-sub">${v.pours.length} pours · 1 oz each</div></div>
    </div>
    ${narrative}
    <div class="flight">${v.pours.map(glass).join("")}</div>
    <div class="foot"><span class="l">${esc(v.venueName ?? "Spirit Vault")}</span><span class="qr"><span class="l">Scan for the full dossier</span><span class="box"></span></span></div>
  </div>
</body></html>`;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!TENANT) return new Response("Spirit Vault is not configured", { status: 503 });
  const view = await loadFlightView(TENANT, params.id, { publishedOnly: true });
  if (!view) return new Response("Flight not found", { status: 404 });
  return new Response(placematHtml(view), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
