import { loadFlightView, type FlightPourView, type FlightView } from "@/lib/spirit-vault/flight-view";

// Standalone, print-ready tasting placemat (US-Letter landscape). Public,
// single-tenant via SPIRIT_VAULT_RESTAURANT_ID, PUBLISHED flights only. Rich per
// pour from the vault dossier; flavor as a bar chart (guests read it without a key).

const TENANT = process.env.SPIRIT_VAULT_RESTAURANT_ID?.trim();
const AXES = ["Sweet", "Oak", "Spice", "Fruit", "Smoke", "Earth", "Herbal"] as const;

function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function money(n: number | null): string {
  if (n == null) return "";
  return "$" + n.toFixed(2).replace(/\.00$/, "");
}

function barRow(label: string, v: number | null, tex = false): string {
  if (v == null) return "";
  const pct = Math.max(0, Math.min(10, v)) * 10;
  return `<div class="row${tex ? " tex" : ""}"><span class="k">${esc(label)}</span><span class="bar"><i style="width:${pct}%"></i></span><span class="num">${v}</span></div>`;
}

function stat(k: string, v: string | null | undefined): string {
  if (!v) return "";
  return `<div class="stat"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`;
}

function prodRow(k: string, v: string | null): string {
  return v ? `<div class="prow"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>` : "";
}

function glass(p: FlightPourView): string {
  const stats = [stat("Strength", p.proof), stat("Age", p.age), stat("Distillery", p.origin)].join("");
  const flavorBars = AXES.map((a) => barRow(a, typeof p.flavor[a] === "number" ? p.flavor[a] : 0)).join("");
  const tex = `${barRow("Body", p.body, true)}${barRow("Finish", p.finish, true)}`;
  const notes = p.topNotes.length ? `<div class="notes"><div class="k-lab">Top notes</div><div class="v">${p.topNotes.map(esc).join(" · ")}</div></div>` : "";
  const taste = p.taste ? `<div class="taste">${esc(p.taste)}</div>` : "";
  const prod =
    p.mash || p.cask
      ? `<div class="prod"><div class="prod-head">Production</div>${prodRow("Mash", p.mash)}${prodRow("Cask", p.cask)}</div>`
      : "";
  return `<div class="glass">
    <div class="ring"><span class="n">${String(p.order).padStart(2, "0")}</span><span class="oz">1 oz</span></div>
    <div class="gname">${esc(p.name)}</div>
    ${p.style ? `<div class="gstyle">${esc(p.style)}</div>` : ""}
    ${stats ? `<div class="stats">${stats}</div>` : ""}
    <div class="chart"><div class="clab"><span>Flavor</span><span>0–10</span></div>${flavorBars}<div class="tex-wrap">${tex}</div></div>
    ${notes}
    ${taste}
    ${prod}
  </div>`;
}

