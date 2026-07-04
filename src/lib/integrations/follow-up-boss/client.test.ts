import { describe, expect, it, vi } from "vitest";
import {
  FollowUpBossApiError,
  followUpBossAuthHeader,
  followUpBossRequest,
  listAllFollowUpBoss,
  listFollowUpBossPage,
  type FollowUpBossCredentials,
} from "./client";

const credentials: FollowUpBossCredentials = {
  apiKey: "test-key",
  system: "OutFront Data",
  systemKey: "system-key",
  baseUrl: "https://example.test",
};

describe("Follow Up Boss API client", () => {
  it("builds Basic auth with the API key as username and blank password", () => {
    expect(followUpBossAuthHeader("test-key")).toBe(`Basic ${Buffer.from("test-key:", "utf8").toString("base64")}`);
    expect(() => followUpBossAuthHeader("  ")).toThrow("API key is required");
  });

  it("sends auth and integration headers on requests", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ people: [] }));

    await followUpBossRequest(credentials, "/v1/people", { limit: 10 }, fetchImpl as typeof fetch);

    const [url, init] = fetchCall(fetchImpl, 0);
    expect(String(url)).toBe("https://example.test/v1/people?limit=10");
    expect(init?.headers).toMatchObject({
      accept: "application/json",
      authorization: followUpBossAuthHeader("test-key"),
      "X-System": "OutFront Data",
      "X-System-Key": "system-key",
    });
  });

  it("lists pages with capped limit, offset, and selected fields", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ deals: [{ id: 1 }], _metadata: { total: 1 } }));

    const page = await listFollowUpBossPage<{ id: number }>(
      credentials,
      "deals",
      { limit: 500, offset: 25, fields: ["id", "name"] },
      fetchImpl as typeof fetch,
    );

    const [url] = fetchCall(fetchImpl, 0);
    expect(String(url)).toBe("https://example.test/v1/deals?limit=100&offset=25&fields=id%2Cname");
    expect(page.rows).toEqual([{ id: 1 }]);
    expect(page.total).toBe(1);
  });

  it("paginates until the Follow Up Boss total is exhausted", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ people: [{ id: 1 }, { id: 2 }], _metadata: { total: 3 } }))
      .mockResolvedValueOnce(jsonResponse({ people: [{ id: 3 }], _metadata: { total: 3 } }));

    const rows = await listAllFollowUpBoss<{ id: number }>(credentials, "people", { limit: 2 }, fetchImpl as typeof fetch);

    expect(rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(String(fetchImpl.mock.calls[0]![0])).toContain("offset=0");
    expect(String(fetchImpl.mock.calls[1]![0])).toContain("offset=2");
  });

  it("throws a typed error for non-2xx responses", async () => {
    const fetchImpl = vi.fn(async () => new Response("rate limited", { status: 429 }));

    await expect(followUpBossRequest(credentials, "/v1/users", {}, fetchImpl as typeof fetch)).rejects.toMatchObject({
      name: "FollowUpBossApiError",
      status: 429,
      body: "rate limited",
    } satisfies Partial<FollowUpBossApiError>);
  });
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function fetchCall(mock: ReturnType<typeof vi.fn>, index: number): [URL, RequestInit] {
  return mock.mock.calls[index] as unknown as [URL, RequestInit];
}
