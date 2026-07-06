"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fireTestLead } from "../actions";

// Broker-only convenience: push a synthetic lead through the real ingest
// pipeline (RawSourceEvent → Lead → Inngest alert ladder → agent app → this
// roster) so the speed-to-lead loop is demonstrable without a live BoldTrail
// webhook. Creates clearly-marked test data ("Test Lead …").
export function FireTestLeadButton({ restaurantId }: { restaurantId: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const fire = () =>
    startTransition(async () => {
      setMsg(null);
      try {
        const res = await fireTestLead(restaurantId);
        setMsg(res.created ? "Test lead fired ✓" : "Sent (deduped)");
        router.refresh();
      } catch {
        setMsg("Failed — check role/config");
      }
    });

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={fire}
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200"
      >
        {pending ? "Firing…" : "Fire test lead"}
      </button>
      {msg ? <span className="text-xs text-neutral-500">{msg}</span> : null}
    </div>
  );
}
