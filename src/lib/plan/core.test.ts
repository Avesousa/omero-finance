import {
  addDays, addMonths, monthDiff, daysInPeriod, isValidPeriod, currentPeriod, periodLabel,
  occurrencesInPeriod, monthlyAmount, buildProposal,
  installmentFor, statementToPay, cardLines, projectInstallments,
  buildSummary, balanceAt, isReceivable, netWorth, pastPaymentPlan, cardLabel, cardSubtitle, cardTitle,
  parseMoney, formatMoneyInput, numberToInput,
  monthlyRatePct, frenchInstallment, loanState, isLoanFinished, proposeLoanPayment, buildLoanProposal,
  loanDueDate, loanPaymentLabel, loanBalanceItem,
  type CardDTO, type LoanDTO, type LoanPaymentDTO, type CategoryDTO, type EntryDTO, type PurchaseDTO, type StatementDTO,
  type BalanceItemDTO, type RecurringDTO,
} from "./core";

const card = (id: string, name: string, extra: Partial<CardDTO> = {}): CardDTO => ({
  id, name, entity: null, cardType: null, ownerName: null, ...extra,
});

describe("períodos", () => {
  it("valida el formato YYYY-MM", () => {
    expect(isValidPeriod("2026-10")).toBe(true);
    expect(isValidPeriod("2026-13")).toBe(false);
    expect(isValidPeriod("2026-1")).toBe(false);
    expect(isValidPeriod(undefined)).toBe(false);
  });

  it("suma y resta meses cruzando de año", () => {
    expect(addMonths("2026-10", 1)).toBe("2026-11");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-10", 15)).toBe("2028-01");
  });

  it("calcula la diferencia en meses", () => {
    expect(monthDiff("2026-10", "2026-10")).toBe(0);
    expect(monthDiff("2026-10", "2027-01")).toBe(3);
    expect(monthDiff("2026-10", "2026-08")).toBe(-2);
  });

  it("usa la hora de Buenos Aires para el mes actual", () => {
    // 1 de noviembre 01:00 UTC todavía es 31 de octubre en Buenos Aires
    expect(currentPeriod(new Date("2026-11-01T01:00:00Z"))).toBe("2026-10");
    expect(currentPeriod(new Date("2026-11-01T04:00:00Z"))).toBe("2026-11");
  });

  it("arma la etiqueta del mes", () => {
    expect(periodLabel("2026-10")).toBe("octubre 2026");
    expect(daysInPeriod("2026-02")).toBe(28);
    expect(daysInPeriod("2028-02")).toBe(29);
  });
});

describe("recurrencia", () => {
  it("cuenta ocurrencias por frecuencia", () => {
    expect(occurrencesInPeriod("MONTHLY", "2026-10")).toBe(1);
    expect(occurrencesInPeriod("BIWEEKLY", "2026-10")).toBe(2);
    expect(occurrencesInPeriod("DAILY", "2026-10")).toBe(31);
    expect(occurrencesInPeriod("DAILY", "2026-02")).toBe(28);
  });

  it("semanal: cuenta cuántas veces cae el día en el mes", () => {
    // Octubre 2026 empieza jueves: 5 jueves, 5 viernes, 5 sábados, 4 lunes
    expect(occurrencesInPeriod("WEEKLY", "2026-10", 4)).toBe(5);
    expect(occurrencesInPeriod("WEEKLY", "2026-10", 5)).toBe(5);
    expect(occurrencesInPeriod("WEEKLY", "2026-10", 1)).toBe(4);
    expect(occurrencesInPeriod("WEEKLY", "2026-10", null)).toBe(4);
  });

  it("calcula el monto del mes", () => {
    expect(monthlyAmount(100_000, "WEEKLY", "2026-10", 5)).toBe(500_000);
    expect(monthlyAmount(750_000, "BIWEEKLY", "2026-10")).toBe(1_500_000);
    expect(monthlyAmount(500_000, "MONTHLY", "2026-10")).toBe(500_000);
  });

  it("arma la propuesta de inicio de mes solo con reglas activas", () => {
    const base: RecurringDTO = {
      id: "r1", kind: "EXPENSE", name: "Alquiler", categoryId: "c1", targetCategoryId: null,
      currency: "ARS", amount: 500_000, frequency: "MONTHLY", weekday: null, dueDay: 10, isActive: true,
    };
    const rows = buildProposal(
      [base, { ...base, id: "r2", name: "Gym", isActive: false },
        { ...base, id: "r3", kind: "INCOME", name: "Clases", amount: 20_000, frequency: "WEEKLY", weekday: 1 }],
      "2026-10",
    );
    expect(rows.map((r) => r.recurringId)).toEqual(["r1", "r3"]);
    expect(rows[1]).toMatchObject({ occurrences: 4, amount: 80_000 });
  });
});

