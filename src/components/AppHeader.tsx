"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import type { BusinessType, UserRole } from "@prisma/client";
import { Menu, X } from "lucide-react";
import { navLinksForRoles } from "@/lib/nav";

// Routes that render their own chrome or shouldn't show app nav at all. The
// dashboard has its own (richer) header with the restaurant/role switchers, so
// we skip the global one there to avoid a double header.
function isHidden(path: string): boolean {
  if (path === "/" || path === "/dashboard" || path === "/onboarding") return true;
  if (path.startsWith("/demo")) return true;
  if (path.startsWith("/profit-first")) return true;
  return path.startsWith("/sign-in") || path.startsWith("/sign-up");
}

export function AppHeader({ roles = [], businessTypes = [] }: { roles?: UserRole[]; businessTypes?: BusinessType[] }) {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  if (isHidden(pathname)) return null;

  const navLinks = navLinksForRoles(roles, businessTypes);
  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="rounded-md border border-line bg-surface p-1.5 text-ink-text hover:border-copper-dim"
          >
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
          <Link href="/dashboard" className="flex shrink-0 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="OutFront Data" className="h-7 w-auto" />
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      {/* Nav menu panel */}
      {open && (
        <nav className="border-t border-line bg-ink/95 px-4 py-2 sm:px-6">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={
                  "block rounded-md px-2 py-2.5 text-sm hover:bg-copper/10 " +
                  (isActive(l.href) ? "text-copper-soft" : "text-ink-text")
                }
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
