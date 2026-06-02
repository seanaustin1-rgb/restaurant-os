"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { ADDABLE_MODULES, DEFAULT_MODULES, type ModuleDef } from "@/lib/mock/dashboard";

export function ModuleGrid({ editable }: { editable: boolean }) {
  const [active, setActive] = useState<ModuleDef[]>(DEFAULT_MODULES);
  const [picker, setPicker] = useState(false);

  const available = ADDABLE_MODULES.filter((m) => !active.some((a) => a.key === m.key));

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-lg text-copper-soft">Modules</h2>
        {editable && available.length > 0 && (
          <button
            onClick={() => setPicker((p) => !p)}
            className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1 text-xs text-[#E6E8E4] hover:border-copper-dim"
          >
            <Plus size={13} /> Add module
          </button>
        )}
      </div>

      {picker && (
        <div className="mb-3 flex flex-wrap gap-2 rounded-lg border border-line bg-surface p-3">
          {available.map((m) => (
            <button
              key={m.key}
              onClick={() => {
                setActive((a) => [...a, m]);
                setPicker(false);
              }}
              className="rounded-md border border-copper-dim bg-copper/10 px-2.5 py-1 text-xs text-copper-soft hover:bg-copper/20"
            >
              + {m.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {active.map((m) => (
          <div key={m.key} className="group relative rounded-lg border border-line bg-surface p-4">
            {editable && (
              <button
                onClick={() => setActive((a) => a.filter((x) => x.key !== m.key))}
                className="absolute right-2 top-2 text-muted opacity-0 transition-opacity hover:text-health-red group-hover:opacity-100"
                aria-label={`Remove ${m.name}`}
              >
                <X size={14} />
              </button>
            )}
            <div className="font-display text-base text-[#E6E8E4]">{m.name}</div>
            <div className="mt-1 text-xs text-muted">{m.description}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