describe("tarjetas", () => {
  const purchase: PurchaseDTO = {
    id: "p1", cardId: "card1", description: "Heladera", categoryId: null, currency: "ARS",
    amount: 1_200_000, installments: 12, firstPeriod: "2026-10", purchaseDate: null, note: null,
  };

  it("ubica la cuota que cae en cada mes", () => {
    expect(installmentFor(purchase, "2026-09")).toBeNull();
    expect(installmentFor(purchase, "2026-10")).toEqual({ number: 1, of: 12, amount: 100_000 });
    expect(installmentFor(purchase, "2027-09")).toEqual({ number: 12, of: 12, amount: 100_000 });
    expect(installmentFor(purchase, "2027-10")).toBeNull();
  });

  const st: StatementDTO = {
    id: "s1", cardId: "card1", period: "2026-10", dueDate: "2026-10-12",
    totalArs: 800_000, minimumArs: 120_000, usdAmount: 50, payMode: "TOTAL",
    customAmount: null, isPaid: false,
  };

  it("calcula lo que se paga según la decisión", () => {
    expect(statementToPay(st, 1500)).toBe(875_000);
    expect(statementToPay({ ...st, payMode: "MINIMUM" }, 1500)).toBe(120_000);
    expect(statementToPay({ ...st, payMode: "CUSTOM", customAmount: 400_000 }, 1500)).toBe(400_000);
    // sin mínimo cargado, pagar el mínimo cae al total
    expect(statementToPay({ ...st, payMode: "MINIMUM", minimumArs: null }, 1500)).toBe(875_000);
  });

  it("usa el resumen si existe y si no estima con las cuotas", () => {
    const cards = [card("card1", "VISA"), card("card2", "MC"), card("card3", "AMEX")];
    const lines = cardLines(cards, [st], [purchase, { ...purchase, id: "p2", cardId: "card2", amount: 300_000, installments: 3 }], "2026-10", 1500);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ cardId: "card1", toPayArs: 875_000, isEstimate: false });
    expect(lines[1]).toMatchObject({ cardId: "card2", toPayArs: 100_000, isEstimate: true });
  });

  it("proyecta las cuotas a futuro", () => {
    const proj = projectInstallments(
      [purchase, { ...purchase, id: "p2", amount: 300_000, installments: 3, firstPeriod: "2026-11" }],
      "2026-10", 4, 1500,
    );
    expect(proj.map((p) => p.totalArs)).toEqual([100_000, 200_000, 200_000, 200_000]);
    expect(proj[3].period).toBe("2027-01");
  });
});

describe("cómo se identifica una tarjeta", () => {
  it("usa banco, marca y titular cuando están cargados", () => {
    const c = card("c", "VISA AVELINO BN", { entity: "Banco Nación", cardType: "VISA", ownerName: "Avelino" });
    expect(cardTitle(c)).toBe("Banco Nación");
    expect(cardSubtitle(c)).toBe("Visa · Avelino");
    expect(cardLabel(c)).toBe("Banco Nación · Visa · Avelino");
    expect(cardLabel(card("m", "x", { entity: "Galicia", cardType: "MC", ownerName: "María" }))).toBe("Galicia · Mastercard · María");
  });

  it("cae al nombre heredado si faltan los datos", () => {
    const legacy = card("c", "VISA AVELINO BK");
    expect(cardTitle(legacy)).toBe("VISA AVELINO BK");
    expect(cardSubtitle(legacy)).toBe("");
    expect(cardLabel(legacy)).toBe("VISA AVELINO BK");
    // con datos parciales muestra lo que haya
    expect(cardLabel(card("c", "x", { entity: " ", cardType: "AMEX" }))).toBe("x · Amex");
  });

  it("el aviso de vencimiento nombra la tarjeta completa", () => {
    const c = card("card1", "BK", { entity: "Brubank", cardType: "VISA", ownerName: "Avelino" });
    const st: StatementDTO = {
      id: "s", cardId: "card1", period: "2026-10", dueDate: null, totalArs: 10, minimumArs: null,
      usdAmount: null, payMode: "TOTAL", customAmount: null, isPaid: false,
    };
    expect(cardLines([c], [st], [], "2026-10", 1500)[0].cardName).toBe("Brubank · Visa · Avelino");
  });
});

