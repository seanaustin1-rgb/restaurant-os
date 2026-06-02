import { extractText, getDocumentProxy } from "unpdf";

export interface CandidateTxn {
  date: string; // yyyy-mm-dd
  description: string;
  amount: number; // positive = outflow/debit
}

// Extracts merged plain text from a (text-based) PDF.
export async function extractStatementText(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

/**
 * First-pass heuristic parser: pulls lines that contain BOTH a date and a
 * currency amount, treating the last amount on the line as the transaction
 * amount. This is intentionally generic — it will be tuned to the user's
 * specific bank statement layout once we have a sample.
 */
export function parseStatementText(text: string, fallbackYear?: number): CandidateTxn[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const dateRe = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/;
  const amountReSrc = /-?\$?\s?(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}\b/g;
  const year = fallbackYear ?? new Date().getUTCFullYear();

  const out: CandidateTxn[] = [];
  for (const line of lines) {
    const dm = line.match(dateRe);
    if (!dm) continue;

    const amounts = line.match(new RegExp(amountReSrc));
    if (!amounts || amounts.length === 0) continue;

    // When a line has multiple amounts, the last is usually the running balance
    // and the transaction amount is the one before it. (Tuned per bank later.)
    const amtIdx = amounts.length >= 2 ? amounts.length - 2 : amounts.length - 1;
    const amtStr = amounts[amtIdx].replace(/[$,\s]/g, "");
    const amount = Math.abs(parseFloat(amtStr));
    if (!isFinite(amount) || amount === 0) continue;

    const mm = parseInt(dm[1], 10);
    const dd = parseInt(dm[2], 10);
    let yy = dm[3] ? parseInt(dm[3], 10) : year;
    if (yy < 100) yy += 2000;
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) continue;

    const date = `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    const description =
      line
        .replace(dateRe, "")
        .replace(new RegExp(amountReSrc), "")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, 140) || "Statement transaction";

    out.push({ date, description, amount });
  }
  return out;
}
