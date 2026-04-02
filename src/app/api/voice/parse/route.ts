import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CARDS = [
  "VISA MARIA BBVA",
  "VISA MARIA CP",
  "VISA AVELINO BN",
  "MC AVELINO BN",
  "VISA AVELINO BK",
  "MC AVELINO MP",
];

const SYSTEM_PROMPT = `Sos un asistente de finanzas personales para una app de presupuesto hogareño argentino.
El usuario te da la transcripción de un gasto dicho en voz.
Devolvé SOLO un JSON válido con exactamente estos campos:

{
  "amount": string,       // número sin símbolo, con punto decimal si aplica (ej: "5000", "1250.50")
  "currency": "ARS" | "USD",
  "category": "mercado" | "general" | "fijo",
  "description": string,  // qué se compró/gastó, breve, en español
  "cardName": string,     // nombre exacto de la tarjeta de la lista, o "" si no se menciona
  "hint": string | null   // aviso si hay ambigüedad o dato importante a revisar, o null
}

Reglas:
- Moneda por defecto: ARS. Si dice "dólares", "usd", "verdes" → "USD"
- category "mercado": menciona supermercado, mercado, coto, jumbo, carrefour, día, chango, verdulería, almacén, fiambrería
- category "fijo": expensas, factura, servicio, prepaga, internet, luz, gas, agua, sueldo, cuota
- category "general": cualquier otra cosa
- Tarjetas disponibles (usá el nombre exacto o "" si no aplica): ${CARDS.join(", ")}
- Montos escritos en palabras: "cinco mil" → "5000", "dos cincuenta" → "250", "un palo" → "1000000"
- Si el monto no está claro, poné "" y usá hint para avisar
- No incluyas texto fuera del JSON`;

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const audio = fd.get("audio") as Blob | null;
    const target = (fd.get("target") as string) ?? "casa";

    if (!audio) {
      return NextResponse.json({ error: "Audio requerido" }, { status: 400 });
    }

    // 1 — Transcribe with Whisper
    const file = new File([audio], "voice.webm", { type: audio.type || "audio/webm" });
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "es",
    });
    const transcript = transcription.text.trim();

    if (!transcript) {
      return NextResponse.json({
        fields: null,
        transcript: "",
        hint: "No se escuchó nada. Intentá de nuevo.",
      });
    }

    // 2 — Extract structured fields with GPT-4o-mini
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT + `\n\nContexto: el gasto es de tipo "${target}".`,
        },
        { role: "user", content: transcript },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const raw = completion.choices[0].message.content ?? "{}";
    const fields = JSON.parse(raw) as {
      amount: string;
      currency: "ARS" | "USD";
      category: "mercado" | "general" | "fijo";
      description: string;
      cardName: string;
      hint: string | null;
    };

    return NextResponse.json({ fields, transcript });
  } catch (err) {
    console.error("[voice/parse]", err);
    return NextResponse.json({ error: "Error procesando audio" }, { status: 500 });
  }
}
