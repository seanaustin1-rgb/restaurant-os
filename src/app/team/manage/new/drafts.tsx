"use client";
import { useState } from "react";
import { loadLessonDrafts, publishLesson } from "./actions";
type Draft = Awaited<ReturnType<typeof loadLessonDrafts>>[number];
export function LessonDrafts({ restaurantId, isManager, initial }: { restaurantId: string; isManager: boolean; initial: Draft[] }) {
  const [drafts, setDrafts] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function refresh() {
    setBusy(true); setError("");
    try { setDrafts(await loadLessonDrafts(restaurantId)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not refresh drafts."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 border-t border-line pt-6">
    <div className="flex items-center justify-between gap-3"><h2 className="font-display text-xl">{isManager ? "Team drafts" : "Your drafts"}</h2>
      <button className="min-h-11 px-3 text-sm text-copper-soft underline" disabled={busy} onClick={() => void refresh()}>Refresh</button></div>
    {!drafts.length && <p className="text-sm text-muted">No drafts waiting.</p>}
    {drafts.map(draft => <article key={draft.id} className="space-y-3 rounded-lg border border-line bg-surface p-4">
      <h3 className="font-display text-lg">{draft.title}</h3><p className="whitespace-pre-wrap text-sm">{draft.takeaway}</p>
      <p className="text-xs text-muted">{draft.category} · {draft.managersOnly ? "Managers only" : draft.audience.join(" / ") || "Everyone"} · {draft.status.toLowerCase()} · video {draft.mediaAsset?.status.toLowerCase() ?? "missing"}</p>
      {isManager && <button className="min-h-11 rounded bg-copper px-4 py-3 text-sm text-ink disabled:opacity-50"
        disabled={busy || draft.mediaAsset?.status !== "READY"} onClick={async () => {
          setBusy(true); setError("");
          try { await publishLesson(restaurantId, draft.id); setDrafts(await loadLessonDrafts(restaurantId)); }
          catch (cause) { setError(cause instanceof Error ? cause.message : "Could not publish."); } finally { setBusy(false); }
        }}>Publish</button>}
      <button className="min-h-11 px-3 text-sm text-copper-soft underline" onClick={async () => {
        try { await navigator.clipboard.writeText(new URL(`/team/learn/${draft.id}?restaurantId=${encodeURIComponent(restaurantId)}`, window.location.origin).href); }
        catch { setError("Clipboard unavailable. Publish the lesson, then copy its address from the lesson page."); }
      }}>Copy lesson link</button>
    </article>)}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </section>;
}
