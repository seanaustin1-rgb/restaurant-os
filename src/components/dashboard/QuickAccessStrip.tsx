"use client";

import Link from "next/link";
import { GripVertical, X, Star } from "lucide-react";
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
  horizontalListSortingStrategy,
  arrayMove,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ModuleDef } from "@/lib/modules";

// The pinned "Quick Access" strip at the very top of the dashboard. Shows the
// modules the user has pinned (★) as compact, drag-reorderable chips — one click
// away, no scrolling past the financial sections. Controlled by DashboardView.
export function QuickAccessStrip({
  items,
  onReorder,
  onUnpin,
}: {
  items: ModuleDef[];
  onReorder: (keys: string[]) => void;
  onUnpin: (key: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((m) => m.key === active.id);
    const to = items.findIndex((m) => m.key === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to).map((m) => m.key));
  }

  return (
    <section className="rounded-lg border border-line bg-surface/60 px-3 py-2.5">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
        <Star size={11} className="fill-copper-soft text-copper-soft" /> Quick Access
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted/70">
          Pin a module with the <Star size={11} className="-mt-0.5 inline fill-copper-soft text-copper-soft" /> below to
          keep it one click away here.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((m) => m.key)} strategy={horizontalListSortingStrategy}>
            <div className="flex flex-wrap gap-2">
              {items.map((m) => (
                <PinnedChip key={m.key} m={m} onUnpin={onUnpin} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

function PinnedChip({ m, onUnpin }: { m: ModuleDef; onUnpin: (key: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: m.key });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-[#E6E8E4] hover:border-copper-dim"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${m.name}`}
        className="cursor-grab touch-none text-muted/50 hover:text-copper-soft active:cursor-grabbing"
      >
        <GripVertical size={13} />
      </button>
      <Link href={m.href ?? "#"} className="font-display">
        {m.name}
      </Link>
      <button
        type="button"
        onClick={() => onUnpin(m.key)}
        aria-label={`Unpin ${m.name}`}
        className="rounded text-muted/50 hover:text-health-red"
      >
        <X size={13} />
      </button>
    </div>
  );
}
