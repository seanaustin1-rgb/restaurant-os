"use client";

import { useEffect, useRef } from "react";
import { confirmAgentPush } from "./actions";

// Registers the signed-in agent's device for OneSignal web push and ties the
// subscription to their BrokerageAgent via OneSignal.login(agentId), so the
// server can target them by external id (see notify.ts).
//
// Gated: renders/inits nothing unless NEXT_PUBLIC_ONESIGNAL_APP_ID is set, so
// the agent app runs identically before OneSignal is configured. The heavy SDK
// is loaded from OneSignal's CDN on demand (no npm dependency), which keeps the
// bundle clean and matches OneSignal's documented v16 web setup.

// Minimal shape of the bits of the OneSignal v16 API we call — avoids taking a
// dependency just for types.
interface OneSignalApi {
  init(opts: { appId: string; allowLocalhostAsSecureOrigin?: boolean }): Promise<void>;
  login(externalId: string): Promise<void>;
  Notifications: {
    permission: boolean;
    requestPermission(): Promise<void>;
    addEventListener(event: "permissionChange", cb: (granted: boolean) => void): void;
  };
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(os: OneSignalApi) => void | Promise<void>>;
  }
}

const SDK_SRC = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";

function loadSdk(): void {
  if (document.querySelector(`script[src="${SDK_SRC}"]`)) return;
  const s = document.createElement("script");
  s.src = SDK_SRC;
  s.defer = true;
  document.head.appendChild(s);
}

export function PushRegistration({ agentId }: { agentId: string }) {
  const started = useRef(false);

  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    if (!appId || started.current) return;
    started.current = true;

    window.OneSignalDeferred = window.OneSignalDeferred ?? [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      await OneSignal.init({ appId, allowLocalhostAsSecureOrigin: true });
      // Bind this device to the agent so server-side pushes can target them.
      await OneSignal.login(agentId);

      const enroll = () => {
        // Persist enrollment once (marks push adoption on the BrokerageAgent).
        confirmAgentPush(agentId).catch(() => {
          /* best-effort; the next permission change retries */
        });
      };

      if (OneSignal.Notifications.permission) {
        enroll();
      } else {
        OneSignal.Notifications.addEventListener("permissionChange", (granted) => {
          if (granted) enroll();
        });
        // Prompt the agent to allow notifications (browser gesture rules apply).
        await OneSignal.Notifications.requestPermission().catch(() => undefined);
      }
    });

    loadSdk();
  }, [agentId]);

  return null;
}
