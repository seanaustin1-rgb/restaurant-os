import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadTeamVideo } from "./upload-client";
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("Phone TUS upload", () => {
  it("resumes at Stream's acknowledged offset and uploads bytes only to Stream", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { headers: { "Upload-Offset": "3" } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { headers: { "Upload-Offset": "10" } }));
    vi.stubGlobal("fetch", fetch);
    const progress = vi.fn();
    await uploadTeamVideo(new File(["0123456789"], "phone.mov"), "https://upload.videodelivery.net/private", progress, new AbortController().signal);
    expect(fetch.mock.calls.map(call => call[0])).toEqual(Array(3).fill("https://upload.videodelivery.net/private"));
    expect(fetch.mock.calls[1][1].headers["Upload-Offset"]).toBe("3");
    expect(fetch.mock.calls[1][1].body.size).toBe(7); expect(progress).toHaveBeenLastCalledWith(100);
  });
  it("rechecks offset after an ambiguous failed PATCH instead of retransmitting blindly", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { headers: { "Upload-Offset": "0" } }))
      .mockRejectedValueOnce(new Error("network interrupted after acceptance"))
      .mockResolvedValueOnce(new Response(null, { headers: { "Upload-Offset": "10" } }));
    vi.stubGlobal("fetch", fetch);
    const work = uploadTeamVideo(new File(["0123456789"], "phone.mov"), "https://upload.videodelivery.net/private", vi.fn(), new AbortController().signal);
    await vi.runAllTimersAsync(); await work;
    expect(fetch.mock.calls[2][1].method).toBe("HEAD");
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("stops a paused upload", async () => {
    const abort = new AbortController(); abort.abort();
    await expect(uploadTeamVideo(new File(["x"], "phone.mov"), "https://upload.videodelivery.net/private", vi.fn(), abort.signal)).rejects.toThrow("paused");
  });
});
