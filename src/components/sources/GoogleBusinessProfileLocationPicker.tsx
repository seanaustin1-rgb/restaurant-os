import { MapPin } from "lucide-react";
import type { GoogleBusinessProfileLocation } from "@/lib/integrations/google-business-profile/oauth";

export function GoogleBusinessProfileLocationPicker({
  connectionId,
  locations,
}: {
  connectionId: string;
  locations: GoogleBusinessProfileLocation[];
}) {
  if (locations.length === 0) return null;

  return (
    <section className="rounded-lg border border-health-yellow/40 bg-health-yellow/5 p-4">
      <div className="flex items-start gap-2">
        <MapPin size={18} className="mt-0.5 text-health-yellow" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-ink-text">Choose the Google location for Aura</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Google found more than one Business Profile. Pick the location that should feed calls, directions, website
            clicks, and search/map activity into this dashboard.
          </p>

          <form action="/api/google-business-profile/location" method="post" className="mt-4 space-y-3">
            <input type="hidden" name="connectionId" value={connectionId} />
            <div className="grid gap-2">
              {locations.map((location, index) => (
                <label
                  key={`${location.accountId}-${location.locationId}`}
                  className="flex cursor-pointer gap-3 rounded-md border border-line bg-surface px-3 py-3 text-sm hover:border-copper-dim"
                >
                  <input
                    type="radio"
                    name="locationId"
                    value={location.locationId}
                    defaultChecked={index === 0}
                    className="mt-1 accent-copper"
                  />
                  <span>
                    <span className="block text-ink-text">{location.title}</span>
                    {location.address && <span className="mt-0.5 block text-xs text-muted">{location.address}</span>}
                  </span>
                </label>
              ))}
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md border border-copper-dim bg-copper/10 px-4 py-2 text-sm text-copper-soft hover:bg-copper/20"
            >
              Use this location
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
