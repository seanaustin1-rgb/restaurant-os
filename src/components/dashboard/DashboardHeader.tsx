"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ChevronDown, FlaskConical, Menu, X } from "lucide-react";
import type { RoleKey } from "@/lib/mock/dashboard";
import { NAV_LINKS } from "@/lib/nav";

interface RestaurantOption {
  id: string;
  name: string;
}

const ROLES: RoleKey[] = ["OPERATOR", "CONSULTANT", "INVESTOR", "MANAGER"];

export function DashboardHeader({
  restaurants,
  activeId,
  onSelectRestaurant,
  role,
  onSelectRole,
  roleOptions = ROLES,
  demoMode = false,
}: {
  restaurants: RestaurantOption[];
  activeId: string;
  onSelectRestaurant: (id: string) => void;
  role: RoleKey;
  onSelectRole: (r: RoleKey) => void;
  roleOptions?: RoleKey[];
  demoMode?: boolean;
}) {
  const active = restaurants.find((r) => r.id === activeId) ?? restaurants[0];
  const [navOpen, setNavOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {/* Nav lives in a single dropdown menu at every size, so the top line
              stays uncluttered (logo · restaurant · …). Hidden in the public demo,
              where its links point to account-gated pages. */}
          {!demoMode && (
            <button
              onClick={() => setNavOpen((o) => !o)}
              aria-label={navOpen ? "Close menu" : "Open menu"}
              aria-expanded={navOpen}
              className="rounded-md border border-line bg-surface p-1.5 text-ink-text hover:border-copper-dim"
            >
              {navOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="OutFront Data" className="hidden h-7 w-auto shrink-0 sm:block" />
          <span className="hidden text-line sm:inline">/</span>
          <Dropdown
            label={active.name}
            items={restaurants.map((r) => ({ key: r.id, label: r.name }))}
            onPick={onSelectRestaurant}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-copper-dim bg-copper/10 px-2 py-1 text-xs font-medium text-copper-soft sm:px-3">
            <FlaskConical size={13} /> <span className="hidden sm:inline">Simulation</span>
          </span>
          <Dropdown
            label={titleCase(role)}
            items={roleOptions.map((r) => ({ key: r, label: titleCase(r) }))}
            onPick={(k) => onSelectRole(k as RoleKey)}
          />
          {!demoMode && <UserButton afterSignOutUrl="/" />}
        </div>
      </div>

      {/* Nav menu panel */}
      {navOpen && (
        <nav className="border-t border-line bg-ink/95 px-4 py-2 sm:px-6">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setNavOpen(false)}
                className="block rounded-md px-2 py-2.5 text-sm text-ink-text hover:bg-copper/10"
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

function Dropdown({
  label,
  items,
  onPick,
}: {
  label: string;
  items: { key: string; label: string }[];
  onPick: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);

  // Esc closes the menu — a keyboard user must be able to escape it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative min-w-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex min-h-[36px] max-w-[40vw] items-center gap-1.5 truncate rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink-text hover:border-copper-dim focus-visible:border-copper-soft focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-copper-soft sm:max-w-none"
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={14} className="shrink-0 text-muted" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" aria-hidden onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 z-20 mt-1 min-w-[180px] overflow-hidden rounded-md border border-line bg-surface shadow-lg">
            {items.map((it) => (
              <button
                key={it.key}
                role="menuitem"
                onClick={() => {
                  onPick(it.key);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-ink-text hover:bg-copper/10 focus-visible:bg-copper/10 focus-visible:outline-none"
              >
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
