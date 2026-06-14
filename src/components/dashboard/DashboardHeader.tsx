"use client";

import { useState } from "react";
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
}: {
  restaurants: RestaurantOption[];
  activeId: string;
  onSelectRestaurant: (id: string) => void;
  role: RoleKey;
  onSelectRole: (r: RoleKey) => void;
}) {
  const active = restaurants.find((r) => r.id === activeId) ?? restaurants[0];
  const [navOpen, setNavOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {/* Nav lives in a single dropdown menu at every size, so the top line
              stays uncluttered (logo · restaurant · …). */}
          <button
            onClick={() => setNavOpen((o) => !o)}
            aria-label={navOpen ? "Close menu" : "Open menu"}
            aria-expanded={navOpen}
            className="rounded-md border border-line bg-surface p-1.5 text-[#E6E8E4] hover:border-copper-dim"
          >
            {navOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
          <span className="hidden shrink-0 whitespace-nowrap font-display text-xl font-semibold text-copper sm:inline">Restaurant OS</span>
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
            items={ROLES.map((r) => ({ key: r, label: titleCase(r) }))}
            onPick={(k) => onSelectRole(k as RoleKey)}
          />
          <UserButton afterSignOutUrl="/" />
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
                className="block rounded-md px-2 py-2.5 text-sm text-[#E6E8E4] hover:bg-copper/10"
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
  return (
    <div className="relative min-w-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex max-w-[40vw] items-center gap-1.5 truncate rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-[#E6E8E4] hover:border-copper-dim sm:max-w-none"
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={14} className="shrink-0 text-muted" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 min-w-[180px] overflow-hidden rounded-md border border-line bg-surface shadow-lg">
            {items.map((it) => (
              <button
                key={it.key}
                onClick={() => {
                  onPick(it.key);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-[#E6E8E4] hover:bg-copper/10"
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
