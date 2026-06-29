/**
 * Resolve a Clerk user id by email, using the CLERK_SECRET_KEY in the loaded env
 * (i.e. the same Clerk instance the local dev server uses). Read-only.
 *
 *   npx dotenv -e .env.local -o -- tsx scripts/clerk-user-id.ts [email]
 *
 * Defaults to the operator's email. Prints "<userId>\t<emails>" per match.
 */
import { clerkClient } from "@clerk/nextjs/server";

async function main() {
  const email = process.argv[2]?.trim() || "seanaustin1@gmail.com";
  const client = await clerkClient();
  const res: any = await client.users.getUserList({ emailAddress: [email] });
  const users: any[] = Array.isArray(res) ? res : res?.data ?? [];
  if (!users.length) {
    console.log(`NO_MATCH — no Clerk user found for ${email} in this instance.`);
    console.log("(If the dev server uses a Clerk TEST instance, sign in once at localhost first, then re-run.)");
    return;
  }
  for (const u of users) {
    const emails = (u.emailAddresses ?? []).map((e: any) => e.emailAddress).join(", ");
    console.log(`USER_ID=${u.id}\tEMAILS=${emails}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("clerk-user-id failed —", e instanceof Error ? e.message : e);
    process.exit(1);
  });
