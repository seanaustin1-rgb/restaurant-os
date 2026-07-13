// OneSignal web-push service worker. Served from the site root so OneSignal can
// register it for background push. Loading the SDK's worker from their CDN is
// OneSignal's documented v16 integration. No effect unless the OneSignal client
// SDK is initialized (which only happens when NEXT_PUBLIC_ONESIGNAL_APP_ID is set).
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
