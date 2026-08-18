import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Public index of published tasting flights for the configured venue.
export const dynamic = "force-dynamic";

const TENANT = process.env.SPIRIT_VAULT_RESTAURANT_ID?.trim();

function money(v: { toString(): string } | number | string | null): string | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v.toString());
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default async function GuestFlightsIndexPage() {
  if (!TENANT) notFound();

  const flights = await prisma.spiritFlight.findMany({
    where: { restaurantId: TENANT, status: "PUBLISHED" },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      description: true,
      suggestedPriceUsd: true,
      _count: { select: { items: true } },
    },
  });

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-ink px-5 py-10 text-ink-text">
      <header className="border-b border-line/70 pb-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Spirit Vault</p>
        <h1 className="mt-2 font-display text-3xl text-copper-soft">Tasting Flights</h1>
        <p className="mt-3 text-sm text-muted">Curated flights from the collection — each pour is 1 oz.</p>
      </header>

      {flights.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          No flights are published right now.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {flights.map((flight) => {
            const price = money(flight.suggestedPriceUsd);
            return (
              <li key={flight.id}>
                <Link
                  href={`/vault/flights/${flight.id}`}
                  className="block rounded-lg border border-line bg-surface p-4 transition-colors hover:border-copper-dim"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-display text-lg text-ink-text">{flight.name}</h2>
                    {price && <span className="tnum shrink-0 text-sm text-copper-soft">{price}</span>}
                  </div>
                  {flight.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{flight.description}</p>}
                  <p className="mt-2 text-[11px] uppercase tracking-wider text-muted">{flight._count.items} pours</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="mt-8 border-t border-line/70 pt-6 text-center">
        <Link href="/vault" className="text-sm text-copper-soft hover:text-copper">
          ◈ Explore the full Spirit Vault
        </Link>
      </footer>
    </main>
  );
}
