import {
  resolveVoiceOutcome, voiceSystemPrompt, VOICE_SUPPORTED,
  type VoiceContext, type VoiceExtraction, type VoiceIntent,
} from "./voice";

const ctx: VoiceContext = {
  today: "2026-10-30",
  incomeCategories: [
    { id: "c1", name: "Sueldo" },
    { id: "c2", name: "Educación extra" },
  ],
  expenseCategories: [
    { id: "e1", name: "Supermercado" },
    { id: "e2", name: "Salidas y ocio" },
  ],
};

const income = (over: Partial<NonNullable<VoiceExtraction["entry"]>> = {}): VoiceExtraction => ({
  intent: "income",
  entry: {
    name: "Sueldo", amount: 1_200_000, currency: "ARS", categoryName: null, date: null,
    fixed: false, frequency: null, note: null, ...over,
  },
});

describe("resolveVoiceOutcome", () => {
  it("income soportado arma un borrador", () => {
    const out = resolveVoiceOutcome(" Cobré el sueldo ", income(), ctx);
    expect(out).toEqual({
      kind: "draft", intent: "income", transcript: "Cobré el sueldo",
      draft: { kind: "INCOME", name: "Sueldo", amount: 1_200_000, currency: "ARS", categoryId: null, date: null, fixed: null, note: null },
    });
    expect(VOICE_SUPPORTED).toContain("income");
  });

  it.each(["debt", "card_purchase", "card_statement"] as VoiceIntent[])("%s → notYet", (intent) => {
    expect(resolveVoiceOutcome("algo", { intent, entry: null }, ctx)).toEqual({ kind: "notYet", intent, transcript: "algo" });
  });

  it("expense arma un borrador EXPENSE y resuelve contra categorías de gasto", () => {
    const e: VoiceExtraction = {
      intent: "expense",
      entry: { name: "Súper", amount: 5000, currency: "ARS", categoryName: "supermercado", date: null, fixed: false, frequency: null, note: null },
    };
    expect(resolveVoiceOutcome("gasté 5 mil en el súper", e, ctx)).toEqual({
      kind: "draft", intent: "expense", transcript: "gasté 5 mil en el súper",
      draft: { kind: "EXPENSE", name: "Súper", amount: 5000, currency: "ARS", categoryId: "e1", date: null, fixed: null, note: null },
    });
    expect(VOICE_SUPPORTED).toContain("expense");
  });

  it("la categoría no se cruza entre tipos", () => {
    const e: VoiceExtraction = {
      intent: "expense",
      entry: { name: "x", amount: 1, currency: "ARS", categoryName: "Sueldo", date: null, fixed: false, frequency: null, note: null },
    };
    const out = resolveVoiceOutcome("x", e, ctx);
    expect(out.kind === "draft" && out.draft.categoryId).toBeNull();
  });

  it("expense sin entry → unclear", () => {
    expect(resolveVoiceOutcome("gasté", { intent: "expense", entry: null }, ctx).kind).toBe("unclear");
  });

  it("chat y unclear", () => {
    expect(resolveVoiceOutcome("hola", { intent: "chat", entry: null }, ctx).kind).toBe("chat");
    expect(resolveVoiceOutcome("eh", { intent: "unclear", entry: null }, ctx).kind).toBe("unclear");
  });

  it("transcripción vacía o extracción nula → unclear", () => {
    expect(resolveVoiceOutcome("   ", income(), ctx)).toEqual({ kind: "unclear", transcript: "" });
    expect(resolveVoiceOutcome("hola", null, ctx).kind).toBe("unclear");
  });

  it("income sin datos de ingreso → unclear", () => {
    expect(resolveVoiceOutcome("cobré", { intent: "income", entry: null }, ctx).kind).toBe("unclear");
  });

  it("categoría por nombre sin acentos ni mayúsculas", () => {
    const out = resolveVoiceOutcome("x", income({ categoryName: "  EDUCACION EXTRA " }), ctx);
    expect(out.kind === "draft" && out.draft.categoryId).toBe("c2");
    const out2 = resolveVoiceOutcome("x", income({ categoryName: "sueldo" }), ctx);
    expect(out2.kind === "draft" && out2.draft.categoryId).toBe("c1");
  });

  it("categoría inexistente → null", () => {
    const out = resolveVoiceOutcome("x", income({ categoryName: "Lotería" }), ctx);
    expect(out.kind === "draft" && out.draft.categoryId).toBeNull();
  });

  it.each([0, -5, NaN, Infinity, null])("monto inválido %p → null", (amount) => {
    const out = resolveVoiceOutcome("x", income({ amount: amount as number | null }), ctx);
    expect(out.kind === "draft" && out.draft.amount).toBeNull();
  });

  it("redondea el monto a 2 decimales", () => {
    const out = resolveVoiceOutcome("x", income({ amount: 10.456 }), ctx);
    expect(out.kind === "draft" && out.draft.amount).toBe(10.46);
  });

  it.each(["ayer", "2026-1-5", "30/10/2026", ""])("fecha inválida %p → null", (date) => {
    const out = resolveVoiceOutcome("x", income({ date }), ctx);
    expect(out.kind === "draft" && out.draft.date).toBeNull();
  });

  it("fecha ISO se conserva", () => {
    const out = resolveVoiceOutcome("x", income({ date: "2026-10-29" }), ctx);
    expect(out.kind === "draft" && out.draft.date).toBe("2026-10-29");
  });

  it("fixed sin frecuencia → MONTHLY; con frecuencia se respeta", () => {
    const a = resolveVoiceOutcome("x", income({ fixed: true, frequency: null }), ctx);
    expect(a.kind === "draft" && a.draft.fixed).toEqual({ frequency: "MONTHLY" });
    const b = resolveVoiceOutcome("x", income({ fixed: true, frequency: "WEEKLY" }), ctx);
    expect(b.kind === "draft" && b.draft.fixed).toEqual({ frequency: "WEEKLY" });
  });

  it("USD se respeta; null → ARS; textos vacíos → null", () => {
    const a = resolveVoiceOutcome("x", income({ currency: "USD", name: "  ", note: " " }), ctx);
    expect(a.kind === "draft" && a.draft).toMatchObject({ currency: "USD", name: null, note: null });
    const b = resolveVoiceOutcome("x", income({ currency: null }), ctx);
    expect(b.kind === "draft" && b.draft.currency).toBe("ARS");
  });
});

describe("voiceSystemPrompt", () => {
  it("incluye hoy y las categorías", () => {
    const p = voiceSystemPrompt(ctx);
    expect(p).toContain("2026-10-30");
    expect(p).toContain("Sueldo, Educación extra");
    expect(p).toContain("Supermercado, Salidas y ocio");
    expect(voiceSystemPrompt({ ...ctx, incomeCategories: [], expenseCategories: [] })).toContain("(ninguna)");
  });
});
