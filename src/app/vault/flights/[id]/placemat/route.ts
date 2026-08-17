import { loadFlightView, type FlightPourView, type FlightView } from "@/lib/spirit-vault/flight-view";

// Standalone, print-ready tasting placemat (US-Letter landscape). Public,
// single-tenant via SPIRIT_VAULT_RESTAURANT_ID, PUBLISHED flights only. Rendered
// as its own HTML document so it carries no app chrome.

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
  const size = 74, c = size / 2, R = size / 2 - 6, n = AXES.length;
  const pt = (i: number, r: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [c + Math.cos(a) * r, c + Math.sin(a) * r];
  };
  const ring = (g: number) => AXES.map((_, i) => pt(i, R * g).map((v) => v.toFixed(1)).join(",")).join(" ");
  const grid = [0.5, 1]
    .map((g) => `<polygon points="${ring(g)}" fill="none" stroke="rgba(122,85,38,.22)" stroke-width="0.6"/>`)
    .join("");
  const spokes = AXES.map((_, i) => {
    const [x, y] = pt(i, R);
    return `<line x1="${c}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(122,85,38,.16)" stroke-width="0.5"/>`;
  }).join("");
  const poly = AXES.map((ax, i) => pt(i, R * ((flavor[ax] || 0) / 10)).map((v) => v.toFixed(1)).join(",")).join(" ");
  return `<svg class="radar" viewBox="0 0 ${size} ${size}" aria-hidden="true">${grid}${spokes}<polygon points="${poly}" fill="rgba(200,135,58,.28)" stroke="#9A6B2F" stroke-width="1.1" stroke-linejoin="round"/></svg>`;
}

function glass(p: FlightPourView): string {
  const meta = [p.category, p.proof, p.age].filter(Boolean).join(" · ");
  const notes = p.topNotes
    .map((t, i) => `<li><span>${String(i + 1).padStart(2, "0")}</span>${esc(t)}</li>`)
    .join("");
  const taste = p.taste ? `<div class="taste"><span class="lab">Tasting</span><p>${esc(p.taste)}</p></div>` : "";
  return `<div class="glass">
    <div class="ring"><span class="n">${String(p.order).padStart(2, "0")}</span><span class="oz">1 oz</span></div>
    <div class="gname">${esc(p.name)}</div>
    <div class="gcat">${esc(meta)}</div>
    <div class="mid">${radarSvg(p.flavor)}<div class="tn"><div class="lab">Top notes</div><ol>${notes}</ol></div></div>
    ${taste}
  </div>`;
}

function placematHtml(v: FlightView): string {
  const cols = Math.min(Math.max(v.pours.length, 1), 6);
  const narrative = v.description
    ? `<div class="narrative"><div class="lab">The through-line</div><p>${esc(v.description)}</p></div><div class="divider"></div>`
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
  .band{background:var(--band);color:var(--band-text);padding:.34in .55in .3in;position:relative;display:flex;align-items:flex-end;justify-content:space-between;gap:.5in}
  .band::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent)}
  .venue{font-family:var(--mono);font-size:8.5px;letter-spacing:.34em;text-transform:uppercase;color:var(--gold-light)}
  .fname{font-family:var(--display);font-weight:600;font-size:30px;line-height:1;color:var(--band-text);margin-top:6px}
  .price{font-family:var(--mono);font-weight:700;font-size:27px;color:var(--gold-light);line-height:1;text-align:right}
  .price-sub{font-family:var(--mono);font-size:8px;letter-spacing:.16em;text-transform:uppercase;color:#9c876a;margin-top:5px;text-align:right}
  .narrative{padding:.2in .55in .1in;display:grid;grid-template-columns:1.1in 1fr;gap:.3in;align-items:start}
  .narrative .lab{font-family:var(--mono);font-size:8px;letter-spacing:.2em;text-transform:uppercase;color:var(--copper);padding-top:4px}
  .narrative p{font-family:var(--display);font-size:16px;line-height:1.34;color:var(--ink);max-width:8.6in}
  .divider{height:1px;margin:.02in .55in 0;background:linear-gradient(90deg,transparent,rgba(122,85,38,.35),transparent)}
  .flight{flex:1;display:grid;grid-template-columns:repeat(${cols},1fr)}
  .glass{display:flex;flex-direction:column;align-items:center;text-align:center;padding:.24in .2in .16in;border-right:1px solid rgba(122,85,38,.16)}
  .glass:last-child{border-right:0}
  .ring{width:1.2in;height:1.2in;border-radius:50%;border:1.5px solid var(--gold);box-shadow:inset 0 0 0 4px var(--parchment),inset 0 0 0 5px rgba(200,135,58,.28);display:flex;align-items:center;justify-content:center;position:relative;flex:none}
  .ring .n{font-family:var(--display);font-size:23px;color:rgba(154,107,47,.3)}
  .ring .oz{position:absolute;bottom:9px;font-family:var(--mono);font-size:7px;letter-spacing:.2em;text-transform:uppercase;color:rgba(122,85,38,.5)}
  .gname{font-family:var(--display);font-weight:600;font-size:17px;line-height:1.05;color:var(--ink);margin-top:10px}
  .gcat{font-family:var(--mono);font-size:7px;letter-spacing:.12em;text-transform:uppercase;color:var(--copper-deep);margin-top:5px}
  .mid{display:flex;align-items:center;gap:8px;margin-top:9px;justify-content:center}
  .radar{width:66px;height:66px;flex:none}
  .tn{text-align:left}
  .tn .lab{font-family:var(--mono);font-size:6px;letter-spacing:.16em;text-transform:uppercase;color:var(--copper);margin-bottom:2px}
  .tn ol{list-style:none;font-size:10px;color:var(--ink);line-height:1.45}
  .tn li span{color:rgba(122,85,38,.55);font-family:var(--mono);font-size:7px;margin-right:4px}
  .taste{margin-top:10px;padding-top:8px;border-top:1px solid rgba(122,85,38,.2);width:100%}
  .taste .lab{font-family:var(--mono);font-size:6px;letter-spacing:.18em;text-transform:uppercase;color:var(--copper);display:block;margin-bottom:3px}
  .taste p{font-size:10px;color:var(--ink-soft);line-height:1.4}
  .foot{background:var(--band);height:.34in;display:flex;align-items:center;justify-content:space-between;padding:0 .55in;color:#9c876a}
  .foot .l{font-family:var(--mono);font-size:7.5px;letter-spacing:.22em;text-transform:uppercase}
  .foot .box{width:15px;height:15px;border:1px solid rgba(216,163,94,.5);border-radius:3px}
  .foot .qr{display:flex;align-items:center;gap:7px}
  @media print{body{background:none;padding:0}.bar{display:none}.sheet{box-shadow:none}@page{size:letter landscape;margin:0}}
</style></head><body>
  <div class="bar"><button onclick="window.print()">Print placemat</button></div>
  <div class="sheet">
    <div class="band">
      <div>
        <div class="venue">${esc(v.venueName ?? "Spirit Vault")}</div>
        <div class="fname">${esc(v.name)}</div>
      </div>
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
