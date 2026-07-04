import { sourceProfile, type SourceProfileId } from "@/lib/source-profiles";

export function SourceProfileCards({ ids }: { ids: SourceProfileId[] }) {
  const profiles = ids.map((id) => sourceProfile(id)).filter((profile): profile is NonNullable<typeof profile> => profile != null);
  if (profiles.length === 0) return null;

  return (
    <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {profiles.map((profile) => (
        <article key={profile.id} className="rounded-lg border border-line bg-surface px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-copper-soft">{profile.vendor}</div>
              <h2 className="mt-1 text-sm font-medium text-ink-text">{profile.label}</h2>
            </div>
            <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
              {profile.connectionLabel}
            </span>
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-muted">{profile.csvFallback}</p>

          <div className="mt-3 space-y-2 text-[11px] leading-relaxed">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted">Can import</div>
              <p className="mt-0.5 text-ink-text">{profile.importedEntities.slice(0, 6).join(", ")}</p>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted">Must match on</div>
              <p className="mt-0.5 text-ink-text">{profile.requiredIdentity.slice(0, 5).join(", ")}</p>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted">Lights up</div>
              <p className="mt-0.5 text-ink-text">{profile.dashboardUnlocks.slice(0, 5).join(", ")}</p>
            </div>
          </div>

          <p className="mt-3 border-t border-line pt-2 text-[11px] leading-relaxed text-muted">{profile.riskNotes[0]}</p>
        </article>
      ))}
    </section>
  );
}
