/** Accept E.164, or a US ten-digit number for the pilot roster. */
export function normalizeTeamPhone(value: string): string {
  const compact = value.replace(/[\s().-]/g, "");
  const e164 = /^\+[1-9]\d{7,14}$/;
  if (e164.test(compact)) return compact;
  if (/^\d{10}$/.test(compact)) return `+1${compact}`;
  if (/^1\d{10}$/.test(compact)) return `+${compact}`;
  throw new Error("Enter a valid phone number with country code, or a 10-digit US number.");
}
