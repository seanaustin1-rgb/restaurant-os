import { Resend } from "resend";
import { renderDigestHtml, renderDigestText, type DailyDigest } from "@/lib/modules/daily-digest";

// Delivery for the Daily Digest. Mirrors access-invite: no-ops honestly (never
// throws) when RESEND_API_KEY is unset, so a misconfigured env can't fail the
// Inngest worker. Content is built + rendered by the pure daily-digest module.

export interface SendDailyDigestInput {
  to: string[];
  digest: DailyDigest;
}

export async function sendDailyDigestEmail(input: SendDailyDigestInput): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY is not configured." };
  if (input.to.length === 0) return { sent: false, reason: "no recipients" };

  const from = process.env.RESEND_FROM_EMAIL?.trim() || "OutFront Data <onboarding@outfrontdata.com>";
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from,
    to: input.to,
    subject: input.digest.subject,
    text: renderDigestText(input.digest),
    html: renderDigestHtml(input.digest),
  });
  return { sent: true };
}
