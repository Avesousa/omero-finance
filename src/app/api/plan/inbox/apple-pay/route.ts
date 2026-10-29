import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeMerchant, parseWalletAmount } from "@/lib/plan/core";
import { hashToken } from "@/lib/plan/inbox";

const DEDUPE_MS = 3 * 60 * 1000;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Texto corto de un campo que puede venir como string, número o cualquier cosa. */
function text(value: unknown, max: number): string | null {
  if (typeof value === "number" && Number.isFinite(value)) value = String(value);
  if (typeof value !== "string") return null;
  const t = value.trim().slice(0, max);
  return t || null;
}

/** Acepta JSON o formulario; nunca tira error por un cuerpo raro. */
async function readFields(req: NextRequest): Promise<Record<string, unknown>> {
  let raw = "";
  try {
    raw = await req.text();
  } catch {
    return {};
  }
  try {
    const json = JSON.parse(raw);
    if (json && typeof json === "object" && !Array.isArray(json)) return json as Record<string, unknown>;
  } catch {
    /* puede ser un formulario */
  }
  try {
    return Object.fromEntries(new URLSearchParams(raw));
  } catch {
    return {};
  }
}

/**
 * POST /api/plan/inbox/apple-pay — lo llama el atajo de iOS en cada pago con Apple Pay.
 * Header: `Authorization: Bearer <clave>`. Sin cookie de sesión.
 * Body: { amount, merchant?, card?, name?, date? } → 201 { ok, id } (200 si era un duplicado).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") ?? "";
    const match = /^Bearer\s+(\S+)$/i.exec(auth.trim());
    if (!match) return fail("Falta la clave", 401);

    const token = await prisma.planApiToken.findFirst({
      where: { tokenHash: hashToken(match[1]), revokedAt: null },
    });
    if (!token) return fail("Clave inválida", 401);
    const householdId = token.householdId;

    const body = await readFields(req);
    const merchant = text(body.merchant, 120) ?? text(body.name, 120);
    const walletCard = text(body.card, 120);
    const rawAmount = text(body.amount, 60);
    const { amount, currency } = parseWalletAmount(
      typeof body.amount === "number" ? body.amount : rawAmount,
    );

    let occurredAt = new Date();
    const dateText = text(body.date, 40);
    if (dateText) {
      const d = new Date(dateText);
      // Una fecha ilegible o en el futuro lejano no vale: queda la hora de llegada.
      if (!Number.isNaN(d.getTime()) && d.getTime() < Date.now() + 24 * 3600 * 1000) occurredAt = d;
    }

    await prisma.planApiToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } });

    // El atajo puede dispararse dos veces por el mismo pago.
    const key = merchant ? normalizeMerchant(merchant) : "";
    const recent = await prisma.planInboxItem.findMany({
      where: {
        householdId,
        source: "APPLE_PAY",
        amount,
        createdAt: { gte: new Date(Date.now() - DEDUPE_MS) },
      },
      orderBy: { createdAt: "desc" },
    });
    const dup = recent.find((it) => (it.merchant ? normalizeMerchant(it.merchant) : "") === key);
    if (dup) return NextResponse.json({ ok: true, id: dup.id, duplicate: true }, { status: 200 });

    const item = await prisma.planInboxItem.create({
      data: { householdId, source: "APPLE_PAY", merchant, amount, currency, rawAmount, walletCard, occurredAt },
    });
    return NextResponse.json({ ok: true, id: item.id }, { status: 201 });
  } catch (err) {
    console.error("[/api/plan/inbox/apple-pay POST]", err);
    return fail("Error interno", 500);
  }
}
