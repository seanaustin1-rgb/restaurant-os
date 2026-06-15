import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { CountryCode, Products } from "plaid";
import { plaidClient } from "@/lib/plaid";

// Creates a short-lived Plaid Link token for the signed-in user.
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const resp = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "OutFront Data",
      products: [Products.Transactions, Products.Auth],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    return NextResponse.json({ link_token: resp.data.link_token });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "link token failed" },
      { status: 500 },
    );
  }
}
