import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { OPERATOR_ROLES } from "@/lib/access/roles";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FLAVOR_AXES = ["Sweet", "Oak", "Spice", "Fruit", "Smoke", "Earth", "Herbal"] as const;
const BATCH_SIZE = 10;

interface GeminiSpirit {
  venueSpirit_id: string;
  definition_slug: string;
  body: number;
  finish: number;
  flavor: Record<string, number>;
  topNotes: string[];
  pairings: string[];
  whyShort: string | null;
  whyWeCarry: string | null;
  seanShort: string | null;
  notes: string | null;
  mashBill: string | null;
  caskDetails: string | null;
  productionMethod: string | null;
  servingSuggestion: string | null;
  suggestedCocktails: string[] | null;
}

function validate(s: GeminiSpirit, idx: number): string[] {
  const errors: string[] = [];
  const tag = `[${idx}] ${s.definition_slug}`;

  if (!s.venueSpirit_id) errors.push(`${tag}: missing venueSpirit_id`);

  if (!Number.isInteger(s.body) || s.body < 0 || s.body > 10)
    errors.push(`${tag}: body must be integer 0-10, got ${s.body}`);
  if (!Number.isInteger(s.finish) || s.finish < 0 || s.finish > 10)
    errors.push(`${tag}: finish must be integer 0-10, got ${s.finish}`);

  for (const axis of FLAVOR_AXES) {
    const v = s.flavor?.[axis];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 10)
      errors.push(`${tag}: flavor.${axis} must be integer 0-10, got ${v}`);
  }

  if (!Array.isArray(s.topNotes) || s.topNotes.length !== 3 || s.topNotes.some((n) => !n?.trim()))
    errors.push(`${tag}: topNotes must be exactly 3 non-empty strings`);

  if (!Array.isArray(s.pairings) || s.pairings.length < 2 || s.pairings.length > 5)
    errors.push(`${tag}: pairings must be 2-5 entries, got ${s.pairings?.length}`);

  return errors;
}

const PLACEHOLDER_RE = /^(pending\s+sean\s+review|draft\s+inventory\s+setup)/i;
function isRealContent(v: string | null | undefined): boolean {
  return !!v && !PLACEHOLDER_RE.test(v.trim());
}

async function processSpirit(
  s: GeminiSpirit,
  commit: boolean
): Promise<{ status: "updated" | "skipped" | "would_update"; defUpdated: boolean; note: string }> {
  const overrides: Record<string, unknown> = {
    body: s.body,
    finish: s.finish,
    flavor: Object.fromEntries(FLAVOR_AXES.map((a) => [a, s.flavor[a]])),
    topNotes: s.topNotes,
    pairings: s.pairings,
    mashBill: s.mashBill?.trim() || null,
    caskDetails: s.caskDetails?.trim() || null,
    productionMethod: s.productionMethod?.trim() || null,
    servingSuggestion: s.servingSuggestion?.trim() || null,
    suggestedCocktails: (s.suggestedCocktails ?? []).map((c) => c.trim()).filter(Boolean),
  };

  const venueData = {
    whyWeCarry: s.whyWeCarry?.trim() || null,
    seanShort: s.seanShort?.trim() || null,
    notes: s.notes?.trim() || null,
    overrides: overrides as Prisma.InputJsonValue,
  };

  const existing = await prisma.venueSpirit.findUnique({
    where: { id: s.venueSpirit_id },
    select: { whyWeCarry: true, seanShort: true, notes: true, overrides: true },
  });

  if (!existing) {
    return { status: "skipped", defUpdated: false, note: `skip: ${s.definition_slug} (not found)` };
  }

  if (!commit) {
    return { status: "would_update", defUpdated: false, note: `would update: ${s.definition_slug}` };
  }

  const finalData = { ...venueData };
  if (isRealContent(existing.whyWeCarry)) finalData.whyWeCarry = existing.whyWeCarry;
  if (isRealContent(existing.seanShort)) finalData.seanShort = existing.seanShort;
  if (isRealContent(existing.notes)) finalData.notes = existing.notes;

  const existingOverrides = (existing.overrides ?? {}) as Record<string, unknown>;
  if (existingOverrides.body != null || existingOverrides.finish != null) {
    // preserve existing sensory overrides
  } else {
    finalData.overrides = overrides as Prisma.InputJsonValue;
  }

  await prisma.venueSpirit.update({
    where: { id: s.venueSpirit_id },
    data: finalData,
  });

  let defUpdated = false;
  if (s.whyShort) {
    const def = await prisma.spiritDefinition.findFirst({
      where: { slug: s.definition_slug },
      select: { id: true, whyShort: true },
    });
    if (def && !def.whyShort) {
      await prisma.spiritDefinition.update({
        where: { id: def.id },
        data: { whyShort: s.whyShort.trim() },
      });
      defUpdated = true;
    }
  }

  return { status: "updated", defUpdated, note: `updated: ${s.definition_slug}` };
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...OPERATOR_ROLES] }, restaurant: { businessType: "RESTAURANT" } },
    select: { restaurantId: true },
  });
  if (!role) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const commit = url.searchParams.get("commit") === "true";

  const body = await req.json();
  const spirits: GeminiSpirit[] = Array.isArray(body) ? body : body.spirits ?? body;

  const allErrors: string[] = [];
  for (let i = 0; i < spirits.length; i++) {
    allErrors.push(...validate(spirits[i], i));
  }
  if (allErrors.length) {
    return NextResponse.json({ error: "validation_failed", errors: allErrors }, { status: 400 });
  }

  let updated = 0;
  let defUpdated = 0;
  let skipped = 0;
  const log: string[] = [];

  for (let i = 0; i < spirits.length; i += BATCH_SIZE) {
    const batch = spirits.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((s) => processSpirit(s, commit)));
    for (const r of results) {
      log.push(r.note);
      if (r.status === "updated" || r.status === "would_update") updated++;
      if (r.status === "skipped") skipped++;
      if (r.defUpdated) defUpdated++;
    }
  }

  return NextResponse.json({
    mode: commit ? "commit" : "dry-run",
    total: spirits.length,
    updated,
    defUpdated,
    skipped,
    log,
  });
}
