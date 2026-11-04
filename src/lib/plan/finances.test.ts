/** @jest-environment node */
jest.mock("@/lib/prisma", () => ({ prisma: {} }));

import { FINANCE_PALETTE, isPaletteKey, mapCategoriesByName, moveEntries } from "./finances";

type Row = Record<string, unknown>;
function makeTx(opts: { entries: Row[]; cats?: Row[]; fromMonths?: Row[]; toMonths?: Row[]; updateCount?: (id: string) => number }) {
  const tx = {
    planEntry: {
      findMany: jest.fn().mockResolvedValue(opts.entries),
      updateMany: jest.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve({ count: opts.updateCount ? opts.updateCount(where.id) : 1 })),
    },
    planCategory: {
      findMany: jest.fn().mockImplementation(({ where }: { where: { householdId: string; id?: unknown } }) =>
        Promise.resolve((opts.cats ?? []).filter((c) => c.householdId === where.householdId))),
    },
    planMonth: {
      findMany: jest.fn().mockImplementation(({ where }: { where: { householdId: string } }) =>
        Promise.resolve((where.householdId === "A" ? opts.fromMonths : opts.toMonths) ?? [])),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  return tx as unknown as Parameters<typeof moveEntries>[0] & typeof tx;
}
const entry = (id: string, over: Row = {}) => ({
  id, householdId: "A", period: "2026-11", recurringId: null, loanId: null, categoryId: null, targetCategoryId: null,
  amount: "100", currency: "ARS", isDone: false, ...over,
});

describe("paleta", () => {
  it("isPaletteKey", () => {
    expect(isPaletteKey("violeta")).toBe(true);
    expect(isPaletteKey("fucsia")).toBe(false);
    expect(isPaletteKey("toString")).toBe(false); // no hereda de Object.prototype
    expect(isPaletteKey(null)).toBe(false);
  });
  it("las 6 claves de la spec", () => {
    expect(Object.keys(FINANCE_PALETTE)).toEqual(["violeta", "azul", "naranja", "rosa", "turquesa", "rojo"]);
  });
});

describe("mapCategoriesByName", () => {
  const cats = [
    { id: "a1", householdId: "A", kind: "EXPENSE", name: "Supermercado" },
    { id: "a2", householdId: "A", kind: "INCOME", name: "Sueldo" },
    { id: "a3", householdId: "A", kind: "EXPENSE", name: "Rara" },
    { id: "b1", householdId: "B", kind: "EXPENSE", name: "supermercado", isArchived: false },
    { id: "b2", householdId: "B", kind: "EXPENSE", name: "Sueldo", isArchived: false }, // mismo nombre, otro kind
  ];
  it("ignora mayúsculas, respeta kind y devuelve null sin equivalente", async () => {
    const m = await mapCategoriesByName(makeTx({ entries: [], cats }), "A", "B", ["a1", "a2", "a3"]);
    expect(m.get("a1")).toBe("b1");
    expect(m.get("a2")).toBeNull();
    expect(m.get("a3")).toBeNull();
  });
  it("ids que no existen quedan en null", async () => {
    const m = await mapCategoriesByName(makeTx({ entries: [], cats }), "A", "B", ["zzz"]);
    expect(m.get("zzz")).toBeNull();
  });
  it("prefiere la categoría activa a la archivada", async () => {
    const withArchived = [...cats, { id: "b9", householdId: "B", kind: "EXPENSE", name: "Supermercado", isArchived: true }];
    const m = await mapCategoriesByName(makeTx({ entries: [], cats: withArchived }), "A", "B", ["a1"]);
    expect(m.get("a1")).toBe("b1");
  });
});

describe("moveEntries", () => {
  const cats = [
    { id: "a1", householdId: "A", kind: "EXPENSE", name: "Supermercado" },
    { id: "b1", householdId: "B", kind: "EXPENSE", name: "Supermercado", isArchived: false },
  ];
  it("separa moved/skipped (fijo, cuota, inexistente) y no los toca", async () => {
    const tx = makeTx({
      entries: [entry("e1"), entry("e2", { recurringId: "r" }), entry("e3", { loanId: "l" })],
      cats,
    });
    const r = await moveEntries(tx, { entryIds: ["e1", "e2", "e3", "e4"], fromId: "A", toId: "B" });
    expect(r.moved).toEqual(["e1"]);
    expect(r.skipped).toEqual([
      { id: "e2", reason: "Es un fijo; editá el fijo." },
      { id: "e3", reason: "Es una cuota de un préstamo." },
      { id: "e4", reason: "No encontrado" },
    ]);
    expect(tx.planEntry.updateMany).toHaveBeenCalledTimes(1);
  });
  it("cambia solo householdId y remapea categoryId / targetCategoryId (no toca period/amount/isDone)", async () => {
    const tx = makeTx({ entries: [entry("e1", { categoryId: "a1", targetCategoryId: "a1" })], cats });
    await moveEntries(tx, { entryIds: ["e1"], fromId: "A", toId: "B" });
    expect(tx.planEntry.updateMany).toHaveBeenCalledWith({
      where: { id: "e1", householdId: "A" },
      data: { householdId: "B", categoryId: "b1", targetCategoryId: "b1" },
    });
  });
  it("mes de destino sin iniciar → se crea con el mismo usdRate del origen", async () => {
    const tx = makeTx({ entries: [entry("e1")], cats, fromMonths: [{ period: "2026-11", usdRate: "1200.5" }], toMonths: [] });
    await moveEntries(tx, { entryIds: ["e1"], fromId: "A", toId: "B" });
    expect(tx.planMonth.create).toHaveBeenCalledWith({ data: { householdId: "B", period: "2026-11", usdRate: "1200.5" } });
  });
  it("mes de destino ya iniciado → se respeta su tipo de cambio", async () => {
    const tx = makeTx({
      entries: [entry("e1")], cats,
      fromMonths: [{ period: "2026-11", usdRate: "1200" }], toMonths: [{ period: "2026-11", usdRate: "1300" }],
    });
    await moveEntries(tx, { entryIds: ["e1"], fromId: "A", toId: "B" });
    expect(tx.planMonth.create).not.toHaveBeenCalled();
  });
  it("concurrencia: si otro request ya lo movió (count 0) va a skipped", async () => {
    const tx = makeTx({ entries: [entry("e1")], cats, updateCount: () => 0 });
    const r = await moveEntries(tx, { entryIds: ["e1"], fromId: "A", toId: "B" });
    expect(r.moved).toEqual([]);
    expect(r.skipped).toEqual([{ id: "e1", reason: "No encontrado" }]);
  });
  it("ids repetidos se procesan una vez", async () => {
    const tx = makeTx({ entries: [entry("e1")], cats });
    const r = await moveEntries(tx, { entryIds: ["e1", "e1"], fromId: "A", toId: "B" });
    expect(r.moved).toEqual(["e1"]);
  });
  it("nada movible → no toca meses ni entradas", async () => {
    const tx = makeTx({ entries: [entry("e2", { recurringId: "r" })], cats });
    const r = await moveEntries(tx, { entryIds: ["e2"], fromId: "A", toId: "B" });
    expect(r.moved).toEqual([]);
    expect(tx.planEntry.updateMany).not.toHaveBeenCalled();
    expect(tx.planMonth.create).not.toHaveBeenCalled();
  });
});
