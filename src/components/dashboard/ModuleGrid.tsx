"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Lock, GripVertical } from "lucide-react";
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
import { orderModules } from "@/lib/dashboard/module-order";
import { saveModuleOrder } from "@/app/dashboard/actions";

// Module launcher — a drag-to-reorder grid. The chosen order is saved to the
// user's account (persists across devices). Live modules open their page; ones
// that aren't built yet are honest disabled tiles tagged with what unblocks them.
export function ModuleGrid({ initialOrder }: { initialOrder: string[] | null }) {
  const [modules, setModules] = useState<ModuleDef[]>(() => orderModules(initialOrder));

  const sensors = useSensors(
    // A small drag threshold so a click still navigates; only a deliberate drag reorders.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setModules((items) => {
      const from = items.findIndex((m) => m.key === active.id);
      const to = items.findIndex((m) => m.key === over.id);
      if (from < 0 || to < 0) return items;
      const next = arrayMove(items, from, to);
      // Optimistic: UI already shows `next`; persist in the background.
      void saveModuleOrder(next.map((m) => m.key)).catch(() => {});
      return next;
    });
  }

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-lg text-copper-soft">Modules</h2>
        <span className="text-xs text-muted">
          drag to reorder · {MODULES.filter((m) => m.status === "live").length} live
        </span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={modules.map((m) => m.key)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {modules.map((m) => (
              <SortableTile key={m.key} m={m} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function SortableTile({ m }: { m: ModuleDef }) {
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

      {live ? (
        <Link href={m.href!} className="block pl-5">
          <ArrowUpRight
            size={14}
            className="absolute right-3 top-3 text-muted transition-colors group-hover:text-copper-soft"
          />
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
