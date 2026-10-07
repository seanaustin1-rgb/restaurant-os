"use client";
import { useEffect, useRef, useState } from "react";
import { playbackRefreshDelay } from "@/lib/team/media/playback-client";
type StreamPlayer = { played: TimeRanges; muted: boolean; paused: boolean; play(): Promise<void>; pause(): void;
  addEventListener(event: string, handler: () => void): void; removeEventListener(event: string, handler: () => void): void };
declare global { interface Window { Stream?: (iframe: HTMLIFrameElement) => StreamPlayer } }
let sdk: Promise<void> | null = null;
function loadPlayerSdk() {
  if (window.Stream) return Promise.resolve();
  if (!sdk) sdk = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://embed.cloudflarestream.com/embed/sdk.latest.js";
    script.onload = () => resolve(); script.onerror = () => { sdk = null; script.remove(); reject(new Error("Player could not load. Try again.")); };
    document.head.appendChild(script);
  });
  return sdk;
}
export function TeamPlayer({ restaurantId, lessonId, version, title, onVisible }: {
  restaurantId: string; lessonId: string; version: number; title: string; onVisible?: (id: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null), iframe = useRef<HTMLIFrameElement>(null), player = useRef<StreamPlayer | null>(null);
  const visibleCallback = useRef(onVisible); visibleCallback.current = onVisible;
  const [active, setActive] = useState(false), [credentials, setCredentials] = useState<{ token: string; expiresAt: string } | null>(null);
  const activeRef = useRef(active); activeRef.current = active;
  const [error, setError] = useState(""), [muted, setMuted] = useState(true), [retry, setRetry] = useState(0);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries[0].intersectionRatio >= 0.65;
      setActive(visible); if (visible) visibleCallback.current?.(lessonId);
    }, { threshold: [0, 0.65] });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, [lessonId]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const abort = new AbortController();
    const fetchToken = async () => {
      try {
        const response = await fetch(`/api/team/media/${encodeURIComponent(lessonId)}/token?restaurantId=${encodeURIComponent(restaurantId)}`, { cache: "no-store", signal: abort.signal });
        if (!response.ok) throw new Error("Video unavailable. Your Team access may have changed.");
        const result = await response.json();
        if (!cancelled) { setCredentials(result); setError(""); }
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Video unavailable."); }
    };
    const delay = credentials ? playbackRefreshDelay(credentials.expiresAt) : 0;
    if (delay === 0) void fetchToken();
    const timer = delay > 0 ? setTimeout(() => void fetchToken(), delay) : null;
    return () => { cancelled = true; abort.abort(); if (timer) clearTimeout(timer); };
  }, [active, lessonId, restaurantId, retry, credentials]);
  useEffect(() => {
    if (!credentials) return;
    let cancelled = false, lastSent = 0, lastCoverage = 0;
    const send = (force = false) => {
      const p = player.current;
      if (!p) return;
      const ranges: [number, number][] = [];
      for (let index = 0; index < p.played.length; index++) ranges.push([p.played.start(index), p.played.end(index)]);
      const coverage = ranges.reduce((sum, [start, end]) => sum + end - start, 0);
      if (coverage <= lastCoverage || (!force && Date.now() - lastSent < 10000)) return;
      lastSent = Date.now(); lastCoverage = coverage;
      const body = JSON.stringify({ restaurantId, lessonId, version, ranges });
      // Beacons also flush on pause/pagehide. The server uses stored duration, not currentTime.
      if (!navigator.sendBeacon("/api/team/progress", new Blob([body], { type: "application/json" }))) {
        void fetch("/api/team/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
      }
    };
    const update = () => send(), flush = () => send(true);
    const visibility = () => { if (document.hidden) { player.current?.pause(); flush(); } else if (activeRef.current) { void player.current?.play().catch(() => {}); } };
    void loadPlayerSdk().then(() => {
      if (cancelled || !iframe.current || !window.Stream) return;
      const p = window.Stream(iframe.current); player.current = p;
      p.muted = true; setMuted(true);
      if (!activeRef.current || document.hidden) p.pause(); else void p.play().catch(() => {});
      p.addEventListener("timeupdate", update); p.addEventListener("pause", flush); p.addEventListener("ended", flush);
      p.addEventListener("error", () => { if (!cancelled) setError("Video could not play. Try again."); });
    }).catch(cause => { if (!cancelled) setError(cause.message); });
    window.addEventListener("pagehide", flush); document.addEventListener("visibilitychange", visibility);
    return () => {
      flush(); cancelled = true;
      player.current?.removeEventListener("timeupdate", update); player.current?.removeEventListener("pause", flush);
      player.current?.removeEventListener("ended", flush); player.current?.pause(); player.current = null;
      window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", visibility);
    };
  }, [credentials, restaurantId, lessonId, version]);
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    if (!active) p.pause(); else if (!document.hidden) void p.play().catch(() => { p.muted = true; setMuted(true); void p.play().catch(() => {}); });
  }, [active, credentials]);
  return <div ref={root} className="relative h-full w-full bg-black">
    {credentials && !error && <iframe ref={iframe} title={title} className="h-full w-full border-0"
      src={`https://iframe.videodelivery.net/${credentials.token}?muted=true&autoplay=true&defaultTextTrack=en&primaryColor=%23bd8b61`}
      allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />}
    {!credentials && !error && <p role="status" className="absolute inset-x-4 top-1/3 text-center text-sm text-white">Loading private video…</p>}
    {error && <div role="alert" className="absolute inset-x-4 top-1/3 space-y-3 text-center text-sm text-white"><p>{error}</p>
      <button className="min-h-11 rounded border border-white/40 px-4" onClick={() => { setCredentials(null); setError(""); setRetry(value => value + 1); }}>Try again</button></div>}
    {credentials && !error && <button className="absolute right-3 top-3 min-h-11 rounded-full bg-black/70 px-4 text-sm text-white" onClick={() => {
      if (player.current) { player.current.muted = !muted; setMuted(!muted); }
    }}>{muted ? "Tap for sound" : "Mute"}</button>}
  </div>;
}
