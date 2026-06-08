"use client";

import { useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ChevronDown, FlaskConical } from "lucide-react";
import type { RoleKey } from "@/lib/mock/dashboard";

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

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="font-display text-xl font-semibold text-copper">Restaurant OS</span>
          <span className="text-line">/</span>
          <Dropdown
            label={active.name}
            items={restaurants.map((r) => ({ key: r.id, label: r.name }))}
            onPick={onSelectRestaurant}
          />
          <nav className="ml-2 hidden items-center gap-1 text-sm text-muted md:flex">
            <Link href="/dashboard" className="rounded px-2 py-1 hover:text-[#E6E8E4]">Dashboard</Link>
            <Link href="/transactions" className="rounded px-2 py-1 hover:text-[#E6E8E4]">Transactions</Link>
            <Link href="/settings/categories" className="rounded px-2 py-1 hover:text-[#E6E8E4]">Categories</Link>
            <Link href="/connections" className="rounded px-2 py-1 hover:text-[#E6E8E4]">Connections</Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-copper-dim bg-copper/10 px-3 py-1 text-xs font-medium text-copper-soft">
            <FlaskConical size={13} /> Simulation
          </span>
          <Dropdown
            label={titleCase(role)}
            items={ROLES.map((r) => ({ key: r, label: titleCase(r) }))}
            onPick={(k) => onSelectRole(k as RoleKey)}
          />
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
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
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-[#E6E8E4] hover:border-copper-dim"
      >
        {label}
        <ChevronDown size={14} className="text-muted" />
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
