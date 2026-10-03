import { buildExport, exportToMarkdown, type ExportInput } from "./export";
import type { BalanceItemDTO, EntryDTO, LoanDTO } from "./core";

const entry = (over: Partial<EntryDTO>): EntryDTO => ({
  id: Math.random().toString(36), period: "2026-10", kind: "EXPENSE", recurringId: null, name: "x",
  categoryId: null, targetCategoryId: null, currency: "ARS", amount: 0, date: null, isDone: false,
  note: null, loanId: null, interestAmount: null, ...over,
});

const loan: LoanDTO = {
  id: "l1", direction: "OWED", mode: "FIXED", name: "Préstamo a Juan", counterpart: "Juan", categoryId: null,
  currency: "ARS", principal: 600_000, installments: 3, installmentAmount: 200_000, interestRate: null,
  interestFrequency: null, startPeriod: "2026-10", dueDay: 10, endDate: null, isClosed: false, note: null,
  schedule: [], payments: [{ entryId: "e-l1", period: "2026-10", amount: 200_000, interest: 0, isDone: false }],
};

const input: ExportInput = {
  period: "2026-10",
  today: "2026-10-03",
  started: true,
  usdRate: 1500,
  categories: [
    { id: "alq", kind: "EXPENSE", name: "Alquiler", systemKey: null, isArchived: false, sortOrder: 1 },
    { id: "sup", kind: "EXPENSE", name: "Supermercado", systemKey: null, isArchived: false, sortOrder: 2 },
    { id: "tdc", kind: "EXPENSE", name: "Tarjetas de crédito", systemKey: "TDC", isArchived: false, sortOrder: 9 },
    { id: "sue", kind: "INCOME", name: "Sueldo", systemKey: null, isArchived: false, sortOrder: 1 },
  ],
  entries: [
    entry({ kind: "INCOME", recurringId: "r1", name: "Sueldo", categoryId: "sue", amount: 3_000_000, isDone: true }),
    entry({ kind: "INCOME", name: "Freelance", amount: 100, currency: "USD", isDone: true }),
    entry({ id: "e-l1", kind: "INCOME", loanId: "l1", name: "Préstamo a Juan", amount: 200_000, date: "2026-10-10" }),
    entry({ recurringId: "r2", name: "Alquiler", categoryId: "alq", amount: 500_000 }),
    entry({ name: "Coto | compra grande", categoryId: "sup", amount: 180_000, date: "2026-10-02", isDone: true }),
    entry({ period: "2026-09", name: "Otro mes", amount: 999 }),
  ],
  budgets: [{ categoryId: "alq", amount: 400_000 }],
  cards: [{ id: "c1", name: "VISA", entity: "Galicia", cardType: "VISA", ownerName: "Avelino" }],
  statements: [{
    id: "s1", cardId: "c1", period: "2026-10", dueDate: "2026-10-12", totalArs: 700_000, minimumArs: 90_000,
    usdAmount: null, payMode: "TOTAL", customAmount: null, isPaid: false,
  }],
  purchases: [{
    id: "p1", cardId: "c1", description: "Heladera", categoryId: null, currency: "ARS", amount: 1_200_000,
    installments: 12, firstPeriod: "2026-10", purchaseDate: null, note: null,
  }],
  loans: [loan],
};

const balance: BalanceItemDTO[] = [
  { id: "a", type: "ASSET", name: "Ahorros", currency: "USD", isArchived: false, values: { "2026-10": 1000 } },
  { id: "z", type: "ASSET", name: "Archivado", currency: "ARS", isArchived: true, values: { "2026-10": 9_999_999 } },
];

