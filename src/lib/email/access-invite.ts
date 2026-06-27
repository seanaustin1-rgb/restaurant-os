import { Resend } from "resend";

export interface AccessInviteEmailInput {
  to: string;
  businessName: string;
  roleLabel: string;
  inviteUrl: string;
}

export async function sendAccessInviteEmail(input: AccessInviteEmailInput): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY is not configured." };

  const from = process.env.RESEND_FROM_EMAIL?.trim() || "OutFront Data <onboarding@outfrontdata.com>";
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from,
    to: input.to,
    subject: `You have been invited to ${input.businessName} on OutFront Data`,
    text: [
      `You have been invited as ${input.roleLabel} for ${input.businessName}.`,
      "",
      "Open this link to accept access:",
      input.inviteUrl,
    ].join("\n"),
    html: `
      <p>You have been invited as <strong>${input.roleLabel}</strong> for <strong>${input.businessName}</strong>.</p>
      <p><a href="${input.inviteUrl}">Accept access</a></p>
    `,
  });

  return { sent: true };
}
