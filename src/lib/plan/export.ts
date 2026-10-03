/**
 * Plan simple — resumen del mes para compartir (con una AI o con otra persona).
 * Lógica pura: arma un objeto listo para JSON y su versión en Markdown.
 */

import {
  LOAN_MODE_LABEL, balanceAt, buildSummary, cardLines, fmtArs, fmtMoney, isReceivable, loanBalanceItem,
  loanPaymentLabel, loanState, netWorth, periodLabel, projectInstallments, round2, toArs,
  type BalanceItemDTO, type BudgetDTO, type BudgetStatus, type CardDTO, type CategoryDTO, type Currency,
  type EntryDTO, type LoanDTO, type PurchaseDTO, type StatementDTO,
} from "./core";

/** Lo que hace falta del mes para armar el resumen (un subconjunto de PlanData). */
export interface ExportInput {
  period: string;
  today: string;
  started: boolean;
  usdRate: number;
  categories: CategoryDTO[];
  entries: EntryDTO[];
  budgets: BudgetDTO[];
  cards: CardDTO[];
  statements: StatementDTO[];
  purchases: PurchaseDTO[];
  loans: LoanDTO[];
}

interface Movimiento {
  nombre: string;
  tipo: string;
  categoria: string | null;
  monto: number;
  moneda: Currency;
  enPesos: number;
  estado: string;
  fecha: string | null;
}

export interface PlanExport {
  app: string;
  mes: string;
  mesNombre: string;
  generado: string;
  mesIniciado: boolean;
  dolar: number;
  notas: string[];
  resumen: {
    disponible: number;
    ingresos: number;
    porCobrar: number;
    gastosFijos: number;
    gastosDelMes: number;
    prestamosYDeudas: number;
    tarjetas: number;
    tarjetasEsEstimado: boolean;
    presupuestado: number;
    sinDestino: number;
  };
  ingresos: (Movimiento & { destino: string | null })[];
  gastos: Movimiento[];
  tarjetas: {
    tarjeta: string;
    aPagar: number;
    esEstimado: boolean;
    totalResumen: number | null;
    minimo: number | null;
    dolares: number | null;
    vencimiento: string | null;
    pagada: boolean;
  }[];
  cuotasFuturas: { mes: string; total: number }[];
  presupuesto: {
    categoria: string;
    presupuesto: number;
    gastado: number;
    restante: number;
    estado: string;
  }[];
  prestamosYDeudas: {
    nombre: string;
    tipo: "debo" | "me deben";
    contraparte: string | null;
    modalidad: string;
    saldo: number;
    moneda: Currency;
    cuotaDelMes: number | null;
    cuota: string | null;
    cuotaSaldada: boolean | null;
  }[];
  patrimonio: {
    tengo: number;
    debo: number;
    neto: number;
    detalle: { nombre: string; tipo: "tengo" | "debo"; saldo: number; moneda: Currency }[];
  };
}

const STATUS_LABEL: Record<BudgetStatus, string> = {
  ok: "dentro del presupuesto",
  near: "cerca del tope",
  over: "excedido",
  unbudgeted: "sin presupuesto",
  unused: "sin gastos",
};

