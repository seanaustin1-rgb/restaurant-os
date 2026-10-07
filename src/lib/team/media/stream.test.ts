import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac, generateKeyPairSync, verify } from "node:crypto";
import { createStreamUpload, signStreamPlayback, verifyStreamWebhook } from "./stream";

beforeEach(() => {
  vi.unstubAllGlobals();
  process.env.CLOUDFLARE_ACCOUNT_ID = "account_test";
  process.env.CLOUDFLARE_STREAM_API_TOKEN = "token_test";
  process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET = "webhook_test";
});

describe("Cloudflare Stream adapter", () => {
  it("creates a private, direct resumable upload without sending bytes through our server", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, {
      status: 201, headers: { location: "https://upload.videodelivery.net/tus-id", "stream-media-id": "video_1" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await createStreamUpload("tenant_a", 123456)).toEqual({
      uploadUrl: "https://upload.videodelivery.net/tus-id", providerAssetId: "video_1",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/account_test/stream?direct_user=true");
    expect(init.headers).toMatchObject({ "Tus-Resumable": "1.0.0", "Upload-Length": "123456" });
    expect(init.headers["Upload-Metadata"]).toContain("requiresignedurls");
    expect(init.headers["Upload-Metadata"]).toContain(Buffer.from("tenant_a").toString("base64"));
    expect(init.body).toBeUndefined();
  });

  it("verifies the exact signed bytes and rejects stale or tampered callbacks", () => {
    const now = Date.UTC(2026, 9, 7);
    const time = String(Math.floor(now / 1000));
    const raw = Buffer.from('{"uid":"video_1"}\n');
    const sig = createHmac("sha256", "webhook_test").update(time).update(".").update(raw).digest("hex");
    const header = `time=${time},sig1=${sig}`;
    expect(verifyStreamWebhook(raw, header, now)).toBe(true);
    expect(verifyStreamWebhook(Buffer.from('{"uid":"video_1"}'), header, now)).toBe(false);
    expect(verifyStreamWebhook(raw, header, now + 301_000)).toBe(false);
  });

  it("signs a one-hour RS256 playback token using the configured private JWK", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID = "key_1";
    process.env.CLOUDFLARE_STREAM_SIGNING_KEY_JWK = Buffer.from(JSON.stringify(privateKey.export({ format: "jwk" }))).toString("base64");
    const now = Date.UTC(2026, 9, 7);
    const result = signStreamPlayback("video_1", now);
    const [header, payload, signature] = result.token.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "RS256", kid: "key_1" });
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({
      sub: "video_1", kid: "key_1", exp: Math.floor(now / 1000) + 3600,
    });
    expect(verify("RSA-SHA256", Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, "base64url"))).toBe(true);
  });
});
