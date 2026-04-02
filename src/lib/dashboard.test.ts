import { getDashboardData } from "./dashboard";

describe("getDashboardData", () => {
  it("returns data for a valid month", async () => {
    const data = await getDashboardData("enero", 2026);
    expect(data.month).toBe("enero");
    expect(data.year).toBe(2026);
    expect(data.totalIncomeArs).toBeGreaterThan(0);
    expect(data.categories.length).toBeGreaterThan(0);
    expect(data.users.length).toBeGreaterThan(0);
  });

  it("user percentages sum to 1", async () => {
    const data = await getDashboardData("enero", 2026);
    const total = data.users.reduce((s, u) => s + u.percentage, 0);
    expect(total).toBeCloseTo(1);
  });

  it("all categories have non-negative budgetedArs", async () => {
    const data = await getDashboardData("enero", 2026);
    for (const cat of data.categories) {
      expect(cat.budgetedArs).toBeGreaterThanOrEqual(0);
    }
  });

  it("GASTOS_LIBRES is never negative", async () => {
    const data = await getDashboardData("enero", 2026);
    const libres = data.categories.find((c) => c.key === "GASTOS_LIBRES");
    expect(libres).toBeDefined();
    expect(libres!.budgetedArs).toBeGreaterThanOrEqual(0);
  });

  it("marks overspent categories correctly", async () => {
    const data = await getDashboardData("enero", 2026);
    for (const cat of data.categories) {
      expect(cat.isOverspent).toBe(cat.availableArs < 0);
    }
  });

  it("auto categories are ALQUILER, TDC, GASTOS_FIJOS", async () => {
    const data = await getDashboardData("enero", 2026);
    const autoKeys = data.categories.filter((c) => c.isAuto).map((c) => c.key);
    expect(autoKeys).toEqual(expect.arrayContaining(["ALQUILER", "TDC", "GASTOS_FIJOS"]));
  });

  it("surplusArs matches income minus reserved amounts", async () => {
    const data = await getDashboardData("enero", 2026);
    const reservedTotal = data.categories
      .filter((c) => c.isReserved)
      .reduce((s, c) => s + c.budgetedArs, 0);
    expect(data.surplusArs).toBeCloseTo(data.totalIncomeArs - reservedTotal);
  });

  it("per-user rows exist for every user in every category", async () => {
    const data = await getDashboardData("enero", 2026);
    for (const cat of data.categories) {
      for (const user of data.users) {
        expect(cat.perUser[user.id]).toBeDefined();
      }
    }
  });
});
