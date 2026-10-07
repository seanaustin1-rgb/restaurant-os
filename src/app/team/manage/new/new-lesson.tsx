"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { TeamDept, TeamLessonType } from "@prisma/client";
import { uploadTeamVideo } from "@/lib/team/media/upload-client";
import { saveLesson, publishLesson, lessonUploadStatus } from "./actions";

const depts: TeamDept[] = ["FOH", "BOH", "BAR", "BAKERY", "MGMT"];
const types: TeamLessonType[] = ["SHIFT_BRIEF", "HOSPITALITY", "PRODUCT", "UPDATE", "MOMENT"];
const field = "mt-1 w-full rounded-md border border-line bg-ink px-3 py-3 text-base";
const button = "min-h-11 rounded-md bg-copper px-4 py-3 text-sm font-medium text-ink disabled:opacity-50";
export function NewLesson({ restaurantId, isManager }: { restaurantId: string; isManager: boolean }) {
  const [file, setFile] = useState<File | null>(null), [upload, setUpload] = useState<{ assetId: string; uploadUrl: string } | null>(null);
  const [percent, setPercent] = useState(0), [uploading, setUploading] = useState(false), [uploadDone, setUploadDone] = useState(false);
  const [type, setType] = useState<TeamLessonType>("SHIFT_BRIEF"), [title, setTitle] = useState(""), [takeaway, setTakeaway] = useState("");
  const [category, setCategory] = useState("Pre-shift"), [tags, setTags] = useState(""), [audience, setAudience] = useState<TeamDept[]>([]);
  const [managersOnly, setManagersOnly] = useState(false), [lessonId, setLessonId] = useState<string | null>(null);
  const [status, setStatus] = useState(""), [lessonStatus, setLessonStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!upload || !uploadDone || lessonStatus === "PUBLISHED" || status === "FAILED") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const result = await lessonUploadStatus(restaurantId, upload.assetId, lessonId ?? undefined);
        if (!cancelled) { setStatus(result.status); setLessonStatus(result.lessonStatus); }
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not check upload."); }
    };
    void poll(); const timer = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [upload, uploadDone, restaurantId, lessonId, lessonStatus, status]);
  async function beginUpload(selected: File, resume = upload) {
    setError(""); setUploading(true); setFile(selected);
    const abort = new AbortController(); controller.current = abort;
    try {
      let target = resume;
      if (!target) {
        const response = await fetch("/api/team/media/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, byteLength: selected.size }), signal: abort.signal });
        if (!response.ok) throw new Error("Could not start upload. Check your Team access and try again.");
        target = await response.json() as { assetId: string; uploadUrl: string };
        setUpload(target); setStatus("UPLOADING");
      }
      await uploadTeamVideo(selected, target.uploadUrl, setPercent, abort.signal);
      setUploadDone(true); setStatus("PROCESSING");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Upload interrupted."); }
    finally { setUploading(false); }
  }
  async function save(publishWhenReady: boolean) {
    if (!upload) return;
    setBusy(true); setError("");
    try {
      const id = await saveLesson({ restaurantId, assetId: upload.assetId, type, title, takeaway, category,
        tags: tags.split(",").map(tag => tag.trim()).filter(Boolean), audience, managersOnly, publishWhenReady });
      setLessonId(id); setLessonStatus(publishWhenReady ? "REVIEW" : "DRAFT");
      setNotice(publishWhenReady ? "Saved. Your lesson will publish when the video is ready." : "Draft saved. A manager can publish when the video is ready.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save lesson."); }
    finally { setBusy(false); }
  }
  const link = lessonId ? `/team/learn/${lessonId}?restaurantId=${encodeURIComponent(restaurantId)}` : "";
  return <div className="space-y-5">
    <section className="rounded-lg border border-line bg-surface p-4">
      <label className="block text-sm font-medium">Video
        <input className="mt-3 block w-full text-sm" type="file" accept="video/*" disabled={uploading || !!lessonId}
          onChange={event => { const selected = event.target.files?.[0]; if (selected) { setUpload(null); setUploadDone(false); setPercent(0); void beginUpload(selected, null); } }} />
      </label>
      {upload && <><progress className="mt-4 w-full accent-copper" value={percent} max={100} aria-label="Video upload" /><p className="mt-1 text-sm text-muted">{percent}% uploaded · {status.toLowerCase()}</p></>}
      {file && upload && !uploading && !uploadDone && <button className={button + " mt-3"} onClick={() => void beginUpload(file)}>Resume upload</button>}
      {uploading && <button className="mt-3 min-h-11 text-sm underline" onClick={() => controller.current?.abort()}>Pause upload</button>}
      {status === "FAILED" && <p role="alert" className="mt-2 text-sm text-red-300">Video processing failed. Start a new lesson with another video.</p>}
    </section>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save(false); }}>
      <fieldset disabled={!!lessonId || busy} className="space-y-4">
        <label className="block text-sm">Type<select className={field} value={type} onChange={event => setType(event.target.value as TeamLessonType)}>{types.map(item => <option key={item} value={item}>{item.toLowerCase().replaceAll("_", " ")}</option>)}</select></label>
        <label className="block text-sm">Title<input required maxLength={160} className={field} value={title} onChange={event => setTitle(event.target.value)} /></label>
        <label className="block text-sm">Written takeaway<textarea required maxLength={2000} rows={3} className={field} value={takeaway} onChange={event => setTakeaway(event.target.value)} placeholder="One thing to remember this shift" /></label>
        <label className="block text-sm">Category<input required maxLength={80} className={field} value={category} onChange={event => setCategory(event.target.value)} /></label>
        <label className="block text-sm">Tags<input className={field} value={tags} onChange={event => setTags(event.target.value)} placeholder="Comma-separated, e.g. hospitality, whiskey" /></label>
        <fieldset><legend className="text-sm">Audience <span className="text-muted">(none selected = everyone)</span></legend><div className="mt-2 flex flex-wrap gap-3">{depts.map(dept => <label key={dept} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={audience.includes(dept)} onChange={() => setAudience(current => current.includes(dept) ? current.filter(item => item !== dept) : [...current, dept])} />{dept}</label>)}</div></fieldset>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={managersOnly} onChange={event => setManagersOnly(event.target.checked)} />Managers only</label>
      </fieldset>
      {!lessonId && <div className="flex flex-wrap gap-3">
        <button className={button} disabled={!uploadDone || busy || status === "FAILED"} type="submit">Save draft</button>
        {isManager && <button className={button} disabled={!uploadDone || busy || status === "FAILED" || !title.trim() || !takeaway.trim() || !category.trim()} type="button" onClick={() => void save(true)}>{status === "READY" ? "Publish" : "Publish when ready"}</button>}
      </div>}
    </form>
    {lessonId && isManager && status === "READY" && lessonStatus === "DRAFT" && <button disabled={busy} className={button} onClick={async () => {
      setBusy(true); setError(""); try { await publishLesson(restaurantId, lessonId); setLessonStatus("PUBLISHED"); setNotice("Published."); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Could not publish."); } finally { setBusy(false); }
    }}>Publish</button>}
    {status === "FAILED" && lessonId && <Link className="inline-flex min-h-11 items-center text-sm text-copper-soft underline" href={`/team/manage/new?restaurantId=${encodeURIComponent(restaurantId)}`}>Start a new lesson</Link>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {notice && <p role="status" className="text-sm text-copper-soft">{notice}</p>}
    {lessonId && <section className="space-y-3 rounded-lg border border-copper-dim bg-surface p-4">
      <p className="text-sm">{lessonStatus === "PUBLISHED" ? "Published · Ready to share in Sling" : "Link saved · Staff can open it after publication"}</p>
      <input aria-label="Lesson link" readOnly value={typeof window === "undefined" ? link : new URL(link, window.location.origin).href} className={field} onFocus={event => event.target.select()} />
      <button className={button} onClick={async () => { try { await navigator.clipboard.writeText(new URL(link, window.location.origin).href); setNotice("Link copied."); } catch { setError("Select the link above and copy it."); } }}>Copy link</button>
      {lessonStatus === "PUBLISHED" && <Link className="ml-4 text-sm text-copper-soft underline" href={link}>Open lesson</Link>}
    </section>}
  </div>;
}