describe("resumen del mes", () => {
  const categories: CategoryDTO[] = [
    { id: "alq", kind: "EXPENSE", name: "Alquiler", systemKey: null, isArchived: false, sortOrder: 1 },
    { id: "sup", kind: "EXPENSE", name: "Supermercado", systemKey: null, isArchived: false, sortOrder: 2 },
    { id: "aho", kind: "EXPENSE", name: "Ahorro", systemKey: null, isArchived: false, sortOrder: 3 },
    { id: "tdc", kind: "EXPENSE", name: "Tarjetas", systemKey: "TDC", isArchived: false, sortOrder: 4 },
    { id: "sue", kind: "INCOME", name: "Sueldo", systemKey: null, isArchived: false, sortOrder: 1 },
  ];
  const entry = (over: Partial<EntryDTO>): EntryDTO => ({
    id: Math.random().toString(36), period: "2026-10", kind: "EXPENSE", recurringId: null,
    name: "x", categoryId: null, targetCategoryId: null, currency: "ARS", amount: 0,
    date: null, isDone: false, note: null, loanId: null, interestAmount: null, ...over,
  });

  const input = {
    period: "2026-10",
    usdRate: 1500,
    categories,
    entries: [
      entry({ kind: "INCOME", recurringId: "r-sueldo", name: "Sueldo", categoryId: "sue", amount: 3_000_000, isDone: true }),
      entry({ kind: "INCOME", name: "Freelance", amount: 200, currency: "USD", targetCategoryId: "aho" }),
      entry({ recurringId: "r-alq", name: "Alquiler", categoryId: "alq", amount: 500_000 }),
      entry({ name: "Coto", categoryId: "sup", amount: 180_000 }),
      entry({ name: "Kiosco", amount: 5_000 }),
      entry({ period: "2026-09", name: "Otro mes", categoryId: "sup", amount: 999_999 }),
    ],
    budgets: [
      { categoryId: "alq", amount: 400_000 },
      { categoryId: "sup", amount: 200_000 },
      { categoryId: "tdc", amount: 1_000_000 },
    ],
    cards: [card("card1", "VISA")],
    statements: [{
      id: "s1", cardId: "card1", period: "2026-10", dueDate: null, totalArs: 700_000,
      minimumArs: null, usdAmount: null, payMode: "TOTAL" as const, customAmount: null, isPaid: false,
    }],
    purchases: [],
  };

  const s = buildSummary(input);

  it("calcula ingresos, gastos y disponible", () => {
    expect(s.incomeArs).toBe(3_300_000);
    expect(s.incomeFixedArs).toBe(3_000_000);
    expect(s.incomeVariableArs).toBe(300_000);
    expect(s.fixedArs).toBe(500_000);
    expect(s.variableArs).toBe(185_000);
    expect(s.cardsArs).toBe(700_000);
    // Disponible: solo salió lo ya pagado (los gastos del mes). El alquiler y la tarjeta siguen sin pagar.
    expect(s.paidArs).toBe(185_000);
    expect(s.pendingArs).toBe(1_200_000);
    expect(s.availableArs).toBe(3_300_000 - 185_000);
  });

  it("libre = disponible − lo reservado por presupuesto y pagos pendientes", () => {
    // alquiler: cargado 500 > presupuesto 400 → reserva 500 · súper: faltan 20 del presupuesto
    // tarjetas: presupuesto 1.000 (resumen de 700 sin pagar) → reserva 1.000
    expect(s.reservedArs).toBe(500_000 + 20_000 + 1_000_000);
    expect(s.freeArs).toBe(3_115_000 - 1_520_000);
    expect(s.rows.find((r) => r.categoryId === "alq")).toMatchObject({ paid: 0, pending: 500_000 });
    expect(s.rows.find((r) => r.categoryId === "sup")).toMatchObject({ paid: 180_000, pending: 0 });
  });

  it("detalla lo reservado por categoría y suma exactamente lo reservado", () => {
    expect(s.reservedRows).toEqual([
      { categoryId: "tdc", name: expect.any(String), isCards: true, pending: 700_000, budgetLeft: 300_000, reserved: 1_000_000 },
      { categoryId: "alq", name: expect.any(String), isCards: false, pending: 500_000, budgetLeft: 0, reserved: 500_000 },
      { categoryId: "sup", name: expect.any(String), isCards: false, pending: 0, budgetLeft: 20_000, reserved: 20_000 },
    ]);
    expect(s.reservedRows.reduce((t, r) => t + r.reserved, 0)).toBe(s.reservedArs);
    expect(s.budgetLeftArs).toBe(320_000);
    expect(s.pendingArs + s.budgetLeftArs).toBe(s.reservedArs);
  });

  it("lo cargado sin categoría y sin pagar también figura en el detalle de lo reservado", () => {
    const fixed = input.entries.find((e) => e.name === "Alquiler")!;
    const x = buildSummary({ ...input, entries: input.entries.map((e) => (e === fixed ? { ...e, categoryId: null } : e)) });
    expect(x.reservedRows.find((r) => r.categoryId === null)).toMatchObject({ name: "Sin categoría", pending: 500_000, budgetLeft: 0 });
    // el presupuesto de alquiler quedó sin nada cargado: se reserva entero, además del alquiler sin categoría
    expect(x.reservedRows.find((r) => r.categoryId === "alq")).toMatchObject({ pending: 0, budgetLeft: 400_000 });
    expect(x.reservedRows.reduce((t, r) => t + r.reserved, 0)).toBe(x.reservedArs);
  });

  it("al pagar, sale del disponible y el libre no cambia", () => {
    const paid = buildSummary({
      ...input,
      entries: input.entries.map((e) => (e.name === "Alquiler" ? { ...e, isDone: true } : e)),
      statements: input.statements.map((st) => ({ ...st, isPaid: true })),
    });
    expect(paid.availableArs).toBe(s.availableArs - 500_000 - 700_000);
    expect(paid.cardsPaidArs).toBe(700_000);
    expect(paid.freeArs).toBe(s.freeArs);
  });

  it("con 8 millones disponibles y 5 de presupuesto, quedan 3 libres", () => {
    const e = input.entries[0];
    const x = buildSummary({
      ...input, cards: [], statements: [],
      entries: [{ ...e, amount: 8_000_000 }],
      budgets: [{ categoryId: "alq", amount: 2_000_000 }, { categoryId: "sup", amount: 3_000_000 }],
    });
    expect(x.availableArs).toBe(8_000_000);
    expect(x.reservedArs).toBe(5_000_000);
    expect(x.freeArs).toBe(3_000_000);
    // gastar dentro del presupuesto baja el disponible pero no el libre
    const spent = buildSummary({
      ...input, cards: [], statements: [],
      entries: [{ ...e, amount: 8_000_000 }, { ...input.entries[3], amount: 1_000_000 }],
      budgets: [{ categoryId: "alq", amount: 2_000_000 }, { categoryId: "sup", amount: 3_000_000 }],
    });
    expect(spent.availableArs).toBe(7_000_000);
    expect(spent.freeArs).toBe(3_000_000);
    // pasarse del presupuesto sí baja el libre
    const over = buildSummary({
      ...input, cards: [], statements: [],
      entries: [{ ...e, amount: 8_000_000 }, { ...input.entries[3], amount: 3_500_000 }],
      budgets: [{ categoryId: "alq", amount: 2_000_000 }, { categoryId: "sup", amount: 3_000_000 }],
    });
    expect(over.freeArs).toBe(2_500_000);
  });

  it("sin presupuesto, libre es lo que queda después de todo lo cargado", () => {
    const x = buildSummary({ ...input, budgets: [] });
    expect(x.freeArs).toBe(3_300_000 - 500_000 - 185_000 - 700_000);
  });

  it("marca el alquiler de 500 mil contra un presupuesto de 400 mil", () => {
    const alq = s.rows.find((r) => r.categoryId === "alq")!;
    expect(alq).toMatchObject({ budget: 400_000, actual: 500_000, remaining: -100_000, status: "over" });
    expect(s.overRows.map((r) => r.categoryId)).toEqual(["alq"]);
  });

  it("avisa cuando una categoría está cerca del tope", () => {
    expect(s.rows.find((r) => r.categoryId === "sup")!.status).toBe("near");
  });

  it("la línea de tarjetas toma el gasto de los resúmenes", () => {
    expect(s.rows.find((r) => r.isCards)).toMatchObject({ budget: 1_000_000, actual: 700_000, status: "ok" });
  });

  it("muestra ingresos destinados y gastos sin categoría", () => {
    expect(s.rows.find((r) => r.categoryId === "aho")).toMatchObject({ earmarked: 300_000, status: "unused" });
    expect(s.rows.find((r) => r.categoryId === null)).toMatchObject({ actual: 5_000, status: "unbudgeted" });
  });

  it("calcula lo que queda sin presupuestar", () => {
    expect(s.budgetTotalArs).toBe(1_600_000);
    expect(s.unassignedArs).toBe(1_700_000);
  });
});

