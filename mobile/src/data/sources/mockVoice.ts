import { normalizeText, parseSpokenAmount, resolveVoiceOutcome, type VoiceContext, type VoiceExtraction, type VoiceOutcome } from "../../domain/index.ts";

/** Texto que el mock "escucha" cuando hay audio (no hay transcripción real). */
export const MOCK_AUDIO_TEXT = "Me pagaron el sueldo, un millón doscientos mil";

const norm = normalizeText;

/** Monto dicho en el texto (en dígitos o en palabras), o null. Vive en `domain/amountText`; se re-exporta para los tests. */
export { parseSpokenAmount };

function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const has = (t: string, re: RegExp) => re.test(t);

/** Palabras que llevan a una categoría de gasto del mock (por nombre normalizado de la categoría). */
const EXPENSE_KEYWORDS: Record<string, RegExp> = {
  supermercado: /\b(super|supermercado|mercado|verduleria|carniceria|almacen)\b/,
  transporte: /\b(nafta|uber|cabify|subte|colectivo|sube|taxi|peaje|combustible)\b/,
  "salidas y ocio": /\b(cine|restaurante|resto|bar|cena|birra|boliche|salida|salidas|helado|cafe)\b/,
  servicios: /\b(luz|gas|agua|internet|wifi|expensas|celular|servicio|servicios)\b/,
};

function findCategory(t: string, list: { id: string; name: string }[], keywords: Record<string, RegExp> = {}) {
  const byName = list.find((c) => {
    const n = norm(c.name);
    return t.includes(n) || t.includes(n.replace(/(es|s)$/, ""));
  });
  if (byName) return byName;
  return list.find((c) => keywords[norm(c.name)]?.test(t));
}

/**
 * Intérprete local por palabras clave: hace de modelo en modo mock. Arma la misma `VoiceExtraction`
 * que devolvería la API; después se pasa por `resolveVoiceOutcome` igual que en el servidor.
 */
export function mockInterpret(text: string, ctx: VoiceContext): VoiceExtraction {
  const t = norm(text);
  if (!t) return { intent: "unclear", entry: null };

  if (has(t, /\bresumen\b/)) return { intent: "card_statement", entry: null };
  const spendVerb = has(t, /\b(gaste|pague|compre|gasto)\b/);
  if (
    has(t, /\bcuotas?\b/) && has(t, /\b(tarjeta|visa|master|mastercard|amex)\b/) ||
    spendVerb && has(t, /\b(tarjeta de credito|en cuotas|\d+ cuotas|con la (visa|master|mastercard|amex))\b/)
  ) {
    return { intent: "card_purchase", entry: null };
  }
  if (has(t, /\b(debo|preste|prestamos?|me deben|deuda)\b/)) return { intent: "debt", entry: null };

  const isIncome = has(
    t,
    /\b(cobre|cobro|me pagaron|me depositaron|me transfirieron|me transfirio|sueldo|ingreso|ingresos)\b/,
  );
  if (!isIncome && !spendVerb) {
    if (has(t, /\b(hola|buenas|buen dia|como estas|quien sos|contame|chiste|gracias|que tal)\b/)) {
      return { intent: "chat", entry: null };
    }
    return { intent: "unclear", entry: null };
  }

  const fixed = has(t, /\b(todos los meses|cada mes|mensual|fijo)\b/);
  const date = has(t, /\bayer\b/) ? shiftDay(ctx.today, -1) : has(t, /\banteayer\b/) ? shiftDay(ctx.today, -2) : null;
  const common = {
    amount: parseSpokenAmount(text),
    currency: has(t, /\b(usd|u\$s|dolar|dolares|verdes)\b/) ? ("USD" as const) : ("ARS" as const),
    date,
    fixed,
    frequency: fixed ? ("MONTHLY" as const) : null,
    note: null,
  };

  if (isIncome) {
    const cat = findCategory(t, ctx.incomeCategories);
    return {
      intent: "income",
      entry: { ...common, name: cat?.name ?? (has(t, /\bsueldo\b/) ? "Sueldo" : "Ingreso"), categoryName: cat?.name ?? null },
    };
  }
  const cat = findCategory(t, ctx.expenseCategories, EXPENSE_KEYWORDS);
  return { intent: "expense", entry: { ...common, name: cat?.name ?? "Gasto", categoryName: cat?.name ?? null } };
}

/** `mockInterpret` + `resolveVoiceOutcome`: lo que haría el servidor completo. */
export function mockOutcome(text: string, ctx: VoiceContext): VoiceOutcome {
  return resolveVoiceOutcome(text, mockInterpret(text, ctx), ctx);
}
