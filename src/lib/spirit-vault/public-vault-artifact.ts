import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Prisma } from "@prisma/client";
import { buildVaultPayloadScript, type VaultListingInput } from "./vault-payload";

export const PUBLIC_VAULT_ROUTE = "/echos-reserve/vault/";
export const VAULT_ENGINE_PATH = join(process.cwd(), "docs/spirit-vault/spirit-vault-prototype.html");
export const VAULT_DATA_SCRIPT_TAG = '<script src="spirit-vault-data.js"></script>';

export interface VaultArtifactFile {
  path: string;
  role: "entrypoint";
  hash: string;
  bytes: number;
}

export interface VaultArtifactManifest {
  schemaVersion: 1;
  version: string;
  generatedAt: string;
  dataVersion: string;
  customerId: string;
  route: string;
  source: {
    publishedOnly: true;
    recordCount: number;
  };
  files: VaultArtifactFile[];
}

export function publishedVaultListingArgs(restaurantId: string) {
  return {
    where: {
      restaurantId,
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
  } satisfies Prisma.VenueSpiritFindManyArgs;
}

export function readVaultEngineHtml(): string {
  return readFileSync(VAULT_ENGINE_PATH, "utf8");
}

export function renderPublicVaultHtml(items: VaultListingInput[], engineHtml = readVaultEngineHtml()): string {
  if (!engineHtml.includes(VAULT_DATA_SCRIPT_TAG)) {
    throw new Error("Vault engine template is missing its data-script tag.");
  }

  const payload = buildVaultPayloadScript(items);
  return engineHtml.replace(VAULT_DATA_SCRIPT_TAG, `<script>${payload}</script>`);
}

export function buildVaultArtifact(params: {
  listings: VaultListingInput[];
  generatedAt: string;
  version: string;
  dataVersion: string;
  customerId?: string;
  route?: string;
  engineHtml?: string;
}): { indexHtml: string; manifest: VaultArtifactManifest; manifestJson: string } {
  const route = params.route ?? PUBLIC_VAULT_ROUTE;
  const customerId = params.customerId ?? "stone-grille";
  const indexHtml = renderPublicVaultHtml(params.listings, params.engineHtml);
  const manifest: VaultArtifactManifest = {
    schemaVersion: 1,
    version: params.version,
    generatedAt: params.generatedAt,
    dataVersion: params.dataVersion,
    customerId,
    route,
    source: {
      publishedOnly: true,
      recordCount: params.listings.length,
    },
    files: [
      {
        path: "index.html",
        role: "entrypoint",
        hash: sha256(indexHtml),
        bytes: Buffer.byteLength(indexHtml, "utf8"),
      },
    ],
  };

  return {
    indexHtml,
    manifest,
    manifestJson: `${JSON.stringify(manifest, null, 2)}\n`,
  };
}

export function sha256(content: string): string {
  return `sha256-${createHash("sha256").update(content).digest("hex")}`;
}
