import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeamAccess, TeamAccessDenied } from "@/lib/team/access";
import { listMyTeamTenants } from "@/lib/team/tenants";
import { LessonDrafts } from "./drafts";
import { loadLessonDrafts } from "./actions";
import { NewLesson } from "./new-lesson";
export const dynamic = "force-dynamic";
export default async function NewLessonPage({ searchParams }: { searchParams: { restaurantId?: string } }) {
  const restaurantId = searchParams.restaurantId;
  if (!restaurantId) {
    const tenants = (await listMyTeamTenants()).filter(row => row.viewer.role !== "MEMBER");
    return <main className="mx-auto max-w-xl space-y-4 px-5 py-8"><h1 className="font-display text-3xl">New lesson</h1>
      {tenants.map(row => <Link className="block rounded-lg border border-line p-4" key={row.id} href={`/team/manage/new?restaurantId=${encodeURIComponent(row.id)}`}>{row.name}</Link>)}
      {!tenants.length && <p className="text-muted">You need contributor or manager access.</p>}</main>;
  }
  const viewer = await requireTeamAccess(restaurantId, "CONTRIBUTOR").catch((error: unknown) => {
    if (error instanceof TeamAccessDenied) notFound(); throw error;
  });
  const drafts = await loadLessonDrafts(restaurantId);
  return <main className="mx-auto max-w-xl space-y-6 px-5 py-8">
    <Link className="text-sm text-copper-soft" href={`/team?restaurantId=${encodeURIComponent(restaurantId)}`}>← Team Hub</Link>
    <header><p className="text-xs uppercase tracking-widest text-copper-soft">Team Hub</p><h1 className="mt-2 font-display text-3xl">New lesson</h1>
      <p className="mt-2 text-sm text-muted">Pick a video, add the takeaway, and share it with your team.</p></header>
    <NewLesson restaurantId={restaurantId} isManager={viewer.role === "MANAGER"} />
    <LessonDrafts restaurantId={restaurantId} isManager={viewer.role === "MANAGER"} initial={drafts} />
  </main>;
}
