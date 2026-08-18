import { describe, expect, it } from "vitest";
import {
  PUBLIC_VAULT_ROUTE,
  VAULT_DATA_SCRIPT_TAG,
  buildVaultArtifact,
  publishedVaultListingArgs,
  renderPublicVaultHtml,
} from "./public-vault-artifact";
import type { VaultListingInput } from "./vault-payload";

const listing: VaultListingInput = {
  id: "venue-1",
  slug: "published-bottle",
  whyWeCarry: "A concise venue note.",
  seanShort: "Try it neat.",
  notes: "Operator note.",
  recordStatus: "PUBLISHED",
  publicationStatus: "PUBLISHED",
  definition: {
    slug: "published-bottle",
    verificationStatus: "SOURCED",
    brand: "Published",
    expression: "Bottle",
    displayName: "Published Bottle",
    category: "Bourbon",
    proofN: 100,
    ageText: "NAS",
  },
  offers: [
    {
      isPrimary: true,
      priceUsd: 12,
      pourSizeOz: 1.5,
      pourLabel: "1.5 oz pour",
      toastItemGuid: "toast-guid",
      availability: "In stock",
      priceIsTemporary: false,
      commerceSource: "TOAST",
    },
  ],
};

describe("publishedVaultListingArgs", () => {
  it("selects only guest-visible published listings for one restaurant", () => {
    expect(publishedVaultListingArgs("rest_demo")).toMatchObject({
      where: {
        restaurantId: "rest_demo",
        recordStatus: "PUBLISHED",
        publicationStatus: "PUBLISHED",
      },
      include: {
        definition: true,
        offers: {
          where: { isPrimary: true },
          take: 1,
        },
      },
      orderBy: { slug: "asc" },
    });
  });
});

describe("renderPublicVaultHtml", () => {
  it("injects the published payload in place of the static data script", () => {
    const html = renderPublicVaultHtml([listing], `<html><head></head><body>${VAULT_DATA_SCRIPT_TAG}</body></html>`);

    expect(html).toContain("window.SPIRIT_VAULT_DATA");
    expect(html).toContain("published-bottle");
    expect(html).not.toContain(VAULT_DATA_SCRIPT_TAG);
  });

  it("keeps first load on the Vault browse view instead of opening the first dossier", () => {
    const html = renderPublicVaultHtml(
      [listing],
      `<html><body><div class="view" id="view-vault"></div><div class="view" id="view-detail"></div>${VAULT_DATA_SCRIPT_TAG}<script>/* INIT */\nshowVault();</script></body></html>`,
    );

    expect(html).toContain('<div class="view" id="view-detail"></div>');
    expect(html).toContain("showVault();");
    expect(html).not.toContain('<div class="view active" id="view-detail">');
    expect(html).not.toContain("renderDetail(0);");
  });

  it("fails closed when the engine template is missing the data hook", () => {
    expect(() => renderPublicVaultHtml([listing], "<html></html>")).toThrow(
      "Vault engine template is missing its data-script tag.",
    );
  });
});

describe("buildVaultArtifact", () => {
  it("builds a manifest for the Stone Grille vault route", () => {
    const artifact = buildVaultArtifact({
      listings: [listing],
      generatedAt: "2026-08-17T00:00:00.000Z",
      version: "2026.08.17",
      dataVersion: "test-data",
      engineHtml: `<html><body>${VAULT_DATA_SCRIPT_TAG}</body></html>`,
    });

    expect(artifact.manifest).toMatchObject({
      schemaVersion: 1,
      version: "2026.08.17",
      generatedAt: "2026-08-17T00:00:00.000Z",
      dataVersion: "test-data",
      customerId: "stone-grille",
      route: PUBLIC_VAULT_ROUTE,
      source: {
        publishedOnly: true,
        recordCount: 1,
      },
    });
    expect(artifact.manifest.files).toEqual([
      expect.objectContaining({
        path: "index.html",
        role: "entrypoint",
        hash: expect.stringMatching(/^sha256-[a-f0-9]{64}$/),
        bytes: artifact.indexHtml.length,
      }),
    ]);
    expect(JSON.parse(artifact.manifestJson)).toEqual(artifact.manifest);
  });
});
