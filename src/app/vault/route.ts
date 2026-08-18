/**
 * Public guest vault, served dynamically from the canonical Spirit Vault tables.
 *
 * Reuses the proven static engine (`docs/spirit-vault/spirit-vault-prototype.html`)
 * and swaps only its data script for a DB-generated payload.
 */
import { prisma } from "@/lib/prisma";
import { publishedVaultListingArgs, renderPublicVaultHtml } from "@/lib/spirit-vault/public-vault-artifact";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VAULT_RESTAURANT_ID = process.env.SPIRIT_VAULT_RESTAURANT_ID?.trim();

export async function GET() {
  if (!VAULT_RESTAURANT_ID) {
    return new Response("Spirit Vault restaurant is not configured.", { status: 503 });
  }

  let listings;
  try {
    listings = await prisma.venueSpirit.findMany(publishedVaultListingArgs(VAULT_RESTAURANT_ID));
  } catch (error) {
    console.error("Spirit Vault database read failed", error);
    return new Response("Spirit Vault is temporarily unavailable.", { status: 503 });
  }

  let html;
  try {
    html = renderPublicVaultHtml(listings);
  } catch (error) {
    console.error("Spirit Vault engine render failed", error);
    return new Response("Vault engine template is missing its data-script tag.", { status: 500 });
  }

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
