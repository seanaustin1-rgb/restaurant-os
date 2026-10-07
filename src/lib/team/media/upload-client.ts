/** Resume at Stream's acknowledged offset, including after an ambiguous PATCH response. */
export async function uploadTeamVideo(file: File, url: string, progress: (percent: number) => void, signal: AbortSignal) {
  let retries = 0;
  while (!signal.aborted) {
    try {
      const head = await fetch(url, { method: "HEAD", headers: { "Tus-Resumable": "1.0.0" }, signal });
      if (!head.ok) throw new Error("Upload could not resume.");
      const offset = Number(head.headers.get("Upload-Offset"));
      if (!head.headers.has("Upload-Offset") || !Number.isSafeInteger(offset) || offset < 0 || offset > file.size) throw new Error("Invalid upload offset.");
      progress(Math.round(offset / file.size * 100));
      if (offset === file.size) return;
      const response = await fetch(url, { method: "PATCH", headers: { "Tus-Resumable": "1.0.0", "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" },
        body: file.slice(offset, offset + 5 * 1024 * 1024), signal });
      if (!response.ok) throw new Error("Upload interrupted.");
      retries = 0;
    } catch (error) {
      if (signal.aborted) throw error;
      if (++retries > 3) throw new Error("Upload paused. Check your connection and tap Resume upload.");
      await new Promise(resolve => setTimeout(resolve, retries * 1000));
    }
  }
  throw new Error("Upload paused.");
}
