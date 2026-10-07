import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeamAccess, TeamAccessDenied } from "@/lib/team/access";
import { listMyTeamTenants } from "@/lib/team/tenants";
import { loadTeamFeed, teamFeedSummary, type FeedInput } from "@/lib/team/feed";
import { TeamFeed } from "./feed";
export const dynamic = "force-dynamic";
export default async function TeamPage({ searchParams }: { searchParams: { restaurantId?: string; q?: string; category?: string; tag?: string } }) {
  const restaurantId = searchParams.restaurantId;
  const tenants = await listMyTeamTenants();
  if (!restaurantId) return <main className="mx-auto max-w-3xl space-y-5 px-5 py-10">
    <h1 className="font-display text-3xl">Team Hub</h1>
    <p className="text-sm text-muted">{tenants.length ? "Choose a team to open." : "No active Team access. Ask your manager if you expected to see your team here."}</p>
    {tenants.map(tenant => <Link key={tenant.id} href={`/team?restaurantId=${encodeURIComponent(tenant.id)}`} className="block rounded-lg border border-line bg-surface px-5 py-4 hover:border-copper-dim">{tenant.name}</Link>)}
  </main>;
  const viewer = await requireTeamAccess(restaurantId).catch((error: unknown) => { if (error instanceof TeamAccessDenied) notFound(); throw error; });
  const now = new Date(), input: FeedInput = { ...searchParams, restaurantId, asOf: now.toISOString() };
  const [initial, summary] = await Promise.all([loadTeamFeed(input), teamFeedSummary(restaurantId, now)]);
  const chip = (name: "category" | "tag", value: string) => {
    const params = new URLSearchParams({ restaurantId });
    if (searchParams.q) params.set("q", searchParams.q);
    if (searchParams.category) params.set("category", searchParams.category);
    if (searchParams.tag) params.set("tag", searchParams.tag);
    if (params.get(name) === value) params.delete(name); else params.set(name, value);
    return "/team?" + params;
  };
  return <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs uppercase tracking-widest text-copper-soft">Team Hub</p><h1 className="mt-1 font-display text-3xl">{tenants.find(row => row.id === restaurantId)?.name ?? "Your team"}</h1>
        <p className="mt-2 text-sm text-muted">Since your last visit: {summary.count} updates · ~{summary.minutes} min</p></div>
      <nav className="flex flex-wrap gap-3 text-sm text-copper-soft">
        {viewer.role !== "MEMBER" && <Link className="min-h-11 rounded border border-copper-dim px-3 py-3" href={`/team/manage/new?restaurantId=${encodeURIComponent(restaurantId)}`}>New lesson</Link>}
        {viewer.role === "MANAGER" && <Link className="min-h-11 px-2 py-3 underline" href={`/team/manage?restaurantId=${encodeURIComponent(restaurantId)}`}>Roster</Link>}
      </nav>
    </header>
    <form className="flex gap-2" method="get">
      <input type="hidden" name="restaurantId" value={restaurantId} />
      {searchParams.category && <input type="hidden" name="category" value={searchParams.category} />}
      {searchParams.tag && <input type="hidden" name="tag" value={searchParams.tag} />}
      <input aria-label="Search lessons" name="q" defaultValue={searchParams.q} placeholder="Search titles, takeaways, tags" maxLength={200} className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-3 text-base" />
      <button className="min-h-11 rounded-md bg-copper px-4 text-sm font-medium text-ink">Search</button>
    </form>
    <div className="flex flex-wrap gap-2" aria-label="Lesson filters">
      <Link className="min-h-11 rounded-full border border-line px-3 py-3 text-xs" href={`/team?restaurantId=${encodeURIComponent(restaurantId)}`}>Newest / clear filters</Link>
      {summary.categories.map(value => <Link aria-current={searchParams.category === value ? "true" : undefined} key={"c:" + value} href={chip("category", value)} className={`min-h-11 rounded-full border px-3 py-3 text-xs ${searchParams.category === value ? "border-copper bg-copper/15 text-copper-soft" : "border-line"}`}>{value}</Link>)}
      {summary.tags.map(value => <Link aria-current={searchParams.tag === value ? "true" : undefined} key={"t:" + value} href={chip("tag", value)} className={`min-h-11 rounded-full border px-3 py-3 text-xs ${searchParams.tag === value ? "border-copper bg-copper/15 text-copper-soft" : "border-line"}`}>#{value}</Link>)}
    </div>
    <TeamFeed key={JSON.stringify(searchParams)} initial={initial} input={input} unseenIds={summary.unseenIds} />
  </main>;
}
