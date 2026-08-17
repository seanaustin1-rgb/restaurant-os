import { describe, expect, it } from "vitest";
import {
  filterSpiritAdminList,
  parseSpiritAdminListFilters,
  spiritAdminCategoryOptions,
  summarizeSpiritAdminList,
  type SpiritAdminListItem,
} from "./admin-list";

const rows: SpiritAdminListItem[] = [
  {
    id: "live-bourbon",
    name: "Old Forester 1920",
    brand: "Old Forester",
    expression: "1920",
    category: "Bourbon",
    recordStatus: "PUBLISHED",
    publicationStatus: "PUBLISHED",
    verificationStatus: "SOURCED",
    hasVoice: true,
  },
  {
    id: "draft-rum",
    name: "Planteray Pineapple",
    brand: "Planteray",
    expression: "Pineapple",
    category: "Rum",
    recordStatus: "DRAFT",
    publicationStatus: "DRAFT",
    verificationStatus: "UNSOURCED",
    hasVoice: false,
  },
  {
    id: "reviewed-agave",
    name: "Don Fulano Reposado",
    brand: "Don Fulano",
    expression: "Reposado",
    category: "Agave",
    recordStatus: "REVIEWED",
    publicationStatus: "DRAFT",
    verificationStatus: "PARTIALLY_SOURCED",
    hasVoice: false,
  },
];

describe("Spirit Vault admin list filters", () => {
  it("normalizes invalid query params to safe defaults", () => {
    expect(
      parseSpiritAdminListFilters({
        q: "  rye  ",
        status: "bogus",
        voice: "missing",
        verification: "nope",
        category: [" Rum ", "Bourbon"],
      }),
    ).toEqual({
      q: "rye",
      status: "all",
      voice: "missing",
      verification: "all",
      category: "Rum",
    });
  });

  it("summarizes live, hidden, draft, voice, and sourcing work", () => {
    expect(summarizeSpiritAdminList(rows)).toEqual({
      total: 3,
      live: 1,
      hidden: 2,
      drafts: 2,
      reviewed: 1,
      missingVoice: 2,
      unsourced: 1,
    });
  });

  it("filters the hidden draft review queue without exposing live bottles", () => {
    const filtered = filterSpiritAdminList(rows, {
      q: "",
      status: "hidden",
      voice: "missing",
      verification: "all",
      category: "",
    });

    expect(filtered.map((row) => row.id)).toEqual(["draft-rum", "reviewed-agave"]);
  });

  it("combines text search with category and verification filters", () => {
    const filtered = filterSpiritAdminList(rows, {
      q: "fulano",
      status: "all",
      voice: "all",
      verification: "partially-sourced",
      category: "Agave",
    });

    expect(filtered.map((row) => row.id)).toEqual(["reviewed-agave"]);
  });

  it("sorts category options for the filter menu", () => {
    expect(spiritAdminCategoryOptions(rows)).toEqual(["Agave", "Bourbon", "Rum"]);
  });
});
