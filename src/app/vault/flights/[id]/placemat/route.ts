import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { SPIRIT_VAULT_STAFF_ROLES } from "@/lib/access/roles";
import { loadFlightView, type FlightPourView, type FlightView } from "@/lib/spirit-vault/flight-view";
import { dayGateEnabled, qrTargetUrl, todayCode } from "@/lib/spirit-vault/day-code";
import { qrSvg } from "@/lib/spirit-vault/qr";

// Standalone, print-ready tasting placemat — Legal (8.5x14) landscape. STAFF ONLY:
// this print artifact renders today's vault code + a QR containing it, so it must
// never be publicly fetchable (that would leak the day's access code and defeat the
// physical-presence gate). Guests use the digital flight page, not this route. Rich
// per pour from the vault dossier; flavor as a bar chart. The @page margins are
// asymmetric to compensate for the venue printer's offset (measured: shifts content
// ~3/16in left, ~1/8in down at Actual Size) so it prints centered with the bottom
// Production line clear of the clip zone.
// TODO(multi-venue): move the printer-offset margins to a per-venue setting.
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
  const notice = p.itemNote ? `<div class="notice"><div class="k-lab">What to notice</div><div class="v">${esc(p.itemNote)}</div></div>` : "";
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
    ${notice}
    ${prod}
  </div>`;
}

function placematHtml(v: FlightView, qr: { svg: string; code: string | null }): string {
  const cols = Math.min(Math.max(v.pours.length, 1), 6);
  const through = v.description
    ? `<div class="through"><span class="l">The through-line</span><p>${esc(v.description)}</p></div>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(v.name)} — placemat</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=DM+Sans:wght@400;500&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
