"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { FeedInput, FeedLesson } from "@/lib/team/feed";
import { TeamPlayer } from "./player";

export function TeamFeed({ initial, input, unseenIds }: { initial: { lessons: FeedLesson[]; cursor: string | null; asOf: string }; input: FeedInput; unseenIds: string[] }) {
  const [lessons, setLessons] = useState(initial.lessons), [cursor, setCursor] = useState(initial.cursor);
  const [loading, setLoading] = useState(false), [error, setError] = useState("");
  const seen = useRef(new Set<string>()), marked = useRef(false);
  const browsing = !(input.q?.trim() || input.category || input.tag);
  const visitBody = JSON.stringify({ restaurantId: input.restaurantId, asOf: initial.asOf });
  function markSeen() {
    if (!browsing || marked.current) return;
    marked.current = true;
    if (!navigator.sendBeacon("/api/team/feed/seen", new Blob([visitBody], { type: "application/json" }))) {
      void fetch("/api/team/feed/seen", { method: "POST", headers: { "Content-Type": "application/json" }, body: visitBody, keepalive: true });
    }
  }
  const markRef = useRef(markSeen); markRef.current = markSeen;
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    const leave = () => markRef.current();
    const hide = () => { if (document.hidden) leave(); };
    window.addEventListener("pagehide", leave); document.addEventListener("visibilitychange", hide);
    return () => { leaveTimer.current = setTimeout(leave, 0); window.removeEventListener("pagehide", leave); document.removeEventListener("visibilitychange", hide); };
  }, []);
  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ restaurantId: input.restaurantId, cursor, asOf: initial.asOf });
      if (input.q) params.set("q", input.q); if (input.category) params.set("category", input.category); if (input.tag) params.set("tag", input.tag);
      const response = await fetch("/api/team/feed?" + params, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load more lessons.");
      const next = await response.json() as typeof initial;
      setLessons(current => [...current, ...next.lessons.filter(row => !current.some(existing => existing.id === row.id))]); setCursor(next.cursor);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load lessons."); }
    finally { setLoading(false); }
  }
  if (!lessons.length) return <p className="rounded-lg border border-line bg-surface p-6 text-sm text-muted">{browsing ? "You’re caught up. New lessons will appear here." : "No lessons match these filters."}</p>;
  return <div className="space-y-3">
    <div aria-label="Team lessons" tabIndex={0} className="h-[75dvh] min-h-[360px] snap-y snap-mandatory overflow-y-auto overscroll-y-contain rounded-xl border border-line bg-black">
      {lessons.map(lesson => <article key={lesson.id} className="relative h-full w-full snap-start snap-always">
        <TeamPlayer restaurantId={input.restaurantId} lessonId={lesson.id} title={lesson.title} version={lesson.version}
          onVisible={id => { seen.current.add(id); if (unseenIds.length && unseenIds.every(item => seen.current.has(item))) markSeen(); }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-16 bg-gradient-to-t from-black/95 via-black/65 to-transparent px-5 pb-3 pt-12 text-white">
          <p className="text-xs uppercase tracking-widest text-copper-soft">{lesson.category}{lesson.managersOnly ? " · Managers only" : ""}</p>
          <h2 className="mt-1 font-display text-2xl">{lesson.title}</h2>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed">{lesson.takeaway}</p>
          <Link className="pointer-events-auto mt-3 inline-flex min-h-11 items-center text-sm text-copper-soft underline" href={`/team/learn/${lesson.id}?restaurantId=${encodeURIComponent(input.restaurantId)}`}>Open lesson & takeaway</Link>
        </div>
      </article>)}
      {cursor && <div className="flex h-full snap-start items-center justify-center p-5"><button className="min-h-11 rounded bg-copper px-5 py-3 text-ink disabled:opacity-50" disabled={loading} onClick={() => void loadMore()}>{loading ? "Loading…" : "More lessons"}</button>{error && <p role="alert" className="ml-3 text-sm text-red-300">{error}</p>}</div>}
    </div>
    <p className="text-xs text-muted">Swipe up for the next lesson. Captions are on when available.</p>
  </div>;
}
