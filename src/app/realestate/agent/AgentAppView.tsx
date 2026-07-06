"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AgentAppData } from "@/lib/realestate/load-agent-app";
import { initiateCall, approveMessage } from "../actions";

const BAND: Record<string, string> = {
  green: "text-emerald-600 dark:text-emerald-400",
  yellow: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
};
const DOT: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
};

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

type Tab = "today" | "live";

export function AgentAppView({ data }: { data: AgentAppData }) {
  const [tab, setTab] = useState<Tab>("live");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  const untouched = data.leads.filter((l) => !l.touched);

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <header className="mb-4">
        <div className="text-xs uppercase tracking-wide text-neutral-500">{data.agentName}</div>
        <h1 className="mt-0.5 text-xl font-semibold text-neutral-900 dark:text-neutral-100">Your day</h1>
      </header>

      <div className="mb-4 flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
        {(["today", "live"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
              tab === t
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-900 dark:text-neutral-100"
                : "text-neutral-500"
            }`}
          >
            {t === "today" ? "Today" : "Live"}
            {t === "live" && untouched.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-xs text-white">{untouched.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "live" ? (
        <div className="flex flex-col gap-2">
          {data.leads.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">No leads yet.</p>
          ) : (
            data.leads.map((l) => (
              <div
                key={l.id}
                className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 flex-none rounded-full ${DOT[l.band]}`} />
                      <span className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                        {l.fullName ?? "New lead"}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                      {l.origin ?? "lead"} ·{" "}
                      <span className={BAND[l.band]}>
                        {l.touched ? `responded in ${fmtDuration(l.waitedSec)}` : `waiting ${fmtDuration(l.waitedSec)}`}
                      </span>
                    </div>
                  </div>
                  {!l.touched && l.phone ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => initiateCall(l.id))}
                      className="flex-none rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
                    >
                      Call now
                    </button>
                  ) : l.touched ? (
                    <span className="flex-none text-xs text-emerald-600 dark:text-emerald-400">✓ touched</span>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="text-sm text-neutral-600 dark:text-neutral-400">
              {untouched.length > 0
                ? `${untouched.length} lead${untouched.length > 1 ? "s" : ""} need a first touch.`
                : "All leads have been touched. Nice."}
            </div>
          </div>

          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Drafts to approve</div>
          {data.drafts.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-500">No drafts waiting.</p>
          ) : (
            data.drafts.map((d) => (
              <div
                key={d.id}
                className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="text-xs text-neutral-500">
                  {d.channel} · {d.leadName ?? "lead"}
                </div>
                {d.subject ? (
                  <div className="mt-1 font-medium text-neutral-900 dark:text-neutral-100">{d.subject}</div>
                ) : null}
                <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-400">{d.body}</p>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => approveMessage(d.id))}
                    className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
                  >
                    Approve &amp; send
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
