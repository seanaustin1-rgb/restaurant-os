"use client";

import Link from "next/link";
import { useState } from "react";
import { Lock, GripVertical, Info, Star } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MODULES, type ModuleDef } from "@/lib/modules";

// Module launcher — a drag-to-reorder grid. Live modules open their page and can
// be pinned (★) to the top Quick Access strip; modules that aren't built yet are
// honest disabled tiles tagged with what unblocks them. Controlled by
// DashboardView, which owns the order + pinned state and its persistence.
export function ModuleGrid({
  items,
  pinnedKeys,
  onReorder,
  onTogglePin,
  demoMode = false,
}: {
  items: ModuleDef[];
  pinnedKeys: Set<string>;
  onReorder: (next: ModuleDef[]) => void;
  onTogglePin: (key: string) => void;
  demoMode?: boolean;
}) {
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const sensors = useSensors(
    // A small drag threshold so a click still navigates; only a deliberate drag reorders.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((m) => m.key === active.id);
    const to = items.findIndex((m) => m.key === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to));
  }

  // Public demo: a static, non-interactive showcase — the tiles point to
  // account-gated pages, so they read-only here (no links, drag, or pinning).
  if (demoMode) {
    return (
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-lg text-[#E6E8E4]">Modules</h2>
          <span className="text-xs text-muted">
            {MODULES.filter((m) => m.status === "live").length} live · sign up to open
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((m) => {
            const live = m.status === "live" && m.href;
            return (
              <div
                key={m.key}
                className={
                  "relative rounded-lg border p-4 " +
                  (live ? "border-line bg-surface" : "border-line/70 bg-surface/50")
                }
              >
                {!live && (
                  <span
                    className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-line px-1.5 py-0.5 text-[10px] text-muted"
                    title={`Coming soon — needs: ${m.blockedBy}`}
                  >
                    <Lock size={9} /> {m.blockedBy}
                  </span>
                )}
                <div className={"font-display text-base " + (live ? "text-[#E6E8E4]" : "text-muted")}>{m.name}</div>
                <div className="mt-1 flex items-start gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOpenInfo((current) => (current === m.key ? null : m.key))}
                    className="mt-0.5 shrink-0 rounded-full text-muted/70 hover:text-copper-soft"
                    title={moduleExplainer(m)}
                    aria-expanded={openInfo === m.key}
                    aria-label={`What ${m.name} shows`}
                  >
                    <Info size={12} />
                  </button>
                  <div className={"text-xs " + (live ? "text-muted" : "text-muted/70")}>{m.description}</div>
                </div>
                {openInfo === m.key && (
                  <div className="mt-2 rounded-md border border-line bg-ink/60 px-2 py-2 text-[11px] leading-relaxed text-[#CFD2CC]">
                    {moduleExplainer(m)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-lg text-[#E6E8E4]">Modules</h2>
        <span className="text-xs text-muted">
          drag to reorder · ★ to pin · {MODULES.filter((m) => m.status === "live").length} live
        </span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((m) => m.key)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((m) => (
              <SortableTile key={m.key} m={m} pinned={pinnedKeys.has(m.key)} onTogglePin={onTogglePin} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function moduleExplainer(m: ModuleDef): string {
  if (m.status !== "live") {
    return `${m.name} is planned. It will light up when ${m.blockedBy ?? "the required data source"} is connected.`;
  }
  return `${m.name} shows ${m.description.toLowerCase()}. In a live account, this opens the full module detail page.`;
}

function SortableTile({
  m,
  pinned,
  onTogglePin,
}: {
  m: ModuleDef;
  pinned: boolean;
  onTogglePin: (key: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: m.key });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };
  const live = m.status === "live" && m.href;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        "group relative rounded-lg border p-4 transition-colors " +
        (live ? "border-line bg-surface hover:border-copper-dim" : "border-line/70 bg-surface/50")
      }
    >
      {/* Drag handle — only this starts a drag, so the tile body stays clickable. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${m.name}`}
        className="absolute left-2 top-2 cursor-grab touch-none rounded p-0.5 text-muted/50 hover:text-copper-soft active:cursor-grabbing"
      >
        <GripVertical size={13} />
      </button>

      {/* Pin toggle (live modules only) — adds/removes from the Quick Access strip. */}
      {live && (
        <button
          type="button"
          onClick={() => onTogglePin(m.key)}
          aria-label={pinned ? `Unpin ${m.name}` : `Pin ${m.name} to Quick Access`}
          aria-pressed={pinned}
          className={
            "absolute right-2 top-2 rounded p-0.5 " +
            (pinned ? "text-copper-soft" : "text-muted/40 hover:text-copper-soft")
          }
        >
          <Star size={14} className={pinned ? "fill-copper-soft" : ""} />
        </button>
      )}

      {live ? (
        <Link href={m.href!} className="block px-5">
          <div className="font-display text-base text-[#E6E8E4]">{m.name}</div>
          <div className="mt-1 text-xs text-muted">{m.description}</div>
        </Link>
      ) : (
        <div className="pl-5" aria-disabled>
          <span
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-line px-1.5 py-0.5 text-[10px] text-muted"
            title={`Coming soon — needs: ${m.blockedBy}`}
          >
            <Lock size={9} /> {m.blockedBy}
          </span>
          <div className="font-display text-base text-muted">{m.name}</div>
          <div className="mt-1 text-xs text-muted/70">{m.description}</div>
        </div>
      )}
    </div>
  );
}