describe("exportar el resumen del mes", () => {
  const x = buildExport(input, balance);

  it("arma el resumen con los mismos números que Mi mes", () => {
    expect(x.mes).toBe("2026-10");
    expect(x.mesNombre).toBe("octubre 2026");
    expect(x.resumen).toMatchObject({
      ingresos: 3_150_000, porCobrar: 200_000, gastosFijos: 500_000, gastosDelMes: 180_000,
      tarjetas: 700_000,
      // solo salió lo ya pagado (el súper); alquiler y tarjeta siguen pendientes
      disponible: 3_150_000 - 180_000,
      yaPagado: 180_000,
      pendienteDePago: 1_200_000,
      reservado: 1_200_000,
      libre: 3_150_000 - 180_000 - 1_200_000,
    });
  });

  it("detalla en qué está lo reservado", () => {
    expect(x.reservadoPorCategoria.reduce((t, r) => t + r.reservado, 0)).toBe(x.resumen.reservado);
    expect(x.resumen.pendienteDePago + x.resumen.presupuestoPorGastar).toBe(x.resumen.reservado);
    expect(exportToMarkdown(x)).toContain("## En qué está lo reservado");
  });

  it("lista solo los movimientos del mes, con su estado", () => {
    expect(x.ingresos.map((i) => i.nombre)).toEqual(["Sueldo", "Freelance", "Préstamo a Juan"]);
    expect(x.ingresos[0]).toMatchObject({ tipo: "fijo", categoria: "Sueldo", estado: "cobrado" });
    expect(x.ingresos[1]).toMatchObject({ moneda: "USD", monto: 100, enPesos: 150_000 });
    expect(x.ingresos[2]).toMatchObject({ tipo: "me deben", estado: "por cobrar (no suma al disponible)" });
    expect(x.gastos.map((g) => g.nombre)).toEqual(["Alquiler", "Coto | compra grande"]);
    expect(x.gastos[0]).toMatchObject({ tipo: "fijo", estado: "pendiente" });
    expect(x.gastos[1]).toMatchObject({ tipo: "del mes", estado: "pagado", fecha: "2026-10-02" });
  });

  it("incluye tarjetas, cuotas futuras, presupuesto, préstamos y patrimonio", () => {
    expect(x.tarjetas).toEqual([{
      tarjeta: "Galicia · Visa · Avelino", aPagar: 700_000, esEstimado: false, totalResumen: 700_000,
      minimo: 90_000, dolares: null, vencimiento: "2026-10-12", pagada: false,
    }]);
    expect(x.cuotasFuturas).toHaveLength(6);
    expect(x.cuotasFuturas[0]).toEqual({ mes: "2026-10", total: 100_000 });
    expect(x.presupuesto.find((p) => p.categoria === "Alquiler")).toMatchObject({ presupuesto: 400_000, gastado: 500_000, restante: -100_000, estado: "excedido" });
    expect(x.prestamosYDeudas).toEqual([{
      nombre: "Préstamo a Juan", tipo: "me deben", contraparte: "Juan", modalidad: "Cuota fija", saldo: 600_000,
      moneda: "ARS", cuotaDelMes: 200_000, cuota: "1/3", cuotaSaldada: false,
    }]);
    // ahorros en dólares + lo que me deben; lo archivado no cuenta. El resumen de la tarjeta, sin pagar, es deuda.
    expect(x.patrimonio).toMatchObject({ tengo: 1_500_000 + 600_000, debo: 700_000, neto: 1_400_000 });
    expect(x.patrimonio.detalle.map((d) => d.nombre)).toEqual(["Ahorros", "Préstamo a Juan", "Tarjetas de crédito"]);
  });

  it("la deuda de una tarjeta sigue en el patrimonio del mes siguiente si no se pagó ni hay resumen nuevo", () => {
    const november = { ...input, period: "2026-11", statements: [] };
    // sin los resúmenes de otros meses no hay de dónde arrastrarla
    expect(buildExport(november, balance).patrimonio.debo).toBe(0);
    const carried = buildExport(november, balance, input.statements);
    expect(carried.patrimonio.debo).toBe(700_000);
    const paid = buildExport(november, balance, input.statements.map((s) => ({ ...s, isPaid: true })));
    expect(paid.patrimonio.debo).toBe(0);
  });

  it("el patrimonio incluye las deudas que empiezan a pagarse más adelante", () => {
    const later: LoanDTO = {
      ...loan, id: "l2", direction: "OWE", mode: "OPEN", name: "Mercado Pago", counterpart: null,
      principal: 2_400_000, installments: null, installmentAmount: 1_000_000,
      startPeriod: "2026-11", createdPeriod: "2026-10", payments: [],
    };
    const y = buildExport({ ...input, loans: [loan, later] }, balance);
    expect(y.patrimonio.detalle.map((d) => d.nombre)).toEqual(["Ahorros", "Préstamo a Juan", "Mercado Pago", "Tarjetas de crédito"]);
    expect(y.patrimonio).toMatchObject({ tengo: 2_100_000, debo: 2_400_000 + 700_000, neto: -1_000_000 });
    expect(y.prestamosYDeudas.map((l) => l.nombre)).toEqual(["Préstamo a Juan", "Mercado Pago"]);
  });

  it("es JSON válido de ida y vuelta", () => {
    expect(JSON.parse(JSON.stringify(x))).toEqual(x);
  });

  it("genera Markdown legible con tablas", () => {
    const md = exportToMarkdown(x);
    expect(md.startsWith("# Resumen de octubre 2026 — Omero Finance")).toBe(true);
    expect(md).toContain("**Disponible: $");
    expect(md).toContain("**Libre: $");
    expect(md).toContain("- Por cobrar (no suma todavía): $");
    expect(md).toContain("## Ingresos");
    expect(md).toContain("| Tarjeta | A pagar |");
    expect(md).toContain("Galicia · Visa · Avelino");
    // el "|" de un nombre no rompe la tabla
    expect(md).toContain("Coto \\| compra grande");
    expect(md).toContain("## Cómo leer estos números");
    // todas las filas de una tabla tienen la misma cantidad de columnas
    const gastos = md.split("## Gastos\n\n")[1].split("\n\n")[0].split("\n");
    const cols = (line: string) => line.replace(/\\\|/g, "").split("|").length;
    expect(new Set(gastos.map(cols)).size).toBe(1);
  });

  it("avisa si el mes no está iniciado y omite secciones vacías", () => {
    const empty = buildExport({ ...input, started: false, entries: [], budgets: [], statements: [], purchases: [], loans: [] }, []);
    const md = exportToMarkdown(empty);
    expect(md).toContain("todavía no está iniciado");
    expect(md).not.toContain("## Ingresos");
    expect(md).not.toContain("## Tarjetas");
    expect(md).not.toContain("## Patrimonio");
  });
});
