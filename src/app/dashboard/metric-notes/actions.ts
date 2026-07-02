"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import type { MetricNote, NoteAudience, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canWriteMetricNotes, normalizeAudience, readableAudiencesFor } from "@/lib/dashboard/metric-notes";

const MAX_BODY = 600;

// Resolve the caller's single role on a business (one row per user/tenant).
// Everything gates off this â€” a user with no role on the tenant resolves to null
// and gets neither reads nor writes.
async function resolveViewer(restaurantId: string): Promise<{ userId: string; role: UserRole | null }> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const link = await prisma.userRestaurantRole.findUnique({
    where: { clerkUserId_restaurantId: { clerkUserId: userId, restaurantId } },
    select: { role: true },
  });
  return { userId, role: link?.role ?? null };
}

// Read notes visible to the caller. An INVESTOR only ever receives INVESTOR notes;
// the audience filter is applied in the query, so INTERNAL rows never leave the DB.
export async function listMetricNotes(restaurantId: string, metricKey?: string): Promise<MetricNote[]> {
  const { role } = await resolveViewer(restaurantId);
  const audiences = readableAudiencesFor(role);
  if (audiences.length === 0) return [];
  return prisma.metricNote.findMany({
    where: {
      restaurantId,
      audience: { in: audiences },
      ...(metricKey ? { metricKey } : {}),
    },
    orderBy: [{ metricKey: "asc" }, { eventDate: "desc" }],
  });
}

export async function createMetricNote(input: {
  restaurantId: string;
  metricKey: string;
  eventDate: string; // ISO date the event occurred
  periodKey: string; // e.g. "2026-06"
  body: string;
  audience: NoteAudience;
}): Promise<MetricNote> {
  const { userId, role } = await resolveViewer(input.restaurantId);
  if (!canWriteMetricNotes(role)) {
    throw new Error("Only an owner/operator, manager, or consultant can add notes.");
  }

  const body = input.body.trim();
  if (!body) throw new Error("A note is required.");
  if (body.length > MAX_BODY) throw new Error(`Notes are limited to ${MAX_BODY} characters.`);
  const metricKey = input.metricKey.trim();
  if (!metricKey) throw new Error("A metric is required.");
  const eventDate = new Date(input.eventDate);
  if (Number.isNaN(eventDate.getTime())) throw new Error("A valid event date is required.");

  const note = await prisma.metricNote.create({
    data: {
      restaurantId: input.restaurantId,
      metricKey,
      eventDate,
      periodKey: input.periodKey.trim(),
      body,
      audience: normalizeAudience(input.audience),
      authorId: userId,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/investor");
  return note;
}

export async function updateMetricNote(input: {
  id: string;
  restaurantId: string;
  body?: string;
  audience?: NoteAudience;
  resolved?: boolean;
}): Promise<void> {
  const { role } = await resolveViewer(input.restaurantId);
  if (!canWriteMetricNotes(role)) {
    throw new Error("Only an owner/operator, manager, or consultant can edit notes.");
  }

  const data: { body?: string; audience?: NoteAudience; resolvedAt?: Date | null } = {};
  if (input.body != null) {
    const body = input.body.trim();
    if (!body) throw new Error("A note is required.");
    if (body.length > MAX_BODY) throw new Error(`Notes are limited to ${MAX_BODY} characters.`);
    data.body = body;
  }
  if (input.audience != null) data.audience = normalizeAudience(input.audience);
  if (input.resolved != null) data.resolvedAt = input.resolved ? new Date() : null;

  // Scope the write by restaurantId so a note id from another tenant can't be
  // reached even with a valid role on some other restaurant.
  const result = await prisma.metricNote.updateMany({
    where: { id: input.id, restaurantId: input.restaurantId },
    data,
  });
  if (result.count === 0) throw new Error("Note not found.");

  revalidatePath("/dashboard");
  revalidatePath("/investor");
}