describe("patrimonio", () => {
  const items: BalanceItemDTO[] = [
    { id: "a", type: "ASSET", name: "Ahorros", currency: "USD", isArchived: false, values: { "2026-08": 1000, "2026-10": 1200 } },
    { id: "d", type: "DEBT", name: "Préstamo", currency: "ARS", isArchived: false, values: { "2026-09": 900_000 } },
    { id: "z", type: "ASSET", name: "Viejo", currency: "ARS", isArchived: true, values: { "2026-10": 5_000_000 } },
  ];

  it("arrastra el último saldo conocido", () => {
    expect(balanceAt(items[0], "2026-09")).toBe(1000);
    expect(balanceAt(items[0], "2026-07")).toBeNull();
    expect(balanceAt(items[1], "2026-10")).toBe(900_000);
  });

  it("calcula el patrimonio neto en pesos", () => {
    expect(netWorth(items, "2026-10", 1500)).toEqual({ assetsArs: 1_800_000, debtsArs: 900_000, netArs: 900_000 });
    expect(netWorth(items, "2026-08", 1500)).toEqual({ assetsArs: 1_500_000, debtsArs: 0, netArs: 1_500_000 });
  });
});

describe("formato de montos", () => {
  it("interpreta montos escritos a la argentina", () => {
    expect(parseMoney("1.250.000")).toBe(1_250_000);
    expect(parseMoney("1.250.000,50")).toBe(1_250_000.5);
    expect(parseMoney("500")).toBe(500);
    expect(Number.isNaN(parseMoney(""))).toBe(true);
  });

  it("agrupa miles mientras se escribe", () => {
    expect(formatMoneyInput("1250000")).toBe("1.250.000");
    expect(formatMoneyInput("1.250.0005")).toBe("12.500.005");
    expect(formatMoneyInput("1250,5")).toBe("1.250,5");
    expect(formatMoneyInput("abc")).toBe("");
    expect(numberToInput(400000)).toBe("400.000");
    expect(numberToInput(1234.5)).toBe("1.234,5");
    expect(numberToInput(null)).toBe("");
  });
});

