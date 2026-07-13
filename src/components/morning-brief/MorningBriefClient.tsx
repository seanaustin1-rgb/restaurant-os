"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { DailyDigest, DigestTone } from "@/lib/modules/daily-digest";

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

type WindowWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const TONE_CLASS: Record<DigestTone, string> = {
  alert: "border-health-red/40 bg-health-red/10 text-health-red",
  info: "border-copper-dim/50 bg-copper/10 text-copper-soft",
  ok: "border-health-green/40 bg-health-green/10 text-health-green",
};

function recognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as WindowWithSpeech;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function MorningBriefClient({ digest }: { digest: DailyDigest }) {
  const [typedPlan, setTypedPlan] = useState("");
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [voiceUnavailable, setVoiceUnavailable] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const oneThing = digest.oneThing;
  const canUseVoice = useMemo(() => recognitionConstructor() != null, []);
  const plan = transcript.trim() || typedPlan.trim();

  function startVoice() {
    const Ctor = recognitionConstructor();
    if (!Ctor) {
      setVoiceUnavailable(true);
      return;
    }
    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      setTranscript(text);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setSkipped(false);
    setListening(true);
    recognition.start();
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-8 sm:px-6">
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-xl shadow-black/20 sm:p-7">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Owner-mode Morning Brief</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-copper-soft">{digest.restaurantName}</h1>
            <p className="mt-1 text-sm text-muted">{digest.dateLabel}</p>
          </div>
          <Link href="/dashboard" className="rounded-md border border-line px-3 py-2 text-xs text-ink-text hover:border-copper-dim">
            Open dashboard
          </Link>
        </div>

        <div className={`mt-5 rounded-xl border px-4 py-4 ${TONE_CLASS[oneThing.tone]}`}>
          <p className="text-[11px] uppercase tracking-[0.18em] opacity-80">One Thing First</p>
          <h2 className="mt-2 text-xl font-semibold text-ink-text">{oneThing.label}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-text/90">{oneThing.value}</p>
        </div>

        <div className="mt-5 rounded-xl border border-line bg-ink/50 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-ink-text">What will you do first?</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Voice is first. If this is not a good moment, skip or type the owner note instead.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!listening ? (
                <button
                  type="button"
                  onClick={startVoice}
                  className="rounded-md border border-copper-dim bg-copper/10 px-3 py-2 text-xs text-copper-soft hover:bg-copper/20"
                >
                  Start voice
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopVoice}
                  className="rounded-md border border-health-red/40 bg-health-red/10 px-3 py-2 text-xs text-health-red"
                >
                  Stop voice
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSkipped(true);
                  setTranscript("");
                  setTypedPlan("");
                }}
                className="rounded-md border border-line px-3 py-2 text-xs text-muted hover:border-copper-dim"
              >
                Skip for now
              </button>
            </div>
          </div>

          {(!canUseVoice || voiceUnavailable) && (
            <p className="mt-3 rounded-md border border-health-yellow/40 bg-health-yellow/10 px-3 py-2 text-xs text-health-yellow">
              Voice entry is not available in this browser. Type the note below or skip.
            </p>
          )}

          {transcript && (
            <p className="mt-3 rounded-md border border-copper-dim/50 bg-copper/10 px-3 py-2 text-sm leading-relaxed text-ink-text">
              {transcript}
            </p>
          )}

          <textarea
            value={typedPlan}
            onChange={(event) => {
              setSkipped(false);
              setTypedPlan(event.target.value);
            }}
            placeholder="Type fallback: e.g. Call the manager about labor before lunch."
            rows={3}
            className="mt-3 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-text outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
          />

          <div className="mt-3 rounded-md border border-line bg-surface/70 px-3 py-2 text-xs leading-relaxed text-muted">
            {plan
              ? `Captured for this session: ${plan}`
              : skipped
                ? "Skipped. The brief stays useful: handle the One Thing first, then come back when you can add a note."
                : "No note captured yet. Start with the One Thing, then add the smallest next action."}
          </div>
        </div>

        {(digest.watchItems.length > 0 || digest.forwardCash) && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {digest.forwardCash && (
              <div className={`rounded-lg border px-3 py-3 ${TONE_CLASS[digest.forwardCash.tone]}`}>
                <p className="text-[11px] uppercase tracking-wider opacity-80">Forward cash</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-text/90">{digest.forwardCash.value}</p>
              </div>
            )}
            {digest.watchItems.map((item) => (
              <div key={`${item.label}:${item.value}`} className={`rounded-lg border px-3 py-3 ${TONE_CLASS[item.tone]}`}>
                <p className="text-[11px] uppercase tracking-wider opacity-80">Also watching</p>
                <p className="mt-1 text-sm font-medium text-ink-text">{item.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-text/90">{item.value}</p>
              </div>
            ))}
          </div>
        )}

        <p className="mt-5 rounded-lg border border-line bg-ink/40 px-3 py-2 text-xs leading-relaxed text-muted">
          {digest.sourceTrust.value}
        </p>
      </section>
    </main>
  );
}
