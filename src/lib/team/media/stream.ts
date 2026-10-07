import { createHmac, createPrivateKey, sign, timingSafeEqual } from "node:crypto";

export const STREAM_PROVIDER = "CLOUDFLARE_STREAM";
const API = "https://api.cloudflare.com/client/v4/accounts";

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function streamApiUrl(path: string): string {
  return `${API}/${encodeURIComponent(env("CLOUDFLARE_ACCOUNT_ID"))}/stream${path}`;
}

export async function createStreamUpload(restaurantId: string, byteLength: number): Promise<{ uploadUrl: string; providerAssetId: string }> {
  if (!Number.isSafeInteger(byteLength) || byteLength <= 0) throw new Error("A positive file size is required");
  const metadata = `requiresignedurls,teamrestaurantid ${Buffer.from(restaurantId).toString("base64")},maxDurationSeconds ${Buffer.from("600").toString("base64")}`;
  const response = await fetch(streamApiUrl("?direct_user=true"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("CLOUDFLARE_STREAM_API_TOKEN")}`,
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(byteLength),
      "Upload-Metadata": metadata,
    },
    cache: "no-store",
  });
  if (response.status !== 201) throw new Error(`Stream upload creation failed (${response.status})`);
  const uploadUrl = response.headers.get("location");
  const providerAssetId = response.headers.get("stream-media-id");
  if (!uploadUrl || !providerAssetId || !/^https:\/\//.test(uploadUrl)) {
    throw new Error("Stream did not return a resumable upload URL and media ID");
  }
  return { uploadUrl, providerAssetId };
}

/** Cloudflare signs the timestamp, a dot, and the exact raw request body. */
export function verifyStreamWebhook(rawBody: Buffer, header: string | null, now = Date.now()): boolean {
  const secret = env("CLOUDFLARE_STREAM_WEBHOOK_SECRET");
  const fields = Object.fromEntries((header ?? "").split(",").map((field) => field.trim().split("=")));
  const timestamp = fields.time;
  const signature = fields.sig1;
  if (!timestamp || !/^\d{10}$/.test(timestamp) || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  if (Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(timestamp).update(".").update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

export async function streamHasReadyCaptions(providerAssetId: string): Promise<boolean> {
  const response = await fetch(streamApiUrl(`/${encodeURIComponent(providerAssetId)}/captions`), {
    headers: { Authorization: `Bearer ${env("CLOUDFLARE_STREAM_API_TOKEN")}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Stream captions request failed (${response.status})`);
  const body = await response.json() as { success?: boolean; result?: { status?: string }[] };
  if (!body.success || !Array.isArray(body.result)) throw new Error("Invalid Stream captions response");
  return body.result.some((caption) => caption.status === "ready");
}

/** Cloudflare's key API returns a base64-encoded private JWK. */
export function signStreamPlayback(providerAssetId: string, now = Date.now()): { token: string; expiresAt: string } {
  const kid = env("CLOUDFLARE_STREAM_SIGNING_KEY_ID");
  const encodedJwk = env("CLOUDFLARE_STREAM_SIGNING_KEY_JWK");
  const jwk = JSON.parse(Buffer.from(encodedJwk, "base64").toString("utf8"));
  const key = createPrivateKey({ key: jwk, format: "jwk" });
  const exp = Math.floor(now / 1000) + 3600;
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: providerAssetId, kid, exp })).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const signature = sign("RSA-SHA256", Buffer.from(unsigned), key).toString("base64url");
  return { token: `${unsigned}.${signature}`, expiresAt: new Date(exp * 1000).toISOString() };
}
