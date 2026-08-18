import { NextResponse, type NextRequest } from "next/server";
import { isValidDayCode, secondsUntilVenueMidnight, todayCode } from "@/lib/spirit-vault/day-code";
import { DAY_COOKIE } from "@/lib/spirit-vault/vault-access";

// Day-code entry point. A placemat QR resolves here: if the code is today's, we set
// a day-scoped access cookie and forward to the requested vault page; otherwise we
// bounce to the vault landing, which shows the "scan today's placemat" gate.
export const dynamic = "force-dynamic";

// Internal-only redirect target — never an absolute/off-site URL (open-redirect guard).
function safeTo(to: string | null): string {
  if (!to || !to.startsWith("/vault")) return "/vault";
  return to;
}

export function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const url = new URL(req.url);
  const to = safeTo(url.searchParams.get("to"));

  if (!isValidDayCode(params.code)) {
    const dest = new URL("/vault", url.origin);
    dest.searchParams.set("gate", "expired");
    return NextResponse.redirect(dest);
  }

  const res = NextResponse.redirect(new URL(to, url.origin));
  res.cookies.set(DAY_COOKIE, todayCode(), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    // Scope to the vault subtree only — this is a same-day bearer credential and has
    // no business being sent to app/admin/API routes.
    path: "/vault",
    maxAge: secondsUntilVenueMidnight(),
  });
  return res;
}
