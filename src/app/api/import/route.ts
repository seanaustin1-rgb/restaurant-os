import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { extractStatementText, parseStatementText, type CandidateTxn } from "@/lib/import/parse-statement";
import { extractTransactionsWithLLM, llmExtractionAvailable } from "@/lib/import/llm-extract";

// Accepts a PDF upload, extracts text, and returns candidate transactions for
// the user to review before importing. Does not write anything.
//
// Two-tier extraction:
//   1. Fast path — pull a text layer (works for text-based PDFs / CSV exports).
//   2. Fallback — if no text layer (scanned / image-based statements, e.g.
//      Orrstown), send the PDF to Claude for structured extraction.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file uploaded" }, { status: 400 });
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  // unpdf/pdf.js transfers (detaches) the ArrayBuffer backing `buf` during text
  // extraction, which would leave it empty for the LLM fallback below. Keep an
  // independent copy of the bytes for the LLM path.
  const pdfForLlm = buf.slice();

  let text = "";
  try {
    text = await extractStatementText(buf);
  } catch {
    // No readable text layer — fall through to the LLM path below.
  }

  const textCandidates = parseStatementText(text);
  if (textCandidates.length > 0) {
    return NextResponse.json({
      candidates: textCandidates,
      count: textCandidates.length,
      method: "text",
      textPreview: text.slice(0, 2000),
    });
  }

  // No transactions from the text parser. Try the LLM fallback if configured.
  if (!llmExtractionAvailable()) {
    return NextResponse.json({
      candidates: [],
      count: 0,
      method: "text",
      textPreview: text.slice(0, 2000),
      warning:
        "No text layer found (likely a scanned statement). Set ANTHROPIC_API_KEY to enable AI extraction.",
    });
  }

  try {
    const llm = await extractTransactionsWithLLM(pdfForLlm);
    // Credits stored as negative so expense/bucket sums treat outflows as positive.
    const candidates: CandidateTxn[] = llm.map((t) => ({
      date: t.date,
      description: t.description,
      amount: t.direction === "credit" ? -Math.abs(t.amount) : Math.abs(t.amount),
    }));
    return NextResponse.json({
      candidates,
      count: candidates.length,
      method: "llm",
      textPreview: text.slice(0, 2000),
    });
  } catch (err) {
    console.error("[import] LLM extraction error:", err);
    return NextResponse.json(
      {
        candidates: [],
        count: 0,
        method: "llm",
        textPreview: text.slice(0, 2000),
        warning: `AI extraction failed: ${err instanceof Error ? err.message : "unknown error"}`,
      },
      { status: 200 },
    );
  }
}
