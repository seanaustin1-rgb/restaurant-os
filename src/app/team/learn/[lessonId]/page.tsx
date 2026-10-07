import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamAccessDenied } from "@/lib/team/access";
import { listMyTeamTenants } from "@/lib/team/tenants";
import { readTeamLesson } from "@/lib/team/feed";
import { TeamPlayer } from "../../player";
export const dynamic = "force-dynamic";
export default async function LessonPage({ params, searchParams }: { params: { lessonId: string }; searchParams: { restaurantId?: string } }) {
  let restaurantId = searchParams.restaurantId;
  let lesson;
  if (restaurantId) {
    lesson = await readTeamLesson(restaurantId, params.lessonId).catch((error: unknown) => { if (error instanceof TeamAccessDenied) notFound(); throw error; });
  } else {
    // A bare stable link resolves only among positively authorized tenants.
    for (const tenant of await listMyTeamTenants()) {
      const candidate = await readTeamLesson(tenant.id, params.lessonId);
      if (candidate) { restaurantId = tenant.id; lesson = candidate; break; }
    }
  }
  if (!lesson || !restaurantId) notFound();
  return <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
    <Link className="inline-flex min-h-11 items-center text-sm text-copper-soft" href={`/team?restaurantId=${encodeURIComponent(restaurantId)}`}>← Team Hub</Link>
    <header><p className="text-xs uppercase tracking-widest text-copper-soft">{lesson.category}{lesson.managersOnly ? " · Managers only" : ""}</p><h1 className="mt-2 font-display text-3xl">{lesson.title}</h1></header>
    <div className="h-[65dvh] min-h-[360px] overflow-hidden rounded-xl border border-line">
      <TeamPlayer restaurantId={restaurantId} lessonId={lesson.id} title={lesson.title} version={lesson.version} />
    </div>
    {!lesson.mediaAsset?.hasCaptions && <p className="text-xs text-muted">Captions are not available yet. The written takeaway is below.</p>}
    <section className="rounded-lg border border-line bg-surface p-5"><h2 className="font-display text-xl">Your takeaway</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{lesson.takeaway}</p></section>
    <div className="flex flex-wrap gap-2">{lesson.tags.map(tag => <Link key={tag} className="min-h-11 rounded-full border border-line px-3 py-3 text-xs text-copper-soft" href={`/team?restaurantId=${encodeURIComponent(restaurantId)}&tag=${encodeURIComponent(tag)}`}>#{tag}</Link>)}</div>
  </main>;
}
