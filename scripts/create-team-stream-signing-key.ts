/**
 * One-time Stream signing-key setup. Dry-run by default.
 * Run: npx dotenv -e .env.local -o -- tsx scripts/create-team-stream-signing-key.ts --create
 * The --create invocation makes one live Cloudflare API call and prints the
 * private JWK once. Copy it into Vercel's encrypted environment settings.
 */

async function main() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim();
  if (!accountId || !apiToken) throw new Error("Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_API_TOKEN locally first.");
  if (!process.argv.includes("--create")) {
    process.stdout.write("Dry run. Add --create to create one Stream signing key.\n");
    return;
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/keys`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!response.ok) throw new Error(`Cloudflare key creation failed (${response.status}).`);
  const body = await response.json() as { success?: boolean; result?: { id?: string; jwk?: string } };
  if (!body.success || !body.result?.id || !body.result.jwk) throw new Error("Cloudflare did not return a signing key.");
  process.stdout.write("Add these encrypted values to Vercel for the intended environment:\n");
  process.stdout.write(`CLOUDFLARE_STREAM_SIGNING_KEY_ID=${body.result.id}\n`);
  process.stdout.write(`CLOUDFLARE_STREAM_SIGNING_KEY_JWK=${body.result.jwk}\n`);
  process.stdout.write("Keep the private JWK out of the repository and shell history.\n");
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Signing key creation failed"}\n`);
  process.exitCode = 1;
});
