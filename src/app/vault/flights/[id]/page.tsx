import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Guest-facing flight page. Public (single-tenant via env, same as /vault), shows
// only PUBLISHED flights, and reads venue overrides the same way the vault does.
export const dynamic = "force-dynamic";

const TENANT = process.env.SPIRIT_VAULT_RESTAURANT_ID?.trim();

type Def = {
  brand: string;
  expression: string | null;
  displayName: string | null;
  category: string;
  topNotes: string[];
  proofN: { toString(): string } | null;
  proofDisplay: string | null;
};

function num(v: { toString(): string } | number | string | null): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

function money(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function spiritName(def: Def): string {
  return def.displayName ?? [def.brand, def.expression].filter(Boolean).join(" ");
}

function effectiveTopNotes(def: Def, overrides: unknown): string[] {
  const ov = overrides && typeof overrides === "object" ? (overrides as { topNotes?: unknown }) : null;
  const ovNotes = Array.isArray(ov?.topNotes) ? ov!.topNotes.filter((x): x is string => typeof x === "string") : [];
  return (ovNotes.length ? ovNotes : def.topNotes ?? []).slice(0, 3);
}

function proofLabel(def: Def): string | null {
  const n = num(def.proofN);
  if (n != null) return `${n} proof`;
  return def.proofDisplay ?? null;
}

export default async function GuestFlightPage({ params }: { params: { id: string } }) {
  if (!TENANT) notFound();

  const flight = await prisma.spiritFlight.findFirst({
    where: { id: params.id, restaurantId: TENANT, status: "PUBLISHED" },
    select: {
      id: true,
      name: true,
      description: true,
      suggestedPriceUsd: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          itemNote: true,
          venueSpirit: {
            select: {
              slug: true,
              overrides: true,
              definition: {
                select: {
                  brand: true,
                  expression: true,
                  displayName: true,
                  category: true,
                  topNotes: true,
                  proofN: true,
                  proofDisplay: true,
                },
              },
            },
          },
          spiritPour: { select: { priceUsd: true, pourSizeOz: true } },
        },
      },
    },
  });

  if (!flight) notFound();

  const total = num(flight.suggestedPriceUsd);
  const pours = flight.items.map((item, index) => {
    const def = item.venueSpirit.definition;
    const price = num(item.spiritPour?.priceUsd ?? null);
    const size = num(item.spiritPour?.pourSizeOz ?? null);
    const oneOz = price != null && size != null && size > 0 ? Math.round((price / size) * 100) / 100 : null;
    return {
      order: String(index + 1).padStart(2, "0"),
      name: spiritName(def),
      category: def.category,
      proof: proofLabel(def),
      notes: effectiveTopNotes(def, item.venueSpirit.overrides),
      itemNote: item.itemNote,
      oneOz,
      slug: item.venueSpirit.slug,
    };
  });

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-ink px-5 py-10 text-ink-text">
      <header className="border-b border-line/70 pb-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Tasting Flight</p>
        <h1 className="mt-2 font-display text-3xl leading-tight text-copper-soft">{flight.name}</h1>
        {flight.description && <p className="mt-3 text-sm leading-relaxed text-muted">{flight.description}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {total != null && (
            <span className="tnum text-lg text-copper-soft">{money(total)}</span>
          )}
          <span className="text-muted">
            {pours.length} pours · 1 oz each
          </span>
        </div>
      </header>

      <ol className="mt-6 space-y-4">
        {pours.map((pour) => (
          <li key={pour.order} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="tnum text-xs text-copper-dim">{pour.order}</span>
                  <h2 className="truncate font-display text-lg text-ink-text">{pour.name}</h2>
                </div>
                <p className="mt-0.5 text-xs uppercase tracking-wider text-muted">
                  {pour.category}
                  {pour.proof ? ` · ${pour.proof}` : ""}
                </p>
              </div>
              {pour.oneOz != null && <span className="tnum shrink-0 text-sm text-muted">{money(pour.oneOz)}</span>}
            </div>

            {pour.notes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {pour.notes.map((note) => (
                  <span key={note} className="rounded-full border border-line bg-ink px-2 py-0.5 text-[11px] text-muted">
                    {note}
                  </span>
                ))}
              </div>
            )}

            {pour.itemNote && (
              <div className="mt-3">
                <p className="text-[11px] uppercase tracking-wider text-copper-dim">What to notice</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-text">{pour.itemNote}</p>
              </div>
            )}
          </li>
        ))}
      </ol>

      <footer className="mt-8 border-t border-line/70 pt-6 text-center">
        <Link href="/vault" className="text-sm text-copper-soft hover:text-copper">
          ◈ Explore the full Spirit Vault
        </Link>
      </footer>
    </main>
  );
}