export function buildExport(data: ExportInput, balanceItems: BalanceItemDTO[]): PlanExport {
  const { period, usdRate } = data;
  const summary = buildSummary(data);
  const categoryName = (id: string | null) => data.categories.find((c) => c.id === id)?.name ?? null;
  const ars = (amount: number, currency: Currency) => round2(toArs(amount, currency, usdRate));
  const entries = data.entries.filter((e) => e.period === period);

  const movimiento = (e: EntryDTO): Movimiento => {
    const income = e.kind === "INCOME";
    const tipo = e.loanId ? (income ? "me deben" : "cuota de préstamo") : e.recurringId ? "fijo" : "del mes";
    const estado = isReceivable(e)
      ? "por cobrar (no suma al disponible)"
      : e.recurringId || e.loanId
        ? e.isDone ? (income ? "cobrado" : "pagado") : "pendiente"
        : income ? "cobrado" : "pagado";
    return {
      nombre: e.name,
      tipo,
      categoria: categoryName(e.categoryId),
      monto: e.amount,
      moneda: e.currency,
      enPesos: ars(e.amount, e.currency),
      estado,
      fecha: e.date,
    };
  };

  const lines = cardLines(data.cards, data.statements, data.purchases, period, usdRate);

  const items = [
    ...balanceItems.filter((i) => !i.isArchived),
    ...data.loans.filter((l) => !l.isClosed).map(loanBalanceItem),
  ];
  const worth = netWorth(items, period, usdRate);

  return {
    app: "Omero Finance — Plan simple",
    mes: period,
    mesNombre: periodLabel(period),
    generado: data.today,
    mesIniciado: data.started,
    dolar: usdRate,
    notas: [
      "Montos en pesos argentinos (ARS) salvo que se indique otra moneda.",
      "Disponible = ingresos − gastos fijos − gastos del mes − préstamos y deudas − tarjetas.",
      "Lo que me deben y todavía no cobré figura como \"por cobrar\" y no suma al disponible.",
      "Tarjetas cuenta lo que se paga en el mes: el resumen si está cargado o, si no, una estimación por cuotas.",
    ],
    resumen: {
      disponible: round2(summary.availableArs),
      ingresos: round2(summary.incomeArs),
      porCobrar: round2(summary.receivableArs),
      gastosFijos: round2(summary.fixedArs),
      gastosDelMes: round2(summary.variableArs),
      prestamosYDeudas: round2(summary.loansArs),
      tarjetas: round2(summary.cardsArs),
      tarjetasEsEstimado: summary.cardsHasEstimate,
      presupuestado: round2(summary.budgetTotalArs),
      sinDestino: round2(summary.unassignedArs),
    },
    ingresos: entries
      .filter((e) => e.kind === "INCOME")
      .map((e) => ({ ...movimiento(e), destino: categoryName(e.targetCategoryId) })),
    gastos: entries.filter((e) => e.kind === "EXPENSE").map(movimiento),
    tarjetas: lines.map((l) => ({
      tarjeta: l.cardName,
      aPagar: round2(l.toPayArs),
      esEstimado: l.isEstimate,
      totalResumen: l.statement?.totalArs ?? null,
      minimo: l.statement?.minimumArs ?? null,
      dolares: l.statement?.usdAmount ?? null,
      vencimiento: l.statement?.dueDate ?? null,
      pagada: l.isPaid,
    })),
    cuotasFuturas: projectInstallments(data.purchases, period, 6, usdRate)
      .filter((m) => m.totalArs > 0)
      .map((m) => ({ mes: m.period, total: round2(m.totalArs) })),
    presupuesto: summary.rows.map((r) => ({
      categoria: r.name,
      presupuesto: round2(r.budget),
      gastado: round2(r.actual),
      restante: round2(r.remaining),
      estado: STATUS_LABEL[r.status],
    })),
    prestamosYDeudas: data.loans
      .filter((l) => !l.isClosed)
      .map((l) => {
        const payment = l.payments.find((p) => p.period === period);
        return {
          nombre: l.name,
          tipo: l.direction === "OWE" ? "debo" as const : "me deben" as const,
          contraparte: l.counterpart,
          modalidad: LOAN_MODE_LABEL[l.mode],
          saldo: loanState(l).balance,
          moneda: l.currency,
          cuotaDelMes: payment?.amount ?? null,
          cuota: loanPaymentLabel(l, period),
          cuotaSaldada: payment ? payment.isDone : null,
        };
      }),
    patrimonio: {
      tengo: round2(worth.assetsArs),
      debo: round2(worth.debtsArs),
      neto: round2(worth.netArs),
      detalle: items
        .map((i) => ({ item: i, saldo: balanceAt(i, period) }))
        .filter((x): x is { item: BalanceItemDTO; saldo: number } => x.saldo != null)
        .map(({ item, saldo }) => ({
          nombre: item.name,
          tipo: item.type === "ASSET" ? "tengo" as const : "debo" as const,
          saldo,
          moneda: item.currency,
        })),
    },
  };
}

// ─── Markdown ─────────────────────────────────────────────────────────────────

/** Escapa lo que rompería una celda de tabla. */
const cell = (text: string | null | undefined) => (text ?? "—").replace(/\|/g, "\\|").replace(/\n/g, " ");

