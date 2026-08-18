import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { loadFlightView } from "@/lib/spirit-vault/flight-view";
import { FlavorBars } from "@/components/spirit-vault/FlavorBars";
import { resolveVaultAccess } from "@/lib/spirit-vault/vault-access";
import { VaultGate } from "@/components/spirit-vault/VaultGate";

// Guest-facing digital flight view (QR / discovery). Public, single-tenant via
// SPIRIT_VAULT_RESTAURANT_ID, PUBLISHED only. One flight price, no per-pour price.
export const dynamic = "force-dynamic";

const TENANT = process.env.SPIRIT_VAULT_RESTAURANT_ID?.trim();

function money(n: number | null): string {
  if (n == null) return "";
  return "$" + n.toFixed(2).replace(/\.00$/, "");
}

export default async function GuestFlightPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { k?: string; gate?: string };
}) {
  if (!TENANT) notFound();

  // Physical-presence gate: on-site (today's code) or a future paid member.
  const { userId } = await auth();
  if (!(await resolveVaultAccess({ restaurantId: TENANT, providedCode: searchParams?.k, clerkUserId: userId })).allowed) {
    return <VaultGate expired={searchParams?.gate === "expired"} />;
  }

  const flight = await loadFlightView(TENANT, params.id, { publishedOnly: true });
  if (!flight) notFound();

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-ink px-5 py-10 text-ink-text">
      <header className="border-b border-line/70 pb-6">
        <p className="font-mono text-[0.625rem] font-bold uppercase tracking-[0.28em] text-copper-dim">Tasting Flight</p>
        <h1 className="mt-2 text-balance font-display text-[clamp(2.1rem,7vw,2.8rem)] font-semibold leading-[1.05] text-copper-soft">
          {flight.name}
        </h1>
        {flight.description && (
          <div className="mt-4">
            <p className="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-copper-dim">The through-line</p>
            <p className="mt-1.5 max-w-[60ch] text-pretty font-display text-[1.15rem] leading-snug text-ink-text-soft">{flight.description}</p>
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-baseline gap-x-5 gap-y-2">
          {flight.totalPriceUsd != null && <span className="font-mono text-2xl font-bold text-copper-soft">{money(flight.totalPriceUsd)}</span>}
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted">{flight.pours.length} pours · 1 oz each</span>
        </div>
      </header>

      <ol className="mt-2">
        {flight.pours.map((pour, i) => (
          <li key={pour.order} className="grid grid-cols-[2.2rem_1fr] gap-3.5 border-b border-line py-6 last:border-b-0">
            <div className="pt-0.5 text-center font-display text-2xl leading-none text-copper-dim">
              {String(pour.order).padStart(2, "0")}
              {i < flight.pours.length - 1 && (
                <span className="mx-auto mt-2 block h-full w-px" style={{ background: "linear-gradient(180deg,#232623,transparent)" }} />
              )}
            </div>
            <div>
              <h2 className="font-display text-[1.4rem] font-medium leading-tight text-ink-text">{pour.name}</h2>
              <p className="mt-1 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-copper-dim">
                {[pour.category, pour.proof, pour.age].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-3.5 max-w-[19rem]">
                <FlavorBars flavor={pour.flavor} body={pour.body} finish={pour.finish} />
              </div>
              {pour.topNotes.length > 0 && (
                <div className="mt-3">
                  <p className="font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-copper-dim">Top notes</p>
                  <p className="mt-1 text-[0.85rem] text-ink-text-soft">{pour.topNotes.join(" · ")}</p>
                </div>
              )}
              {pour.taste && <p className="mt-3 text-[0.9rem] leading-relaxed text-ink-text-soft">{pour.taste}</p>}
              {(pour.mash || pour.cask) && (
                <div className="mt-3 border-t border-line pt-3">
                  {pour.mash && (
                    <p className="text-[0.82rem] text-ink-text-soft">
                      <span className="mr-1.5 font-mono text-[0.55rem] uppercase tracking-wider text-copper-dim">Mash</span>
                      {pour.mash}
                    </p>
                  )}
                  {pour.cask && (
                    <p className="mt-1 text-[0.82rem] text-ink-text-soft">
                      <span className="mr-1.5 font-mono text-[0.55rem] uppercase tracking-wider text-copper-dim">Cask</span>
                      {pour.cask}
                    </p>
                  )}
                </div>
              )}
              {pour.itemNote && (
                <div className="mt-3">
                  <p className="font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-copper-dim">What to notice</p>
                  <p className="mt-1 text-[0.9rem] leading-relaxed text-ink-text">{pour.itemNote}</p>
                </div>
              )}
            </div>
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
