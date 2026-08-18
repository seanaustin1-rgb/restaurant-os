import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { SPIRIT_VAULT_STAFF_ROLES } from "@/lib/access/roles";
import { appBaseUrl, dayGateEnabled, qrTargetUrl, todayCode } from "@/lib/spirit-vault/day-code";
import { qrSvg } from "@/lib/spirit-vault/qr";

// Standalone, print-ready "today's vault code" card — STAFF ONLY. A table tent / bar
// sign so a guest who ISN'T handed a flight placemat can still scan in and browse the
// whole vault. Prints today's rotating code + a QR to the vault landing. Reprint daily.
export const dynamic = "force-dynamic";

function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function cardHtml(venueName: string, code: string | null, qr: string, vaultUrl: string): string {
  const gated = code != null;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(venueName)} — today's vault code</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=DM+Sans:wght@400;500&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
<style>
  :root{--parchment:#F5EFE2;--ink:#2A2418;--ink-soft:#5B513C;--copper:#9A6B2F;--copper-deep:#7A5526;--gold:#C8873A;--gold-light:#D9A35E;--band:#17130C;--band-text:#ECE1CB;--display:'Cormorant Garamond',Georgia,serif;--body:'DM Sans',system-ui,sans-serif;--mono:'Space Mono',ui-monospace,monospace}
  *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{background:#3a3730;font-family:var(--body);color:var(--ink);padding:24px;min-height:100vh;display:flex;flex-direction:column;align-items:center;gap:14px}
  .bar-print{width:5in;display:flex;justify-content:flex-end}
  .bar-print button{font-family:var(--mono);font-size:12px;letter-spacing:.06em;color:#efe6d2;background:#17130c;border:1px solid #4a3f28;border-radius:6px;padding:8px 14px;cursor:pointer}
  .card{width:5in;background:var(--parchment);border-radius:10px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.4);text-align:center}
  .top{background:var(--band);color:var(--band-text);padding:.34in .4in .3in;position:relative}
  .top::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent)}
  .venue{font-family:var(--mono);font-size:9px;letter-spacing:.32em;text-transform:uppercase;color:var(--gold-light)}
  .title{font-family:var(--display);font-weight:600;font-size:34px;line-height:1.05;margin-top:8px;color:var(--band-text)}
  .sub{font-family:var(--display);font-style:italic;font-size:16px;color:#cdbf9f;margin-top:6px}
  .body{padding:.34in .4in .4in}
  .qrbox{width:1.9in;height:1.9in;margin:0 auto;background:#fff;border:1px solid var(--line,#e2dccd);border-radius:8px;padding:10px}
  .qrbox svg{width:100%;height:100%;display:block;shape-rendering:crispEdges}
  .scan{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--copper);margin-top:12px}
  .codewrap{margin-top:14px;padding-top:14px;border-top:1px solid rgba(122,85,38,.28)}
  .codelab{font-family:var(--mono);font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft)}
  .code{font-family:var(--mono);font-weight:700;font-size:40px;letter-spacing:.2em;color:var(--copper-deep);margin-top:4px}
  .url{font-family:var(--mono);font-size:10px;color:var(--ink-soft);margin-top:10px}
  .open{font-family:var(--display);font-size:18px;color:var(--ink-soft);margin-top:8px}
  @media print{body{background:#fff;padding:0;min-height:auto;display:block}.bar-print{display:none}.card{width:100%;max-width:5in;margin:0 auto;box-shadow:none;border:1px solid #e2dccd}@page{size:letter portrait;margin:.6in}}
</style></head><body>
  <div class="bar-print"><button onclick="window.print()">Print card</button></div>
  <div class="card">
    <div class="top">
      <div class="venue">${esc(venueName)}</div>
      <div class="title">The Spirit Vault</div>
      <div class="sub">Every bottle we pour — with tasting notes</div>
    </div>
    <div class="body">
      <div class="qrbox">${qr}</div>
      <div class="scan">Scan to explore tonight</div>
      ${
        gated
          ? `<div class="codewrap"><div class="codelab">Or enter today's code at ${esc(vaultUrl)}</div><div class="code">${esc(code!)}</div></div>`
          : `<div class="open">Open now at ${esc(vaultUrl)}</div>`
      }
    </div>
  </div>
</body></html>`;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...SPIRIT_VAULT_STAFF_ROLES] }, restaurant: { businessType: "RESTAURANT" } },
    select: { restaurant: { select: { name: true } } },
  });
  if (!role) return new Response("Forbidden", { status: 403 });

  const qr = await qrSvg(qrTargetUrl("/vault"));
  const code = dayGateEnabled() ? todayCode() : null;
  const vaultUrl = appBaseUrl().replace(/^https?:\/\//, "") + "/vault";
  return new Response(cardHtml(role.restaurant?.name ?? "Spirit Vault", code, qr, vaultUrl), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
