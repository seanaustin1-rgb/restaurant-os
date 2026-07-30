/**
 * Public guest vault, served dynamically from the canonical Spirit Vault tables.
 *
 * Reuses the proven static engine (`docs/spirit-vault/spirit-vault-prototype.html`)
 * and swaps only its data script for a DB-generated payload. `?review=1` shows
 * draft/review records for the configured tenant.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildVaultPayloadScript } from "@/lib/spirit-vault/vault-payload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ENGINE_PATH = join(process.cwd(), "docs/spirit-vault/spirit-vault-prototype.html");
const DATA_SCRIPT_TAG = '<script src="spirit-vault-data.js"></script>';
const VAULT_RESTAURANT_ID = process.env.SPIRIT_VAULT_RESTAURANT_ID?.trim();

export async function GET(req: NextRequest) {
  if (!VAULT_RESTAURANT_ID) {
    return new Response("Spirit Vault restaurant is not configured.", { status: 503 });
  }

  const review = req.nextUrl.searchParams.get("review") === "1";
  const listings = await prisma.venueSpirit.findMany({
    where: {
      restaurantId: VAULT_RESTAURANT_ID,
      ...(review ? {} : { recordStatus: "PUBLISHED" as const, publicationStatus: "PUBLISHED" as const }),
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
