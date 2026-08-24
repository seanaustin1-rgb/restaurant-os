// Load custom (DB-backed) flight templates for a restaurant and convert them
// to the same FlightTemplate shape the static registry uses. The picker, the
// candidate resolver, and the slot grouper all work unchanged.

import { prisma } from "@/lib/prisma";
import type { FlightTemplate, FlightTemplateSlot } from "./flight-templates";

function parseSlots(raw: unknown): FlightTemplateSlot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => s != null && typeof s === "object")
    .map((s) => ({
      key: String(s.key ?? ""),
      label: String(s.label ?? ""),
      rules: s.rules && typeof s.rules === "object" ? (s.rules as FlightTemplateSlot["rules"]) : {},
      itemNote: String(s.itemNote ?? ""),
    }));
}

function toAutoOrder(v: string): FlightTemplate["autoOrder"] {
  if (v === "proof-asc" || v === "proof-desc") return v;
  return "slot-order";
}

export async function loadCustomTemplates(restaurantId: string): Promise<FlightTemplate[]> {
  const rows = await prisma.customFlightTemplate.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, description: true, throughLine: true, autoOrder: true, slots: true },
  });

  return rows.map((row) => ({
    key: `custom-${row.id}`,
    name: row.name,
    description: row.description,
    throughLine: row.throughLine,
    maxPours: 4 as const,
    autoOrder: toAutoOrder(row.autoOrder),
    slots: parseSlots(row.slots),
  }));
}
