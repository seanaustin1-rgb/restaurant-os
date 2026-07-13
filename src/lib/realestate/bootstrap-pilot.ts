import type { PrismaClient } from "@prisma/client";
import { stampFirstTouch, deriveEscalation } from "./response-clock";

// One-time pilot bring-up (no terminal): create a REAL_ESTATE_BROKERAGE tenant,
// attach the signed-in user as BROKER, link them to a BrokerageAgent (so the
// agent app resolves), and drop in a small, clearly-fictitious lead spread so
// both dashboards render populated. Fully idempotent: reuses an existing
// brokerage the user already belongs to, upserts the role + agent, and only
// seeds sample leads once. Guarded at the route layer by a secret token.

export interface BootstrapResult {
  restaurantId: string;
  agentId: string;
  createdTenant: boolean;
  sampleLeadsCreated: number;
}

function slugify(name: string, suffix: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${base || "pilot-brokerage"}-${suffix}`;
}

// Sample lead spread relative to "now" (seconds ago received, optional seconds to
// first touch). Chosen to exercise every band + escalation rung: fast wins, a
// leaked-to-broker untouched lead, and a slow-but-touched one.
const SAMPLE_LEADS: Array<{
  key: string;
  fullName: string;
  origin: "ZILLOW" | "REALTOR_COM" | "IDX_WEBSITE" | "FACEBOOK" | "REFERRAL";
  receivedAgoSec: number;
  touchAfterSec: number | null;
}> = [
  { key: "1", fullName: "Ava Thompson", origin: "ZILLOW", receivedAgoSec: 30, touchAfterSec: null },
  { key: "2", fullName: "Marcus Lee", origin: "IDX_WEBSITE", receivedAgoSec: 5 * 60, touchAfterSec: null },
  { key: "3", fullName: "Priya Nair", origin: "FACEBOOK", receivedAgoSec: 42 * 60, touchAfterSec: null },
  { key: "4", fullName: "Dan O'Brien", origin: "REFERRAL", receivedAgoSec: 60 * 60, touchAfterSec: 45 },
  { key: "5", fullName: "Sofia Ramirez", origin: "REALTOR_COM", receivedAgoSec: 2 * 60 * 60, touchAfterSec: 20 * 60 },
  { key: "6", fullName: "Chris Walker", origin: "ZILLOW", receivedAgoSec: 3 * 60 * 60, touchAfterSec: 35 * 60 },
];

export async function bootstrapPilotBrokerage(
  db: PrismaClient,
  params: { clerkUserId: string; agentName: string; brokerageName: string },
): Promise<BootstrapResult> {
  const { clerkUserId, agentName, brokerageName } = params;

  // 1. Reuse a brokerage the user already belongs to, else create one.
  const existingRole = await db.userRestaurantRole.findFirst({
    where: { clerkUserId, restaurant: { businessType: "REAL_ESTATE_BROKERAGE" } },
    select: { restaurantId: true },
    orderBy: { createdAt: "asc" },
  });

  let restaurantId: string;
  let createdTenant = false;
  if (existingRole) {
    restaurantId = existingRole.restaurantId;
  } else {
    const tenant = await db.restaurant.create({
      data: {
        name: brokerageName,
        slug: slugify(brokerageName, clerkUserId.slice(-6)),
        businessType: "REAL_ESTATE_BROKERAGE",
      },
      select: { id: true },
    });
    restaurantId = tenant.id;
    createdTenant = true;
  }

  // 2. Attach the user as BROKER (idempotent on the unique [clerkUserId, restaurantId]).
  await db.userRestaurantRole.upsert({
    where: { clerkUserId_restaurantId: { clerkUserId, restaurantId } },
    create: { clerkUserId, restaurantId, role: "BROKER" },
    update: {},
  });

  // 3. Link the user to a BrokerageAgent so /realestate/agent resolves.
  const agent = await db.brokerageAgent.upsert({
    where: { restaurantId_externalAgentId: { restaurantId, externalAgentId: "pilot-self" } },
    create: { restaurantId, externalAgentId: "pilot-self", name: agentName, clerkUserId },
    update: { clerkUserId, name: agentName },
    select: { id: true },
  });

  // 4. Seed the sample lead spread once (skip if any pilot-sample lead exists).
  const alreadySeeded = await db.lead.findFirst({
    where: { restaurantId, sourceSystem: "BOLDTRAIL", externalId: "pilot-sample-1" },
    select: { id: true },
  });

  let sampleLeadsCreated = 0;
  if (!alreadySeeded) {
    const now = Date.now();
    for (const s of SAMPLE_LEADS) {
      const receivedAt = new Date(now - s.receivedAgoSec * 1000);
      const touched = s.touchAfterSec != null;
      const clock = touched
        ? stampFirstTouch(receivedAt, new Date(receivedAt.getTime() + s.touchAfterSec! * 1000), "CALL")
        : null;
      const elapsedSec = touched ? clock!.responseSeconds ?? 0 : Math.round((now - receivedAt.getTime()) / 1000);

      await db.lead.create({
        data: {
          restaurantId,
          agentId: agent.id,
          sourceSystem: "BOLDTRAIL",
          externalId: `pilot-sample-${s.key}`,
          origin: s.origin,
          fullName: s.fullName,
          phone: "+15551234567",
          receivedAt,
          status: touched ? "CONTACTED" : "NEW",
          firstTouchAt: clock?.firstTouchAt ?? null,
          firstTouchChannel: clock?.firstTouchChannel ?? null,
          responseSeconds: clock?.responseSeconds ?? null,
          escalation: deriveEscalation(elapsedSec),
        },
      });
      sampleLeadsCreated += 1;
    }
  }

  return { restaurantId, agentId: agent.id, createdTenant, sampleLeadsCreated };
}