<style>
  :root{--parchment:#F5EFE2;--ink:#2A2418;--ink-soft:#5B513C;--copper:#9A6B2F;--copper-deep:#7A5526;--gold:#C8873A;--gold-light:#D9A35E;--band:#17130C;--band-text:#ECE1CB;--display:'Cormorant Garamond',Georgia,serif;--body:'DM Sans',system-ui,sans-serif;--mono:'Space Mono',ui-monospace,monospace}
  *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  html,body{width:100%}
  body{background:#3a3730;font-family:var(--body);color:var(--ink);padding:24px}
  .bar-print{max-width:14in;margin:0 auto 12px;display:flex;justify-content:flex-end}
  .bar-print button{font-family:var(--mono);font-size:12px;letter-spacing:.06em;color:#efe6d2;background:#17130c;border:1px solid #4a3f28;border-radius:6px;padding:8px 14px;cursor:pointer}
  .sheet{width:100%;max-width:14in;height:7.5in;margin:0 auto;background:var(--parchment);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.4)}
  /* Fixed-height band so the header can never steal column height, no matter how
     long the name/through-line/QR payload is. The left stack (venue → name →
     through-line) and the right stack (price → QR) are each bounded and clipped. */
  .band{background:var(--band);color:var(--band-text);padding:.12in .5in;height:1.08in;position:relative;display:flex;align-items:flex-start;justify-content:space-between;gap:.4in;overflow:hidden}
  .band::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent)}
  .head-l{min-width:0;flex:1}
  .venue{font-family:var(--mono);font-size:8px;letter-spacing:.32em;text-transform:uppercase;color:var(--gold-light)}
  .fname{font-family:var(--display);font-weight:600;font-size:28px;line-height:1.02;color:var(--band-text);margin-top:2px;-webkit-line-clamp:1;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
  .through{margin-top:4px}
  .through .l{font-family:var(--mono);font-size:6.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);opacity:.85}
  .through p{font-family:var(--display);font-style:italic;font-size:12px;line-height:1.2;color:#cdbf9f;margin-top:2px;-webkit-line-clamp:2;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
  .pricebox{display:flex;flex-direction:column;align-items:flex-end;gap:.07in;flex:none}
  .pricestack{text-align:right}
  .price{font-family:var(--mono);font-weight:700;font-size:26px;color:var(--gold-light);line-height:1}
  .qrrow{display:flex;align-items:center;gap:8px}
  .qrmeta{text-align:right;max-width:.95in}
  .qrcap{font-family:var(--mono);font-size:6.5px;letter-spacing:.08em;text-transform:uppercase;color:#9c876a;line-height:1.25}
  .qrcode{font-family:var(--mono);font-weight:700;font-size:12px;letter-spacing:.14em;color:var(--gold-light);margin-top:2px}
  .qrbox{width:.5in;height:.5in;background:#fff;border-radius:5px;padding:3px;flex:none}
  .qrbox svg{width:100%;height:100%;display:block;shape-rendering:crispEdges}
  .flight{flex:1;display:grid;grid-template-columns:repeat(${cols},1fr);min-height:0}
  .glass{display:flex;flex-direction:column;padding:.18in .34in .14in;border-right:1px solid rgba(122,85,38,.18);min-height:0}
  .glass:last-child{border-right:0}
  .ring{width:1.6in;height:1.6in;margin:0 auto;border-radius:50%;border:1.8px solid var(--gold);box-shadow:inset 0 0 0 6px var(--parchment),inset 0 0 0 7px rgba(200,135,58,.3);display:flex;align-items:center;justify-content:center;position:relative;flex:none}
  .ring .n{font-family:var(--display);font-size:40px;color:rgba(154,107,47,.34)}
  .ring .oz{position:absolute;bottom:15px;font-family:var(--mono);font-size:7.5px;letter-spacing:.18em;text-transform:uppercase;color:rgba(122,85,38,.5)}
  .clamp{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
  .gname{font-family:var(--display);font-weight:600;font-size:22px;line-height:1.05;color:var(--ink);text-align:center;margin-top:8px;-webkit-line-clamp:2;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
  .gstyle{font-family:var(--display);font-style:italic;font-size:13.5px;line-height:1.2;color:var(--copper-deep);text-align:center;margin-top:1px;-webkit-line-clamp:2;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
  .stats{display:flex;margin-top:.09in;padding:.06in 0;border-top:1px solid rgba(122,85,38,.22);border-bottom:1px solid rgba(122,85,38,.22)}
  .stat{flex:1;text-align:center;border-right:1px solid rgba(122,85,38,.14)}
  .stat:last-child{border-right:0}
  .stat .k{font-family:var(--mono);font-size:6px;letter-spacing:.12em;text-transform:uppercase;color:var(--copper)}
  .stat .v{font-family:var(--mono);font-size:10.5px;line-height:1.15;color:var(--ink);margin-top:2px;-webkit-line-clamp:2;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
  .chart{margin-top:.09in}
  .clab{font-family:var(--mono);font-size:6.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--copper);margin-bottom:3px;display:flex;justify-content:space-between}
  .row{display:flex;align-items:center;gap:7px;margin-bottom:2px}
  .row .k{font-family:var(--mono);font-size:7px;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-soft);width:.48in;flex:none}
  .row .bar{flex:1;height:5px;background:rgba(122,85,38,.14);border-radius:3px;overflow:hidden}
  .row .bar i{display:block;height:100%;background:var(--gold)}
  .row.tex .bar i{background:var(--copper-deep)}
  .row .num{font-family:var(--mono);font-size:8.5px;color:var(--ink-soft);width:11px;text-align:right;flex:none}
  .tex-wrap{margin-top:4px;padding-top:4px;border-top:1px solid rgba(122,85,38,.14)}
  .notes{margin-top:.09in}
  .k-lab{font-family:var(--mono);font-size:6.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--copper)}
  .notes .v{font-size:11.5px;color:var(--ink);margin-top:2px;line-height:1.26}
  .taste{margin-top:.06in;font-size:10.5px;color:var(--ink-soft);line-height:1.3;-webkit-line-clamp:2;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
  .notice{margin-top:.06in}
  .notice .v{font-family:var(--display);font-style:italic;font-size:10.5px;line-height:1.3;color:var(--ink);margin-top:2px;-webkit-line-clamp:2;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
  .prod{margin-top:auto;padding-top:.09in}
  .prod-head{font-family:var(--mono);font-size:6.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--copper);border-top:1.5px solid rgba(122,85,38,.4);padding-top:5px;margin-bottom:4px}
  .prow{margin-bottom:4px}
  .prow .k{font-family:var(--mono);font-size:7px;letter-spacing:.14em;text-transform:uppercase;color:var(--copper-deep);font-weight:700}
  .prow .v{font-family:var(--display);font-size:13.5px;color:var(--ink);line-height:1.16;margin-top:1px;-webkit-line-clamp:2;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
  .foot{background:var(--band);height:.22in;display:flex;align-items:center;justify-content:space-between;padding:0 .5in;color:#9c876a;flex:none}
  .foot .l{font-family:var(--mono);font-size:7.5px;letter-spacing:.22em;text-transform:uppercase}
  @media print{body{background:#fff;padding:0}.bar-print{display:none}.sheet{max-width:none;width:100%;height:7.5in;box-shadow:none}@page{size:14in 8.5in;margin:0.35in 0.11in 0.65in 0.49in}}
</style></head><body>
  <div class="bar-print"><button onclick="window.print()">Print placemat</button></div>
  <div class="sheet">
    <div class="band">
      <div class="head-l">
        <div class="venue">${esc(v.venueName ?? "Spirit Vault")}</div>
        <div class="fname">${esc(v.name)}</div>
        ${through}
      </div>
      <div class="pricebox">
        <div class="pricestack"><div class="price">${money(v.totalPriceUsd)}</div></div>
        <div class="qrrow">
          <div class="qrmeta"><div class="qrcap">Scan for<br/>today’s dossier</div>${qr.code ? `<div class="qrcode">${esc(qr.code)}</div>` : ""}</div>
          <div class="qrbox">${qr.svg}</div>
        </div>
      </div>
    </div>
    <div class="flight">${v.pours.map(glass).join("")}</div>
    <div class="foot"><span class="l">${esc(v.venueName ?? "Spirit Vault")} · ${v.pours.length} pours · 1 oz each</span><span class="l">${qr.code ? "Scan or enter today’s code for every pour’s dossier" : "Scan for every pour’s full dossier"}</span></div>
  </div>
</body></html>`;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  // Staff-only: the placemat prints today's access code, so gate it like the prep
  // sheet. Do NOT rely on middleware — /vault is Clerk-public — enforce here.
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...SPIRIT_VAULT_STAFF_ROLES] }, restaurant: { businessType: "RESTAURANT" } },
    select: { restaurantId: true },
  });
  if (!role) return new Response("Forbidden", { status: 403 });

  // Any status — the placemat is a staff print artifact (previewed before publish).
  // The guest digital page stays published-only.
  const view = await loadFlightView(role.restaurantId, params.id);
  if (!view) return new Response("Flight not found", { status: 404 });
  const qr = {
    svg: await qrSvg(qrTargetUrl(`/vault/flights/${params.id}`)),
    code: dayGateEnabled() ? todayCode() : null,
  };
  return new Response(placematHtml(view, qr), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
