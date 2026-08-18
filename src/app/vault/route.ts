/**
 * Public guest vault, served dynamically from the canonical Spirit Vault tables.
 *
 * Reuses the proven static engine (`docs/spirit-vault/spirit-vault-prototype.html`)
 * and swaps only its data script for a DB-generated payload.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { buildVaultPayloadScript } from "@/lib/spirit-vault/vault-payload";
import { resolveVaultAccess } from "@/lib/spirit-vault/vault-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ENGINE_PATH = join(process.cwd(), "docs/spirit-vault/spirit-vault-prototype.html");
const DATA_SCRIPT_TAG = '<script src="spirit-vault-data.js"></script>';
const VAULT_RESTAURANT_ID = process.env.SPIRIT_VAULT_RESTAURANT_ID?.trim();

// Minimal standalone gate for the engine landing (it serves raw HTML, not a React
// page, so it can't render <VaultGate/>). Mirrors its copy and posts to /v/<code>.
function gateHtml(expired: boolean): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Spirit Vault — ${expired ? "code expired" : "unlock"}</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0B0D0B;color:#ECE1CB;
    font-family:ui-sans-serif,system-ui,-apple-system,'DM Sans',sans-serif;padding:24px;text-align:center}
  .w{max-width:26rem}
  .k{font-family:ui-monospace,'Space Mono',monospace;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#C8873A}
  h1{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:2rem;margin:.6rem 0 0}
  p{color:#9c876a;font-size:.9rem;line-height:1.5;margin:.8rem 0 0}
  form{margin-top:1.8rem;display:flex;gap:.5rem}
  input{flex:1;background:transparent;border:1px solid #3a3730;border-radius:8px;padding:.6rem;color:#ECE1CB;text-align:center;
    font-family:ui-monospace,monospace;font-size:1.1rem;letter-spacing:.2em;text-transform:uppercase}
  input:focus{outline:none;border-color:#C8873A}
  button{background:#ECE1CB;color:#0B0D0B;border:0;border-radius:8px;padding:.6rem 1rem;font-family:ui-monospace,monospace;font-size:.9rem;cursor:pointer}
  .fine{margin-top:1.4rem;font-size:.75rem}
</style></head><body><div class="w">
  <div class="k">Spirit Vault</div>
  <h1>${expired ? "That code has expired" : "Unlock today’s vault"}</h1>
  <p>The vault opens on-site. Scan the code on <strong>today’s tasting placemat</strong> at the bar to unlock every dossier for the rest of the day.</p>
  <form onsubmit="event.preventDefault();var c=this.c.value.toUpperCase().replace(/[^0-9A-Z]/g,'');if(c.length>=4)location.href='/v/'+c;">
    <input name="c" placeholder="e.g. K7Q2M9" autocapitalize="characters" autocomplete="off" spellcheck="false"/>
    <button type="submit">Enter</button>
  </form>
  <p class="fine">Echo’s Reserve member? <a href="/vault/join" style="color:#C8873A;text-decoration:underline">Sign in</a> for access anywhere.</p>
</div></body></html>`;
}

export async function GET(req: Request) {
  if (!VAULT_RESTAURANT_ID) {
    return new Response("Spirit Vault restaurant is not configured.", { status: 503 });
  }

  const url = new URL(req.url);
  const { userId } = await auth();
  const access = await resolveVaultAccess({
    restaurantId: VAULT_RESTAURANT_ID,
    providedCode: url.searchParams.get("k"),
    clerkUserId: userId,
  });
  if (!access.allowed) {
    return new Response(gateHtml(url.searchParams.get("gate") === "expired"), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const listings = await prisma.venueSpirit.findMany({
    where: {
      restaurantId: VAULT_RESTAURANT_ID,
      recordStatus: "PUBLISHED",
      publicationStatus: "PUBLISHED",
    },
    include: {
      definition: true,
      offers: {
        where: { isPrimary: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { slug: "asc" },
  });

  const payload = buildVaultPayloadScript(listings);
  const engine = readFileSync(ENGINE_PATH, "utf8");
  if (!engine.includes(DATA_SCRIPT_TAG)) {
    return new Response("Vault engine template is missing its data-script tag.", { status: 500 });
  }
  const html = engine.replace(DATA_SCRIPT_TAG, `<script>${payload}</script>`);

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