describe("fechas", () => {
  it("suma días cruzando de mes", () => {
    expect(addDays("2026-10-28", 7)).toBe("2026-11-04");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("préstamos y deudas", () => {
  const loan = (over: Partial<LoanDTO>): LoanDTO => ({
    id: "l1", direction: "OWE", mode: "FIXED", name: "Préstamo", counterpart: null, categoryId: null,
    currency: "ARS", principal: 120_000, installments: 12, installmentAmount: null,
    interestRate: null, interestFrequency: null, startPeriod: "2026-10", dueDay: 10, endDate: null,
    isClosed: false, note: null, schedule: [], payments: [], ...over,
  });
  const paid = (period: string, amount: number, interest = 0, isDone = true): LoanPaymentDTO => ({
    entryId: period, period, amount, interest, isDone,
  });

  it("pasa la tasa a mensual según la frecuencia", () => {
    expect(monthlyRatePct({ interestRate: 3, interestFrequency: "MONTHLY" }, "2026-10")).toBe(3);
    expect(monthlyRatePct({ interestRate: 0.1, interestFrequency: "DAILY" }, "2026-10")).toBeCloseTo(3.1);
    expect(monthlyRatePct({ interestRate: 1, interestFrequency: "BIWEEKLY" }, "2026-10")).toBe(2);
    expect(monthlyRatePct({ interestRate: 1, interestFrequency: "WEEKLY" }, "2026-10")).toBe(4);
    expect(monthlyRatePct({ interestRate: null, interestFrequency: null }, "2026-10")).toBe(0);
  });

  it("calcula la cuota francesa (o capital / cuotas sin interés)", () => {
    expect(frenchInstallment(120_000, 0, 12)).toBe(10_000);
    expect(frenchInstallment(100_000, 5, 12)).toBeCloseTo(11_282.54, 2);
  });

  it("cuota fija: sugiere la francesa el primer mes y después repite la del mes anterior", () => {
    expect(proposeLoanPayment(loan({}), "2026-10")).toEqual({ number: 1, of: 12, amount: 10_000, interest: 0 });
    expect(proposeLoanPayment(loan({ installmentAmount: 11_000 }), "2026-10")!.amount).toBe(11_000);
    const l = loan({ installmentAmount: 11_000, payments: [paid("2026-10", 12_500)] });
    expect(proposeLoanPayment(l, "2026-11")).toEqual({ number: 2, of: 12, amount: 12_500, interest: 0 });
  });

  it("no propone cuota antes de empezar, después de la última ni si está cerrado", () => {
    expect(proposeLoanPayment(loan({}), "2026-09")).toBeNull();
    expect(proposeLoanPayment(loan({ installments: 1, payments: [paid("2026-10", 120_000)] }), "2026-11")).toBeNull();
    expect(proposeLoanPayment(loan({ isClosed: true }), "2026-10")).toBeNull();
  });

  it("calcula el interés del mes sobre el saldo pendiente", () => {
    const l = loan({ interestRate: 10, interestFrequency: "MONTHLY", installmentAmount: 30_000 });
    expect(proposeLoanPayment(l, "2026-10")!.interest).toBe(12_000);
    // 120.000 + 12.000 de interés − 30.000 pagados = 102.000 → 10 % = 10.200
    const after = { ...l, payments: [paid("2026-10", 30_000, 12_000)] };
    expect(loanState(after).balance).toBe(102_000);
    expect(proposeLoanPayment(after, "2026-11")!.interest).toBe(10_200);
  });

  it("una cuota sin pagar no baja el saldo", () => {
    const l = loan({ payments: [paid("2026-10", 10_000, 0, false)] });
    expect(loanState(l).balance).toBe(120_000);
    expect(loanState(l).paidCount).toBe(0);
  });

  it("cuotas variables: usa la cargada para cada mes", () => {
    const l = loan({
      mode: "SCHEDULE", principal: 300,
      schedule: [{ period: "2026-10", amount: 100 }, { period: "2026-12", amount: 200 }],
    });
    expect(proposeLoanPayment(l, "2026-10")).toEqual({ number: 1, of: 2, amount: 100, interest: 0 });
    expect(proposeLoanPayment(l, "2026-11")).toBeNull();
    expect(proposeLoanPayment(l, "2026-12")!.number).toBe(2);
  });

  it("sin cuotas fijas: propone el pago sugerido sin pasarse del saldo", () => {
    const l = loan({ mode: "OPEN", principal: 50_000, installments: null, installmentAmount: 30_000 });
    expect(proposeLoanPayment(l, "2026-10")).toEqual({ number: null, of: null, amount: 30_000, interest: 0 });
    const after = { ...l, payments: [paid("2026-10", 30_000)] };
    expect(proposeLoanPayment(after, "2026-11")!.amount).toBe(20_000);
    const done = { ...after, payments: [...after.payments, paid("2026-11", 20_000)] };
    expect(proposeLoanPayment(done, "2026-12")).toBeNull();
  });

  it("se da por terminado al pagar la última cuota o saldar la deuda", () => {
    const fixed = loan({ installments: 2, payments: [paid("2026-10", 60_000), paid("2026-11", 60_000, 0, false)] });
    expect(isLoanFinished(fixed)).toBe(false);
    expect(isLoanFinished({ ...fixed, payments: [paid("2026-10", 60_000), paid("2026-11", 60_000)] })).toBe(true);

    const sched = loan({ mode: "SCHEDULE", schedule: [{ period: "2026-10", amount: 1 }, { period: "2026-11", amount: 1 }] });
    expect(isLoanFinished({ ...sched, payments: [paid("2026-10", 1)] })).toBe(false);
    expect(isLoanFinished({ ...sched, payments: [paid("2026-10", 1), paid("2026-11", 1)] })).toBe(true);

    const open = loan({ mode: "OPEN", principal: 1000 });
    expect(isLoanFinished({ ...open, payments: [paid("2026-10", 600)] })).toBe(false);
    expect(isLoanFinished({ ...open, payments: [paid("2026-10", 600), paid("2026-11", 400)] })).toBe(true);
  });

  it("la propuesta del mes salta los préstamos que ya tienen cuota ese mes", () => {
    const a = loan({ id: "a" });
    const b = loan({ id: "b", direction: "OWED", payments: [paid("2026-10", 10_000, 0, false)] });
    const rows = buildLoanProposal([a, b], "2026-10");
    expect(rows.map((r) => r.loanId)).toEqual(["a"]);
    expect(rows[0].kind).toBe("EXPENSE");
    expect(buildLoanProposal([{ ...b, payments: [] }], "2026-10")[0].kind).toBe("INCOME");
  });

  describe("cuotas ya pagadas antes de usar la app", () => {
    it("cuota fija: las ubica en los meses anteriores a la primera cuota conocida", () => {
      const l = loan({ installments: 24, payments: [paid("2026-10", 10_000, 0, false)] });
      expect(pastPaymentPlan(l, 7, "2026-10")).toEqual({
        anchor: "2026-10",
        periods: ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"],
        max: 23,
      });
    });

    it("sin cuotas generadas todavía, toma como referencia el mes que se está viendo", () => {
      const l = loan({ installments: 12, startPeriod: "2026-08" });
      expect(pastPaymentPlan(l, 2, "2026-10").periods).toEqual(["2026-08", "2026-09"]);
    });

    it("no deja cargar más cuotas que las que tiene el préstamo", () => {
      const l = loan({ installments: 3, payments: [paid("2026-10", 1)] });
      const plan = pastPaymentPlan(l, 10, "2026-10");
      expect(plan.max).toBe(2);
      expect(plan.periods).toEqual(["2026-08", "2026-09"]);
    });

    it("con las cuotas anteriores cargadas, el número de cuota y el saldo quedan como en la realidad", () => {
      // 24 cuotas de 100.000; ya había pagado 7 y octubre es la octava
      const before = ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
      const l = loan({
        principal: 2_400_000, installments: 24, installmentAmount: 100_000, startPeriod: "2026-03",
        payments: [...before.map((p) => paid(p, 100_000)), paid("2026-10", 100_000, 0, false)],
      });
      expect(loanPaymentLabel(l, "2026-10")).toBe("8/24");
      expect(loanState(l)).toMatchObject({ paidCount: 7, totalPaid: 700_000, balance: 1_700_000 });
      // y el mes siguiente propone la cuota 9
      const next = { ...l, payments: l.payments.map((p) => ({ ...p, isDone: true })) };
      expect(proposeLoanPayment(next, "2026-11")).toMatchObject({ number: 9, of: 24, amount: 100_000 });
    });

    it("cuotas variables: toma las del cronograma anteriores que no se generaron", () => {
      const l = loan({
        mode: "SCHEDULE", startPeriod: "2026-07",
        schedule: [
          { period: "2026-07", amount: 10 }, { period: "2026-08", amount: 20 },
          { period: "2026-10", amount: 30 }, { period: "2026-11", amount: 40 },
        ],
        payments: [paid("2026-10", 30, 0, false)],
      });
      expect(pastPaymentPlan(l, 99, "2026-10")).toEqual({ anchor: "2026-10", periods: ["2026-07", "2026-08"], max: 2 });
    });

    it("sin cuotas fijas no aplica", () => {
      expect(pastPaymentPlan(loan({ mode: "OPEN" }), 3, "2026-10")).toMatchObject({ periods: [], max: 0 });
    });
  });

  it("arma el vencimiento sin pasarse de fin de mes", () => {
    expect(loanDueDate(10, "2026-10")).toBe("2026-10-10");
    expect(loanDueDate(31, "2026-02")).toBe("2026-02-28");
    expect(loanDueDate(null, "2026-10")).toBeNull();
  });

  it("numera las cuotas", () => {
    const l = loan({ payments: [paid("2026-10", 1), paid("2026-11", 1)] });
    expect(loanPaymentLabel(l, "2026-11")).toBe("2/12");
    expect(loanPaymentLabel(l, "2026-12")).toBeNull();
  });

  it("aparece en patrimonio con el saldo de cada mes", () => {
    const l = loan({ payments: [paid("2026-10", 10_000), paid("2026-11", 10_000, 0, false)] });
    const item = loanBalanceItem(l);
    expect(item.type).toBe("DEBT");
    expect(item.values).toEqual({ "2026-10": 110_000, "2026-11": 110_000 });
    expect(balanceAt(item, "2027-01")).toBe(110_000);
    expect(loanBalanceItem({ ...l, direction: "OWED" }).type).toBe("ASSET");
  });

  it("una deuda cuya primera cuota es el mes que viene ya cuenta en el patrimonio de hoy", () => {
    // "Sin cuotas fijas", cargada en octubre y con primer pago en noviembre
    const open = loan({ id: "mp", mode: "OPEN", principal: 2_400_000, installments: null, installmentAmount: 1_000_000, startPeriod: "2026-11", createdPeriod: "2026-10" });
    const item = loanBalanceItem(open);
    expect(balanceAt(item, "2026-10")).toBe(2_400_000);
    expect(balanceAt(item, "2026-09")).toBeNull();
    expect(netWorth([item], "2026-10", 1)).toEqual({ assetsArs: 0, debtsArs: 2_400_000, netArs: -2_400_000 });
    // si la primera cuota es anterior a la carga, manda la primera cuota
    expect(Object.keys(loanBalanceItem(loan({ startPeriod: "2026-03", createdPeriod: "2026-10" })).values)).toEqual(["2026-03"]);
  });

  it("las cuotas cuentan en el disponible y en su categoría", () => {
    const s = buildSummary({
      period: "2026-10", usdRate: 1, categories: [
        { id: "deu", kind: "EXPENSE", name: "Deudas", systemKey: null, isArchived: false, sortOrder: 1 },
      ],
      entries: [
        { id: "1", period: "2026-10", kind: "INCOME", recurringId: null, name: "Me deben", categoryId: null, targetCategoryId: null, currency: "ARS", amount: 50_000, date: null, isDone: false, note: null, loanId: "x", interestAmount: null },
        { id: "2", period: "2026-10", kind: "EXPENSE", recurringId: null, name: "Préstamo", categoryId: "deu", targetCategoryId: null, currency: "ARS", amount: 30_000, date: null, isDone: true, note: null, loanId: "y", interestAmount: 2_000 },
      ],
      budgets: [], cards: [], statements: [], purchases: [],
    });
    expect(s.loansArs).toBe(30_000);
    expect(s.loansPaidArs).toBe(30_000);
    expect(s.variableArs).toBe(0);
    // Lo que me deben y no cobré no es plata disponible: queda aparte como "por cobrar".
    expect(s.incomeArs).toBe(0);
    expect(s.receivableArs).toBe(50_000);
    expect(s.incomeFixedArs).toBe(0);
    expect(s.incomeReceivedArs).toBe(0);
    expect(s.availableArs).toBe(-30_000);
    expect(s.rows.find((r) => r.categoryId === "deu")!.actual).toBe(30_000);
  });

  describe("lo que me deben", () => {
    const base = {
      period: "2026-10", usdRate: 1500, budgets: [{ categoryId: "aho", amount: 100_000 }],
      cards: [], statements: [], purchases: [],
      categories: [
        { id: "aho", kind: "EXPENSE" as const, name: "Ahorro", systemKey: null, isArchived: false, sortOrder: 1 },
      ],
    };
    const e = (over: Partial<EntryDTO>): EntryDTO => ({
      id: Math.random().toString(36), period: "2026-10", kind: "INCOME", recurringId: null, name: "x",
      categoryId: null, targetCategoryId: null, currency: "ARS", amount: 0, date: null, isDone: false,
      note: null, loanId: null, interestAmount: null, ...over,
    });
    const sueldo = e({ recurringId: "r", name: "Sueldo", amount: 1_000_000 });
    const cuota = e({ loanId: "l", name: "Préstamo a Juan", amount: 200_000, targetCategoryId: "aho" });
    const cuotaUsd = e({ loanId: "l2", name: "Préstamo en dólares", amount: 100, currency: "USD" });

    it("no suma al disponible mientras no esté cobrado", () => {
      const s = buildSummary({ ...base, entries: [sueldo, cuota, cuotaUsd] });
      expect(s.incomeArs).toBe(1_000_000);
      expect(s.receivableArs).toBe(350_000);
      expect(s.availableArs).toBe(1_000_000);
      expect(s.unassignedArs).toBe(900_000);
      // tampoco figura como plata destinada a una categoría
      expect(s.rows.find((r) => r.categoryId === "aho")!.earmarked).toBe(0);
    });

    it("suma cuando se marca como cobrado", () => {
      const s = buildSummary({ ...base, entries: [sueldo, { ...cuota, isDone: true }, cuotaUsd] });
      expect(s.incomeArs).toBe(1_200_000);
      expect(s.receivableArs).toBe(150_000);
      expect(s.availableArs).toBe(1_200_000);
      expect(s.rows.find((r) => r.categoryId === "aho")!.earmarked).toBe(200_000);
    });

    it("no cambia cómo cuentan el sueldo sin cobrar ni las cuotas que pago", () => {
      expect(isReceivable(sueldo)).toBe(false);
      expect(isReceivable(e({ kind: "EXPENSE", loanId: "y", amount: 10 }))).toBe(false);
      expect(isReceivable(cuota)).toBe(true);
      expect(isReceivable({ ...cuota, isDone: true })).toBe(false);
      const s = buildSummary({ ...base, entries: [sueldo, e({ kind: "EXPENSE", loanId: "y", amount: 300_000 })] });
      // la cuota que debo y no pagué sigue en el disponible, pero ya no está libre
      expect(s.availableArs).toBe(1_000_000);
      expect(s.freeArs).toBe(1_000_000 - 300_000 - 100_000);
    });
  });
});
