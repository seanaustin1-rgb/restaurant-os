"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import { NAV_LINKS } from "@/lib/nav";

// Routes that render their own chrome or shouldn't show app nav at all. The
// dashboard has its own (richer) header with the restaurant/role switchers, so
// we skip the global one there to avoid a double header.
function isHidden(path: string): boolean {
  if (path === "/" || path === "/dashboard" || path === "/onboarding") return true;
  return path.startsWith("/sign-in") || path.startsWith("/sign-up");
}

export function AppHeader() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  if (isHidden(pathname)) return null;

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
            className="rounded-md border border-line bg-surface p-1.5 text-[#E6E8E4] hover:border-copper-dim lg:hidden"
          >
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
          <Link href="/dashboard" className="font-display text-xl font-semibold text-copper">
            Restaurant OS
          </Link>
          <nav className="ml-2 hidden items-center gap-1 text-sm text-muted lg:flex">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={"rounded px-2 py-1 hover:text-[#E6E8E4] " + (isActive(l.href) ? "text-[#E6E8E4]" : "")}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      {/* Mobile nav panel */}
      {open && (
        <nav className="border-t border-line bg-ink/95 px-4 py-2 lg:hidden">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={
                "block rounded-md px-2 py-2.5 text-sm hover:bg-copper/10 " +
                (isActive(l.href) ? "text-copper-soft" : "text-[#E6E8E4]")
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
