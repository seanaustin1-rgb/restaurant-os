import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { SPIRIT_VAULT_STAFF_ROLES } from "@/lib/access/roles";
import { loadFlightView, type FlightView } from "@/lib/spirit-vault/flight-view";

// Internal, print-ready bar/kitchen prep sheet: each pour + its 1-2 bite
// accompaniment. Staff only, any status, standalone HTML (no app chrome).

function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function prepHtml(v: FlightView): string {
  const rows = v.pours
    .map((p) => {
      const meta = [p.category, p.proof, p.age].filter(Boolean).join(" · ");
      const bites = p.bites.length ? p.bites.map(esc).join(" · ") : "—";
      return `<tr>
        <td class="n">${String(p.order).padStart(2, "0")}</td>
        <td><div class="sp">${esc(p.name)}</div><div class="meta">${esc(meta)}</div></td>
        <td class="bites">${bites}</td>
      </tr>`;
    })
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(v.name)} — prep sheet</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=DM+Sans:wght@400;500&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
<style>
  :root{--paper:#fff;--ink:#23201a;--muted:#6b6353;--line:#e2dccd;--copper:#8a5e28;--mono:'Space Mono',ui-monospace,monospace;--display:'Cormorant Garamond',Georgia,serif;--body:'DM Sans',system-ui,sans-serif}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#efece4;font-family:var(--body);color:var(--ink);padding:28px;-webkit-font-smoothing:antialiased}
  .bar{max-width:7.5in;margin:0 auto 12px;display:flex;justify-content:space-between;align-items:center}
  .bar .tag{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
  .bar button{font-family:var(--mono);font-size:12px;color:#fff;background:#23201a;border:0;border-radius:6px;padding:8px 14px;cursor:pointer}
  .sheet{max-width:7.5in;margin:0 auto;background:var(--paper);border:1px solid var(--line);padding:.5in;min-height:9in}
  .kicker{font-family:var(--mono);font-size:9px;letter-spacing:.28em;text-transform:uppercase;color:var(--copper)}
  h1{font-family:var(--display);font-weight:600;font-size:26px;color:var(--ink);margin-top:5px}
  .sub{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-top:6px}
  .note{font-size:11.5px;color:var(--muted);margin-top:14px;font-style:italic}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th{text-align:left;font-family:var(--mono);font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);border-bottom:1.5px solid var(--ink);padding:0 8px 7px}
  td{padding:12px 8px;border-bottom:1px solid var(--line);vertical-align:top}
  td.n{font-family:var(--display);font-size:20px;color:var(--copper);width:.5in}
  .sp{font-family:var(--display);font-size:17px;font-weight:600}
  .meta{font-family:var(--mono);font-size:8px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-top:3px}
  td.bites{font-size:14px;color:var(--ink);width:2.9in}
  @media print{body{background:none;padding:0}.bar button{display:none}.sheet{border:0;padding:.5in}@page{size:letter portrait;margin:.4in}}
</style></head><body>
  <div class="bar"><span class="tag">Internal · not guest-facing</span><button onclick="window.print()">Print prep sheet</button></div>
  <div class="sheet">
    <div class="kicker">${esc(v.venueName ?? "Spirit Vault")} · Flight prep</div>
    <h1>${esc(v.name)}</h1>
    <div class="sub">${v.pours.length} pours · 1 oz each · bites are a 1–2 bite accompaniment</div>
    <div class="note">Suggested from each pour's flavor profile — adjust to what the kitchen can build.</div>
    <table>
      <thead><tr><th>#</th><th>Pour</th><th>Bites</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</body></html>`;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...SPIRIT_VAULT_STAFF_ROLES] }, restaurant: { businessType: "RESTAURANT" } },
    select: { restaurantId: true },
  });
  if (!role) return new Response("Forbidden", { status: 403 });

  const view = await loadFlightView(role.restaurantId, params.id);
  if (!view) return new Response("Flight not found", { status: 404 });
  return new Response(prepHtml(view), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
