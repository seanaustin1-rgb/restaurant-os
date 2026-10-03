"use server";

import { revalidatePath } from "next/cache";
import { TeamDept, TeamRole } from "@prisma/client";
import { requireTeamAccess } from "@/lib/team/access";
import { teamDb } from "@/lib/team/db";
import { normalizeTeamPhone } from "@/lib/team/phone";

const DEPARTMENTS: TeamDept[] = ["FOH", "BOH", "BAR", "BAKERY", "MGMT"];
const ROLES: TeamRole[] = ["MEMBER", "CONTRIBUTOR", "MANAGER"];

export interface RosterInput {
  restaurantId: string;
  displayName: string;
  phone: string;
  departments: TeamDept[];
  role?: TeamRole;
}

function cleanInput(input: RosterInput) {
  const displayName = input.displayName.trim();
  if (!displayName || displayName.length > 120) throw new Error("Enter a name of 1 to 120 characters.");
  const phoneE164 = normalizeTeamPhone(input.phone);
  const departments = [...new Set(input.departments)];
  if (!departments.length || departments.some((dept) => !DEPARTMENTS.includes(dept))) {
    throw new Error("Choose at least one valid department.");
  }
  const role = input.role ?? "MEMBER";
  if (!ROLES.includes(role)) throw new Error("Choose a valid Team role.");
  return { displayName, phoneE164, departments, role };
}

export async function addTeamMember(input: RosterInput): Promise<void> {
  const viewer = await requireTeamAccess(input.restaurantId, "MANAGER");
  const data = cleanInput(input);
  const db = teamDb(input.restaurantId);
  const existing = await db.teamMembership.findUnique({
    where: { restaurantId_phoneE164: { restaurantId: input.restaurantId, phoneE164: data.phoneE164 } },
    select: { id: true, status: true },
  });
  if (existing && existing.status !== "REMOVED") throw new Error("This phone number is already on the roster.");
  const member = existing
    ? await db.teamMembership.update({
      where: { id: existing.id },
      data: { ...data, status: "INVITED", clerkUserId: null, removedAt: null },
    })
    : await db.teamMembership.create({ data: { ...data, restaurantId: input.restaurantId, status: "INVITED" } });
  await db.teamActionLog.create({ data: {
    restaurantId: input.restaurantId,
    actorId: viewer.membershipId ?? viewer.clerkUserId,
    action: existing ? "REINVITE_MEMBER" : "ADD_MEMBER",
    targetType: "TeamMembership", targetId: member.id,
  } });
  revalidatePath("/team/manage");
}

export async function updateTeamMember(input: RosterInput & { memberId: string }): Promise<void> {
  const viewer = await requireTeamAccess(input.restaurantId, "MANAGER");
  const data = cleanInput(input);
  const db = teamDb(input.restaurantId);
  const result = await db.teamMembership.updateMany({
    where: { id: input.memberId, status: { not: "REMOVED" } },
    data,
  });
  if (result.count !== 1) throw new Error("Active roster member not found.");
  await db.teamActionLog.create({ data: {
    restaurantId: input.restaurantId,
    actorId: viewer.membershipId ?? viewer.clerkUserId,
    action: "UPDATE_MEMBER", targetType: "TeamMembership", targetId: input.memberId,
  } });
  revalidatePath("/team/manage");
}

export async function removeTeamMember(input: { restaurantId: string; memberId: string }): Promise<void> {
  const viewer = await requireTeamAccess(input.restaurantId, "MANAGER");
  if (viewer.membershipId === input.memberId) throw new Error("You cannot remove your own Team access.");
  const db = teamDb(input.restaurantId);
  const result = await db.teamMembership.updateMany({
    where: { id: input.memberId, status: { not: "REMOVED" } },
    data: { status: "REMOVED", removedAt: new Date() },
  });
  if (result.count !== 1) throw new Error("Roster member not found.");
  await db.teamActionLog.create({ data: {
    restaurantId: input.restaurantId,
    actorId: viewer.membershipId ?? viewer.clerkUserId,
    action: "REMOVE_MEMBER", targetType: "TeamMembership", targetId: input.memberId,
  } });
  revalidatePath("/team/manage");
}

/** A manual text link: the manager sends it from their phone or copies it. */
export async function prepareTeamInvite(input: { restaurantId: string; memberId: string }): Promise<{
  url: string; phone: string;
}> {
  const viewer = await requireTeamAccess(input.restaurantId, "MANAGER");
  const db = teamDb(input.restaurantId);
  const member = await db.teamMembership.findFirst({
    where: { id: input.memberId, status: "INVITED", clerkUserId: null },
    select: { id: true, phoneE164: true },
  });
  if (!member) throw new Error("Only an unclaimed invite can be sent.");
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  let appUrl: URL;
  try { appUrl = new URL(base ?? ""); }
  catch { throw new Error("The app URL must be configured before sharing invites."); }
  const localDev = process.env.NODE_ENV !== "production" && appUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(appUrl.hostname);
  if (appUrl.protocol !== "https:" && !localDev) throw new Error("The app URL must use HTTPS before sharing invites.");
  const claimUrl = new URL("/team/claim", appUrl);
  claimUrl.searchParams.set("restaurantId", input.restaurantId);
  claimUrl.searchParams.set("membershipId", member.id);
  const url = claimUrl.toString();
  await db.teamActionLog.create({ data: {
    restaurantId: input.restaurantId,
    actorId: viewer.membershipId ?? viewer.clerkUserId,
    action: "PREPARE_INVITE", targetType: "TeamMembership", targetId: member.id,
  } });
  return { url, phone: member.phoneE164 };
}
