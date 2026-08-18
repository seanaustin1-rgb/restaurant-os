import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  filterSpiritAdminList,
  parseSpiritAdminListFilters,
  spiritAdminCategoryOptions,
  summarizeSpiritAdminList,
  type SpiritAdminListItem,
} from "@/lib/spirit-vault/admin-list";
import { vaultOperatorRoleWhere } from "@/lib/spirit-vault/admin-access";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "Published",
  REVIEWED: "Reviewed",
  DRAFT: "Draft",
};

function spiritName(item: {
  definition: { displayName: string | null; brand: string; expression: string | null };
}): string {
  return item.definition.displayName ?? [item.definition.brand, item.definition.expression].filter(Boolean).join(" ");
}

function verificationLabel(status: string): string {
  if (status === "PARTIALLY_SOURCED") return "Partially sourced";
  if (status === "SOURCED") return "Sourced";
  return "Unsourced";
}

function statusTone(item: Pick<SpiritAdminListItem, "recordStatus" | "publicationStatus">): string {
  if (item.recordStatus === "PUBLISHED" && item.publicationStatus === "PUBLISHED") return "text-health-green";
  if (item.recordStatus === "REVIEWED" || item.publicationStatus === "REVIEWED") return "text-copper-soft";
  return "text-muted";
}

function filterUrl(status: string): string {
  return status === "all" ? "/admin/spirit-vault" : `/admin/spirit-vault?status=${status}`;
}

export default async function SpiritVaultAdminPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: vaultOperatorRoleWhere(userId),
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  if (!role) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          The Spirit Vault editor is available to restaurant operators.
        </p>
      </main>
    );
  }

  const items = await prisma.venueSpirit.findMany({
    where: { restaurantId: role.restaurantId },
    orderBy: [{ publicationStatus: "asc" }, { slug: "asc" }],
    select: {
      id: true,
      recordStatus: true,
      publicationStatus: true,
      whyWeCarry: true,
      seanShort: true,
      notes: true,
      definition: {
        select: {
          brand: true,
          expression: true,
          displayName: true,
          category: true,
          verificationStatus: true,
          proofN: true,
          proofDisplay: true,
        },
      },
    },
  });

  const filters = parseSpiritAdminListFilters(searchParams);
  const listItems: SpiritAdminListItem[] = items.map((item) => ({
    id: item.id,
    name: spiritName(item),
    brand: item.definition.brand,
    expression: item.definition.expression,
    category: item.definition.category,
    recordStatus: item.recordStatus,
    publicationStatus: item.publicationStatus,
    verificationStatus: item.definition.verificationStatus,
    hasVoice: !!(item.whyWeCarry || item.seanShort || item.notes),
  }));
  const summary = summarizeSpiritAdminList(listItems);
  const categories = spiritAdminCategoryOptions(listItems);
  const filteredItems = filterSpiritAdminList(listItems, filters);
  const itemById = new Map(items.map((item) => [item.id, item]));

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Spirit Vault</h1>
        <p className="mt-1 text-sm text-muted">
          {role.restaurant?.name ?? "Your bar"} - edit dossiers, add your voice, and publish. Published records go live
          on the guest vault immediately.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
          <span className="rounded border border-line px-2 py-1">{summary.total} bottles</span>
          <span className="rounded border border-line px-2 py-1">{summary.live} live</span>
          <span className="rounded border border-line px-2 py-1">{summary.hidden} hidden</span>
          <span className="rounded border border-line px-2 py-1">{summary.missingVoice} awaiting voice</span>
          <span className="rounded border border-line px-2 py-1">{summary.unsourced} unsourced</span>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-line bg-surface p-3">
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            ["all", "All"],
            ["live", "Live"],
            ["hidden", "Hidden"],
            ["draft", "Draft"],
            ["reviewed", "Reviewed"],
          ].map(([value, label]) => (
            <Link
              key={value}
              href={filterUrl(value)}
              className={`rounded border px-2 py-1 ${
                filters.status === value
                  ? "border-copper-soft bg-copper/10 text-copper-soft"
                  : "border-line text-muted hover:text-ink-text"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_170px_160px_auto]" action="/admin/spirit-vault">
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Search bottle, brand, category"
            className="rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-ink-text outline-none focus:border-copper-soft"
          />
          <select
            name="category"
            defaultValue={filters.category}
            className="rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-ink-text outline-none focus:border-copper-soft"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={filters.status}
            className="rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-ink-text outline-none focus:border-copper-soft"
          >
            <option value="all">All statuses</option>
            <option value="live">Live only</option>
            <option value="hidden">Hidden from guests</option>
            <option value="draft">Draft</option>
            <option value="reviewed">Reviewed</option>
            <option value="published">Published status</option>
          </select>
          <select
            name="verification"
            defaultValue={filters.verification}
            className="rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-ink-text outline-none focus:border-copper-soft"
          >
            <option value="all">All sourcing</option>
            <option value="unsourced">Unsourced</option>
            <option value="partially-sourced">Partially sourced</option>
            <option value="sourced">Sourced</option>
          </select>
          <div className="flex gap-2">
            <select
              name="voice"
              defaultValue={filters.voice}
              className="min-w-28 rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-ink-text outline-none focus:border-copper-soft"
            >
              <option value="all">All voice</option>
              <option value="missing">Missing voice</option>
              <option value="present">Has voice</option>
            </select>
            <button className="rounded-md border border-copper-dim bg-copper/10 px-3 py-1.5 text-sm text-copper-soft hover:bg-copper/20">
              Filter
            </button>
          </div>
        </form>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            Showing {filteredItems.length} of {summary.total}
          </span>
          <Link href="/admin/spirit-vault" className="hover:text-copper-soft">
            Reset
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-3 py-2 font-medium">Bottle</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Proof</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Sourcing</th>
              <th className="px-3 py-2 font-medium">Voice</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((listItem) => {
              const i = itemById.get(listItem.id);
              if (!i) return null;
              const live = i.publicationStatus === "PUBLISHED" && i.recordStatus === "PUBLISHED";
              const hasVoice = !!(i.whyWeCarry || i.seanShort || i.notes);
              return (
                <tr key={i.id} className="border-b border-line/60 last:border-0 hover:bg-surface/60">
                  <td className="px-3 py-2">
                    <Link href={`/admin/spirit-vault/${i.id}`} className="text-ink-text hover:text-copper-soft">
                      {spiritName(i)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted">{i.definition.category}</td>
                  <td className="tnum px-3 py-2 text-muted">
                    {i.definition.proofN?.toString() ?? i.definition.proofDisplay ?? "-"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={statusTone(i)}>
                      {live
                        ? "Live"
                        : `${STATUS_LABEL[i.recordStatus] ?? i.recordStatus} / ${
                            STATUS_LABEL[i.publicationStatus] ?? i.publicationStatus
                          }`}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted">{verificationLabel(i.definition.verificationStatus)}</td>
                  <td className="px-3 py-2 text-muted">{hasVoice ? "Yes" : "-"}</td>
                </tr>
              );
            })}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted">
                  No bottles match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
