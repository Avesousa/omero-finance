import {
  addDays, addMonths, monthDiff, daysInPeriod, isValidPeriod, currentPeriod, periodLabel,
  occurrencesInPeriod, monthlyAmount, buildProposal,
  installmentFor, statementToPay, cardLines, projectInstallments,
  buildSummary, balanceAt, netWorth,
  parseMoney, formatMoneyInput, numberToInput,
  type CategoryDTO, type EntryDTO, type PurchaseDTO, type StatementDTO,
  type BalanceItemDTO, type RecurringDTO,
} from "./core";

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
    const cards = [{ id: "card1", name: "VISA" }, { id: "card2", name: "MC" }, { id: "card3", name: "AMEX" }];
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
    date: null, isDone: false, note: null, ...over,
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
    cards: [{ id: "card1", name: "VISA" }],
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
    expect(s.availableArs).toBe(3_300_000 - 500_000 - 185_000 - 700_000);
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
