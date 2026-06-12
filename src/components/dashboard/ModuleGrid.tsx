import Link from "next/link";
import { ArrowUpRight, Lock } from "lucide-react";
import { MODULES } from "@/lib/modules";

// Module launcher. Live modules are clickable and open their page; modules that
// aren't built yet are shown as disabled tiles tagged with what unblocks them —
// honest, never a dead control.
export function ModuleGrid() {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-lg text-copper-soft">Modules</h2>
        <span className="text-xs text-muted">{MODULES.filter((m) => m.status === "live").length} live</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {MODULES.map((m) =>
          m.status === "live" && m.href ? (
            <Link
              key={m.key}
              href={m.href}
              className="group relative rounded-lg border border-line bg-surface p-4 transition-colors hover:border-copper-dim"
            >
              <ArrowUpRight size={14} className="absolute right-3 top-3 text-muted transition-colors group-hover:text-copper-soft" />
              <div className="font-display text-base text-[#E6E8E4]">{m.name}</div>
              <div className="mt-1 text-xs text-muted">{m.description}</div>
            </Link>
          ) : (
            <div key={m.key} className="relative rounded-lg border border-line/70 bg-surface/50 p-4" aria-disabled>
              <span
                className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-line px-1.5 py-0.5 text-[10px] text-muted"
                title={`Coming soon — needs: ${m.blockedBy}`}
              >
                <Lock size={9} /> {m.blockedBy}
              </span>
              <div className="font-display text-base text-muted">{m.name}</div>
              <div className="mt-1 text-xs text-muted/70">{m.description}</div>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
