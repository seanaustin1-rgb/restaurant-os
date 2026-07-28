/**
 * Public guest vault — served dynamically from the database.
 *
 * Reuses the proven static engine (`docs/spirit-vault/spirit-vault-prototype.html`)
 * verbatim, swapping only its data `<script src>` for a DB-generated payload
 * (see `buildVaultPayloadScript`). No renderer rewrite; publishing an edit in the
 * admin makes it live here immediately (revalidatePath), with no git/deploy step.
 *
 * Public route — add `/vault` to the middleware allowlist. `?review=1` shows drafts.
 *
 * NOTE (deploy): this reads the engine HTML from `docs/` at runtime. On Vercel add
 *   experimental.outputFileTracingIncludes = { "/vault": ["./docs/spirit-vault/**"] }
 * to next.config so the file is bundled with the function. (Not needed locally.)
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

export async function GET(req: NextRequest) {
  const review = req.nextUrl.searchParams.get("review") === "1";
  const items = await prisma.beverageItem.findMany({
    where: review ? {} : { recordStatus: "PUBLISHED", publicationStatus: "PUBLISHED" },
    orderBy: { name: "asc" },
  });

  const payload = buildVaultPayloadScript(items);
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