function table(headers: string[], rows: (string | null)[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`),
  ].join("\n");
}

const shortDate = (iso: string | null) => {
  if (!iso) return null;
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
};

export function exportToMarkdown(x: PlanExport): string {
  const out: string[] = [];
  const money = (amount: number, currency: Currency, enPesos: number) =>
    currency === "USD" ? `${fmtMoney(amount, "USD")} (${fmtArs(enPesos)})` : fmtArs(amount);

  out.push(`# Resumen de ${x.mesNombre} — Omero Finance`);
  out.push(`Generado el ${shortDate(x.generado)}${x.dolar > 0 ? ` · Dólar del mes: ${fmtArs(x.dolar)}` : ""}`);
  if (!x.mesIniciado) out.push("> Este mes todavía no está iniciado: no tiene movimientos cargados.");

  const r = x.resumen;
  out.push("## Resumen");
  out.push([
    `- **Disponible este mes: ${fmtArs(r.disponible)}**`,
    `- Ingresos: ${fmtArs(r.ingresos)}`,
    ...(r.porCobrar > 0 ? [`- Por cobrar (no suma todavía): ${fmtArs(r.porCobrar)}`] : []),
    `- Gastos fijos: ${fmtArs(r.gastosFijos)}`,
    `- Gastos del mes: ${fmtArs(r.gastosDelMes)}`,
    ...(r.prestamosYDeudas > 0 ? [`- Préstamos y deudas: ${fmtArs(r.prestamosYDeudas)}`] : []),
    `- Tarjetas${r.tarjetasEsEstimado ? " (estimado)" : ""}: ${fmtArs(r.tarjetas)}`,
    ...(r.presupuestado > 0
      ? [`- Presupuestado: ${fmtArs(r.presupuestado)} · ${r.sinDestino >= 0 ? "sin destino" : "presupuestado de más"}: ${fmtArs(Math.abs(r.sinDestino))}`]
      : []),
  ].join("\n"));

  if (x.ingresos.length > 0) {
    out.push("## Ingresos");
    out.push(table(
      ["Ingreso", "Tipo", "Categoría", "Monto", "Estado", "Destino"],
      x.ingresos.map((i) => [i.nombre, i.tipo, i.categoria, money(i.monto, i.moneda, i.enPesos), i.estado, i.destino]),
    ));
  }

  if (x.gastos.length > 0) {
    out.push("## Gastos");
    out.push(table(
      ["Gasto", "Tipo", "Categoría", "Monto", "Estado", "Fecha"],
      x.gastos.map((g) => [g.nombre, g.tipo, g.categoria, money(g.monto, g.moneda, g.enPesos), g.estado, shortDate(g.fecha)]),
    ));
  }

  if (x.tarjetas.length > 0) {
    out.push("## Tarjetas");
    out.push(table(
      ["Tarjeta", "A pagar", "Total del resumen", "Mínimo", "En dólares", "Vence", "Estado"],
      x.tarjetas.map((t) => [
        t.tarjeta,
        `${fmtArs(t.aPagar)}${t.esEstimado ? " (estimado)" : ""}`,
        t.totalResumen != null ? fmtArs(t.totalResumen) : null,
        t.minimo != null ? fmtArs(t.minimo) : null,
        t.dolares ? fmtMoney(t.dolares, "USD") : null,
        shortDate(t.vencimiento),
        t.esEstimado ? "sin resumen cargado" : t.pagada ? "pagada" : "pendiente",
      ]),
    ));
  }

  if (x.cuotasFuturas.length > 0) {
    out.push("## Cuotas de tarjeta ya comprometidas");
    out.push(table(["Mes", "Total"], x.cuotasFuturas.map((c) => [periodLabel(c.mes), fmtArs(c.total)])));
  }

  if (x.presupuesto.length > 0) {
    out.push("## Presupuesto");
    out.push(table(
      ["Categoría", "Presupuesto", "Gastado", "Restante", "Estado"],
      x.presupuesto.map((p) => [
        p.categoria,
        p.presupuesto > 0 ? fmtArs(p.presupuesto) : null,
        fmtArs(p.gastado),
        p.presupuesto > 0 ? fmtArs(p.restante) : null,
        p.estado,
      ]),
    ));
  }

  if (x.prestamosYDeudas.length > 0) {
    out.push("## Préstamos y deudas");
    out.push(table(
      ["Nombre", "Tipo", "Con quién", "Modalidad", "Saldo", "Cuota del mes", "Estado de la cuota"],
      x.prestamosYDeudas.map((l) => [
        l.nombre,
        l.tipo,
        l.contraparte,
        l.modalidad,
        fmtMoney(l.saldo, l.moneda),
        l.cuotaDelMes != null ? `${fmtMoney(l.cuotaDelMes, l.moneda)}${l.cuota ? ` (${l.cuota})` : ""}` : null,
        l.cuotaSaldada == null ? null : l.cuotaSaldada ? (l.tipo === "debo" ? "pagada" : "cobrada") : "pendiente",
      ]),
    ));
  }

  if (x.patrimonio.detalle.length > 0) {
    out.push("## Patrimonio");
    out.push([
      `- **Neto: ${fmtArs(x.patrimonio.neto)}**`,
      `- Tengo: ${fmtArs(x.patrimonio.tengo)}`,
      `- Debo: ${fmtArs(x.patrimonio.debo)}`,
    ].join("\n"));
    out.push(table(
      ["Ítem", "Tipo", "Saldo"],
      x.patrimonio.detalle.map((d) => [d.nombre, d.tipo, fmtMoney(d.saldo, d.moneda)]),
    ));
  }

  out.push("## Cómo leer estos números");
  out.push(x.notas.map((n) => `- ${n}`).join("\n"));

  return out.join("\n\n") + "\n";
}
