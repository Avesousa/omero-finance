import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { todayIso } from "@/lib/plan/core";
import { reportError } from "@/lib/plan/errors";
import { ensurePlanDefaults, withSession } from "@/lib/plan/server";
import { VoiceError, decodeAudioJson, interpretVoice, shouldReport, toVoiceApiError, type VoiceInput } from "@/lib/plan/voice-server";

export const runtime = "nodejs";
export const maxDuration = 60;

async function readInput(req: NextRequest): Promise<VoiceInput> {
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const audio = form.get("audio");
      const text = form.get("text");
      return {
        audio: audio && typeof audio !== "string" ? audio : null,
        text: typeof text === "string" ? text : null,
      };
    }
    const body = await req.json();
    return {
      audio: body?.audio ? decodeAudioJson(body.audio) : null,
      text: typeof body?.text === "string" ? body.text : null,
    };
  } catch (e) {
    if (e instanceof VoiceError) throw e;
    throw new VoiceError("Cuerpo inválido", "bad_audio", false);
  }
}

/**
 * POST /api/plan/voice — multipart (campo `audio`), JSON `{ text }` o JSON `{ audio: { base64, mimeType, name? } }`.
 * 200 `{ outcome: VoiceOutcome }`; error `{ error, code, retryable, reported }`:
 * 503 reintentable, 400 audio inválido, 500 el resto (queda registrado para el admin).
 * Nunca guarda nada: devuelve un borrador para confirmar.
 */
export async function POST(req: NextRequest) {
  return withSession(req, async ({ householdId, userId }) => {
    let err: VoiceError;
    try {
      const input = await readInput(req);
      await ensurePlanDefaults(householdId);
      const rows = await prisma.planCategory.findMany({
        where: { householdId, isArchived: false, systemKey: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, kind: true },
      });
      const pick = (kind: "INCOME" | "EXPENSE") =>
        rows.filter((c) => c.kind === kind).map(({ id, name }) => ({ id, name }));
      const outcome = await interpretVoice(input, {
        today: todayIso(), incomeCategories: pick("INCOME"), expenseCategories: pick("EXPENSE"),
      });
      return NextResponse.json({ outcome });
    } catch (e) {
      if (e instanceof VoiceError) {
        err = e;
      } else {
        console.error("[/api/plan/voice POST]", e);
        err = new VoiceError(e instanceof Error ? e.message : "error desconocido", "internal", false);
      }
    }
    let reported = false;
    if (shouldReport(err)) {
      reported = await reportError({ householdId, userId, source: "voice", code: err.code, message: err.message });
    }
    const status = err.retryable ? 503 : err.code === "bad_audio" ? 400 : 500;
    return NextResponse.json(toVoiceApiError(err, reported), { status });
  });
}
