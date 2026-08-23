"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SUB_PREFIXES = ["/admin/spirit-vault/flights", "/admin/spirit-vault/membership", "/admin/spirit-vault/today"];

const NAV_ITEMS = [
  { href: "/admin/spirit-vault", label: "Spirits" },
  { href: "/admin/spirit-vault/flights", label: "Flights" },
  { href: "/admin/spirit-vault/membership", label: "Membership" },
] as const;

export default function SpiritVaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";

  function isActive(href: string): boolean {
    if (href === "/admin/spirit-vault") {
      return pathname === href || (pathname.startsWith(href + "/") && !SUB_PREFIXES.some((p) => pathname.startsWith(p)));
    }
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      <nav className="border-b border-copper-dim/30 bg-surface/40">
        <div className="mx-auto flex max-w-4xl items-center gap-0.5 px-6">
          <Link
            href="/admin/spirit-vault"
            className="mr-3 py-3 font-display text-[17px] tracking-wide text-copper-soft"
          >
            Spirit Vault
          </Link>

          <span className="mr-2 h-4 w-px bg-copper-dim/40" aria-hidden />

          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "relative px-3 py-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors " +
                  (active
                    ? "text-copper-soft"
                    : "text-muted hover:text-ink-text")
                }
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-copper-soft" />
                )}
              </Link>
            );
          })}

          <div className="ml-auto flex items-center gap-1">
            <a
              href="/admin/spirit-vault/today"
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-copper-soft"
            >
              Today&apos;s Code&thinsp;↗
            </a>
            <a
              href="/vault"
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-copper-soft"
            >
              Preview Vault&thinsp;↗
            </a>
          </div>
        </div>
      </nav>
      {children}
    </>
  );
}
