import { incomeCollection } from "./income-collection";

const today = "2026-11-04";
const pending = { isDone: false, collectedAt: null };

describe("cobro del ingreso actual", () => {
  it("confirma con fecha sin modificar la regla recurrente", () => {
    expect(incomeCollection({ isDone: true, collectedAt: "2026-11-02" }, pending, today)).toEqual({ isDone: true, collectedAt: new Date("2026-11-02T00:00:00Z") });
  });
  it("mantiene pendientes los pedidos de clientes anteriores sin estado", () => {
    expect(incomeCollection({}, pending, today)).toEqual(pending);
  });
  it("confirma con hoy si un cliente anterior solo envía isDone", () => {
    expect(incomeCollection({ isDone: true }, pending, today).collectedAt).toEqual(new Date("2026-11-04T00:00:00Z"));
  });
  it("conserva la fecha confirmada al volver a confirmar y la borra al deshacer", () => {
    const current = incomeCollection({ isDone: true, collectedAt: "2026-11-02" }, pending, today);
    expect(incomeCollection({ isDone: true }, current, today)).toEqual(current);
    expect(incomeCollection({ isDone: false }, current, today)).toEqual(pending);
  });
  it.each(["2026-11-05", "2026-02-30", "texto", null, ""])("rechaza fecha de cobro inválida: %s", (collectedAt) => {
    expect(() => incomeCollection({ isDone: true, collectedAt }, pending, today)).toThrow();
  });
  it("rechaza guardar fecha sin confirmar y estados inválidos", () => {
    expect(() => incomeCollection({ collectedAt: today }, pending, today)).toThrow();
    expect(() => incomeCollection({ isDone: "true" }, pending, today)).toThrow();
  });
});
