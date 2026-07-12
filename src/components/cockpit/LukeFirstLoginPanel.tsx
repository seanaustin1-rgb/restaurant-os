"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ravenDecisionStorageKey, ravenLocalDateKey } from "./raven-decision";

export type RavenDecisionStatus = "started" | "deferred" | "skipped";

export interface RavenDecision {
  status: RavenDecisionStatus;
  focus: string;
  note: string;
  dateKey: string;
  savedAt: string;
}

type SpeechRecognitionResultLike = { transcript: string };
type SpeechRecognitionEventLike = { results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>> };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type Stage = "greeting" | "brief" | "decision" | "cockpit";

const STATUS_LABEL: Record<RavenDecisionStatus, string> = {
  started: "In progress",
  deferred: "Deferred",
  skipped: "Skipped today",
};

function speechConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function LukeFirstLoginPanel({
  restaurantId,
  userId,
  firstName,
  executiveBrief,
  oneThing,
  sourceTrust,
}: {
  restaurantId: string;
  userId: string;
  firstName: string;
  executiveBrief: string[];
  oneThing: { label: string; readout: string };
  sourceTrust: string;
}) {
  const [stage, setStage] = useState<Stage>("greeting");
  const [decision, setDecision] = useState<RavenDecision | null>(null);
  const [note, setNote] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceUnavailable, setVoiceUnavailable] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const storageKey = useMemo(() => ravenDecisionStorageKey(restaurantId, userId), [restaurantId, userId]);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as RavenDecision;
      if (parsed.dateKey === ravenLocalDateKey()) {
        setDecision(parsed);
        setNote(parsed.note);
        setStage("cockpit");
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  function listen() {
    const Constructor = speechConstructor();
    if (!Constructor) {
      setVoiceUnavailable(true);
      return;
    }
    const recognition = new Constructor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      setNote(transcript);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function choose(status: RavenDecisionStatus) {
    const next: RavenDecision = {
      status,
      focus: oneThing.label,
      note: note.trim(),
      dateKey: ravenLocalDateKey(),
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    setDecision(next);
    setStage("cockpit");
  }

  if (stage === "cockpit") {
    return (
      <section className="mt-5 rounded-lg border border-copper-dim bg-copper/10 px-4 py-3" aria-live="polite">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-copper-soft">Today&apos;s focus</p>
            <p className="mt-1 text-sm font-medium text-ink-text">
              {decision?.status === "skipped" ? "Morning Brief skipped for today" : decision?.focus ?? oneThing.label}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {decision ? STATUS_LABEL[decision.status] : "Brief closed"}
              {decision?.note ? ` · ${decision.note}` : ""}
            </p>
          </div>
          <button type="button" onClick={() => setStage("brief")} className="rounded-md border border-line px-3 py-2 text-xs text-ink-text hover:border-copper-dim">
            Review brief
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-lg border border-copper-dim bg-ink/50 px-4 py-4" aria-live="polite">
      {stage === "greeting" ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-xl text-ink-text">Good morning, {firstName}.</p>
            <p className="mt-1 text-sm text-muted">Your cockpit is ready. Want the two-minute Executive Brief?</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setStage("brief")} className="rounded-md border border-copper-dim bg-copper/10 px-3 py-2 text-xs text-copper-soft hover:bg-copper/20">Begin brief</button>
            <button type="button" onClick={() => choose("skipped")} className="rounded-md border border-line px-3 py-2 text-xs text-muted hover:border-copper-dim">Skip today</button>
            <button type="button" onClick={() => setStage("cockpit")} className="rounded-md border border-line px-3 py-2 text-xs text-muted hover:border-copper-dim">Later</button>
          </div>
        </div>
      ) : null}

      {stage === "brief" ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-copper-soft">Executive Brief</p>
          <h3 className="mt-2 font-display text-2xl text-ink-text">Here&apos;s the operating picture.</h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-text">
            {executiveBrief.map((item) => <li key={item} className="rounded-md border border-line bg-surface px-3 py-2">{item}</li>)}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-muted">{sourceTrust}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setStage("decision")} className="rounded-md border border-copper-dim bg-copper/10 px-3 py-2 text-xs text-copper-soft hover:bg-copper/20">Continue to One Thing First</button>
            <button type="button" onClick={() => choose("skipped")} className="rounded-md border border-line px-3 py-2 text-xs text-muted hover:border-copper-dim">Skip today</button>
            <button type="button" onClick={() => setStage("cockpit")} className="rounded-md border border-line px-3 py-2 text-xs text-muted hover:border-copper-dim">Return to cockpit</button>
          </div>
        </div>
      ) : null}

      {stage === "decision" ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-copper-soft">One Thing First</p>
          <h3 className="mt-2 text-lg font-semibold text-ink-text">{oneThing.label}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{oneThing.readout}</p>
          <label className="mt-4 block text-xs font-medium text-ink-text" htmlFor="raven-owner-note">Your first move <span className="font-normal text-muted">(optional)</span></label>
          <textarea id="raven-owner-note" value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Type a note, or use voice." className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-text outline-none focus:border-copper-soft" />
          <div className="mt-2 flex flex-wrap gap-2">
            {!listening ? (
              <button type="button" onClick={listen} className="rounded-md border border-line px-3 py-2 text-xs text-ink-text hover:border-copper-dim">Use voice</button>
            ) : (
              <button type="button" onClick={stopListening} className="rounded-md border border-health-red/40 px-3 py-2 text-xs text-health-red">Stop voice</button>
            )}
          </div>
          {voiceUnavailable ? <p className="mt-2 text-xs text-health-yellow">Voice input is unavailable in this browser. Type the note or choose an action below.</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => choose("started")} className="rounded-md border border-copper bg-copper px-3 py-2 text-xs font-medium text-ink hover:bg-copper-soft">Start now</button>
            <button type="button" onClick={() => choose("deferred")} className="rounded-md border border-line px-3 py-2 text-xs text-ink-text hover:border-copper-dim">Defer</button>
            <button type="button" onClick={() => choose("skipped")} className="rounded-md border border-line px-3 py-2 text-xs text-muted hover:border-copper-dim">Skip today</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