function placematHtml(v: FlightView): string {
  const cols = Math.min(Math.max(v.pours.length, 1), 6);
  const through = v.description
    ? `<div class="through"><div class="l">The through-line</div><p>${esc(v.description)}</p></div>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(v.name)} — placemat</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=DM+Sans:wght@400;500&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
<style>
  :root{--parchment:#F5EFE2;--ink:#2A2418;--ink-soft:#5B513C;--copper:#9A6B2F;--copper-deep:#7A5526;--gold:#C8873A;--gold-light:#D9A35E;--band:#17130C;--band-text:#ECE1CB;--display:'Cormorant Garamond',Georgia,serif;--body:'DM Sans',system-ui,sans-serif;--mono:'Space Mono',ui-monospace,monospace}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:100%}
  body{background:#3a3730;font-family:var(--body);color:var(--ink);padding:24px;-webkit-font-smoothing:antialiased}
  .bar-print{max-width:11in;margin:0 auto 12px;display:flex;justify-content:flex-end}
  .bar-print button{font-family:var(--mono);font-size:12px;letter-spacing:.06em;color:#efe6d2;background:#17130c;border:1px solid #4a3f28;border-radius:6px;padding:8px 14px;cursor:pointer}
  .sheet{width:100%;max-width:11in;height:7.9in;margin:0 auto;background:var(--parchment);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.4)}
  .band{background:var(--band);color:var(--band-text);padding:.3in .5in .28in;position:relative;display:flex;align-items:flex-start;justify-content:space-between;gap:.6in}
  .band::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent)}
  .venue{font-family:var(--mono);font-size:9px;letter-spacing:.34em;text-transform:uppercase;color:var(--gold-light)}
  .fname{font-family:var(--display);font-weight:600;font-size:36px;line-height:1;color:var(--band-text);margin-top:6px}
  .through{margin-top:10px;max-width:7in}
  .through .l{font-family:var(--mono);font-size:8px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold);opacity:.85}
  .through p{font-family:var(--display);font-style:italic;font-size:17px;line-height:1.3;color:#cdbf9f;margin-top:4px}
  .pricebox{text-align:right;flex:none;padding-top:2px}
  .price{font-family:var(--mono);font-weight:700;font-size:30px;color:var(--gold-light);line-height:1}
  .price-sub{font-family:var(--mono);font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:#9c876a;margin-top:6px}
  .flight{flex:1;display:grid;grid-template-columns:repeat(${cols},1fr)}
  .glass{display:flex;flex-direction:column;padding:.22in .22in .18in;border-right:1px solid rgba(122,85,38,.18)}
  .glass:last-child{border-right:0}
  .ring{width:1.6in;height:1.6in;margin:0 auto;border-radius:50%;border:1.8px solid var(--gold);box-shadow:inset 0 0 0 6px var(--parchment),inset 0 0 0 7px rgba(200,135,58,.3);display:flex;align-items:center;justify-content:center;position:relative;flex:none}
  .ring .n{font-family:var(--display);font-size:38px;color:rgba(154,107,47,.34)}
  .ring .oz{position:absolute;bottom:16px;font-family:var(--mono);font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:rgba(122,85,38,.5)}
  .gname{font-family:var(--display);font-weight:600;font-size:23px;line-height:1.02;color:var(--ink);text-align:center;margin-top:11px}
  .gstyle{font-family:var(--display);font-style:italic;font-size:14px;color:var(--copper-deep);text-align:center;margin-top:2px}
  .stats{display:flex;margin-top:.13in;padding:.09in 0;border-top:1px solid rgba(122,85,38,.22);border-bottom:1px solid rgba(122,85,38,.22)}
  .stat{flex:1;text-align:center;border-right:1px solid rgba(122,85,38,.14)}
  .stat:last-child{border-right:0}
  .stat .k{font-family:var(--mono);font-size:6.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--copper)}
  .stat .v{font-family:var(--mono);font-size:11px;color:var(--ink);margin-top:3px}
  .chart{margin-top:.15in}
  .clab{font-family:var(--mono);font-size:7px;letter-spacing:.16em;text-transform:uppercase;color:var(--copper);margin-bottom:5px;display:flex;justify-content:space-between}
  .row{display:flex;align-items:center;gap:7px;margin-bottom:4px}
  .row .k{font-family:var(--mono);font-size:7.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-soft);width:.5in;flex:none}
  .row .bar{flex:1;height:6px;background:rgba(122,85,38,.14);border-radius:3px;overflow:hidden}
  .row .bar i{display:block;height:100%;background:var(--gold)}
  .row.tex .bar i{background:var(--copper-deep)}
  .row .num{font-family:var(--mono);font-size:9px;color:var(--ink-soft);width:12px;text-align:right;flex:none}
  .tex-wrap{margin-top:7px;padding-top:6px;border-top:1px solid rgba(122,85,38,.14)}
  .notes{margin-top:.14in}
  .k-lab{font-family:var(--mono);font-size:7px;letter-spacing:.16em;text-transform:uppercase;color:var(--copper)}
  .notes .v{font-size:12px;color:var(--ink);margin-top:3px;line-height:1.3}
  .taste{margin-top:.1in;font-size:11.5px;color:var(--ink-soft);line-height:1.4}
  .prod{margin-top:auto;padding-top:.12in}
  .prod-head{font-family:var(--mono);font-size:7px;letter-spacing:.2em;text-transform:uppercase;color:var(--copper);border-top:1.5px solid rgba(122,85,38,.4);padding-top:7px;margin-bottom:6px}
  .prow{margin-bottom:6px}
  .prow .k{font-family:var(--mono);font-size:7.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--copper-deep);font-weight:700}
  .prow .v{font-family:var(--display);font-size:14.5px;color:var(--ink);line-height:1.2;margin-top:2px}
  .foot{background:var(--band);height:.32in;display:flex;align-items:center;justify-content:space-between;padding:0 .5in;color:#9c876a}
  .foot .l{font-family:var(--mono);font-size:8px;letter-spacing:.22em;text-transform:uppercase}
  .foot .box{width:16px;height:16px;border:1px solid rgba(216,163,94,.5);border-radius:3px}
  .foot .qr{display:flex;align-items:center;gap:8px}
  @media print{body{background:#fff;padding:0}.bar-print{display:none}.sheet{max-width:none;width:100%;height:7.9in;box-shadow:none}@page{size:11in 8.5in;margin:0.3in}}
</style></head><body>
  <div class="bar-print"><button onclick="window.print()">Print placemat</button></div>
  <div class="sheet">
    <div class="band">
      <div>
        <div class="venue">${esc(v.venueName ?? "Spirit Vault")}</div>
        <div class="fname">${esc(v.name)}</div>
        ${through}
      </div>
      <div class="pricebox"><div class="price">${money(v.totalPriceUsd)}</div><div class="price-sub">${v.pours.length} pours · 1 oz each</div></div>
    </div>
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
