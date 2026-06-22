import type { Health } from "./estimate";
import type { PropertyHeartbeatResult } from "./property-heartbeat";

export type PropertyActionKind = "maintenance" | "ownerProceeds" | "guestAura" | "bookingPace";

export interface PropertyActionItem {
  propertyName: string;
  kind: PropertyActionKind;
  priority: Health;
  title: string;
  detail: string;
  value: number;
}

const rank: Record<Health, number> = { green: 0, yellow: 1, red: 2 };
const kindRank: Record<PropertyActionKind, number> = {
  maintenance: 0,
  ownerProceeds: 1,
  guestAura: 2,
  bookingPace: 3,
};

function maintenanceAction(property: PropertyHeartbeatResult): PropertyActionItem | null {
  if (property.maintenanceHealth === "green") return null;
  return {
    propertyName: property.name,
    kind: "maintenance",
    priority: property.maintenanceHealth,
    title: "Review maintenance drag",
    detail: `${property.openIssues.toLocaleString()} open issues and ${property.repeatIssues.toLocaleString()} repeat issues are pressuring owner proceeds.`,
    value: property.maintenancePressurePct,
  };
}

function ownerProceedsAction(property: PropertyHeartbeatResult): PropertyActionItem | null {
  if (property.ownerProceedsHealth === "green") return null;
  return {
    propertyName: property.name,
    kind: "ownerProceeds",
    priority: property.ownerProceedsHealth,
    title: "Check owner proceeds",
    detail: `Owner proceeds are ${property.ownerProceedsPct.toFixed(1)}% of booking revenue after property costs and management fee.`,
    value: property.ownerProceedsPct,
  };
}

function guestAuraAction(property: PropertyHeartbeatResult): PropertyActionItem | null {
  if (property.guestAuraHealth === "green") return null;
  return {
    propertyName: property.name,
    kind: "guestAura",
    priority: property.guestAuraHealth,
    title: "Recover guest Aura",
    detail: `Guest Aura is ${Math.round(property.guestAuraScore).toLocaleString()} with open or repeat issues showing up in the experience.`,
    value: property.guestAuraScore,
  };
}

function bookingPaceAction(property: PropertyHeartbeatResult): PropertyActionItem | null {
  if (property.bookingMomentumHealth === "green") return null;
  return {
    propertyName: property.name,
    kind: "bookingPace",
    priority: property.bookingMomentumHealth,
    title: "Watch booking pace",
    detail: `Forward booked nights cover ${property.bookingPacePct.toFixed(0)}% of the next available 30-night window.`,
    value: property.bookingPacePct,
  };
}

export function buildPropertyActionQueue(properties: PropertyHeartbeatResult[], limit = 5): PropertyActionItem[] {
  return properties
    .flatMap((property) =>
      [
        maintenanceAction(property),
        ownerProceedsAction(property),
        guestAuraAction(property),
        bookingPaceAction(property),
      ].filter((item): item is PropertyActionItem => item != null),
    )
    .sort((a, b) => rank[b.priority] - rank[a.priority] || kindRank[a.kind] - kindRank[b.kind])
    .slice(0, Math.max(0, limit));
}
