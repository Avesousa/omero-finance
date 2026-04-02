import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/voice/parse
 * Accepts a FormData with `audio` (Blob) and `target` ("casa" | "personal").
 * Returns extracted fields and any ambiguities to resolve.
 *
 * Full implementation requires:
 *   1. Whisper API (transcription)
 *   2. LLM (Claude Haiku / GPT-4o mini) to extract structured fields
 *
 * The stub below simulates the response shape.
 */
export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const audio = fd.get("audio") as Blob | null;
    const target = fd.get("target") as string;

    if (!audio) {
      return NextResponse.json({ error: "Audio requerido" }, { status: 400 });
    }

    // ── Stub: echo back a simulated parse ───────────────────────────────────
    // Replace with:
    //   const transcript = await transcribeWithWhisper(audio)
    //   const fields = await parseExpenseIntent(transcript, target)
    // ────────────────────────────────────────────────────────────────────────
    const fields = {
      amount: "",
      currency: "ARS" as const,
      category: target === "casa" ? "mercado" : undefined,
      description: "",
      cardName: "",
    };

    return NextResponse.json({ fields, hint: null });
  } catch {
    return NextResponse.json({ error: "Error procesando audio" }, { status: 500 });
  }
}
