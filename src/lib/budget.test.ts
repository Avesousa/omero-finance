import {
  calculateCategoryAmount,
  calculateCategoryPercentage,
  calculatePerUserBudget,
  calculateGastosLibres,
  calculateAmountToPay,
  calculateLoanTotal,
  calculateFunds,
} from "./budget";

describe("calculateCategoryAmount", () => {
  it("returns manualAmount when set", () => {
    expect(calculateCategoryAmount(1_000_000, { category: "X", manualAmount: 500_000 })).toBe(500_000);
  });

  it("returns percentage of income when manualPercentage set", () => {
    expect(calculateCategoryAmount(1_000_000, { category: "X", manualPercentage: 0.1 })).toBe(100_000);
  });

  it("returns autoAmount when no override", () => {
    expect(calculateCategoryAmount(1_000_000, { category: "X" }, 200_000)).toBe(200_000);
  });

  it("prefers manualAmount over manualPercentage", () => {
    expect(
      calculateCategoryAmount(1_000_000, { category: "X", manualAmount: 300_000, manualPercentage: 0.5 })
    ).toBe(300_000);
  });
});

describe("calculateCategoryPercentage", () => {
  it("calculates correctly", () => {
    expect(calculateCategoryPercentage(200_000, 1_000_000)).toBe(0.2);
  });

  it("returns 0 when total income is 0", () => {
    expect(calculateCategoryPercentage(200_000, 0)).toBe(0);
  });
});

describe("calculatePerUserBudget", () => {
  const users = [
    { userId: "a", name: "Avelino", incomeArs: 7_000_000 },
    { userId: "m", name: "Maria", incomeArs: 3_000_000 },
  ];

  it("splits proportionally", () => {
    const result = calculatePerUserBudget(1_000_000, users);
    expect(result["a"]).toBeCloseTo(700_000);
    expect(result["m"]).toBeCloseTo(300_000);
  });

  it("returns zeros when total income is 0", () => {
    const result = calculatePerUserBudget(1_000_000, [
      { userId: "a", name: "Avelino", incomeArs: 0 },
    ]);
    expect(result["a"]).toBe(0);
  });
});

describe("calculateGastosLibres", () => {
  it("returns remainder after reserved amounts", () => {
    expect(calculateGastosLibres(1_000_000, [300_000, 200_000, 100_000])).toBe(400_000);
  });

  it("never returns negative", () => {
    expect(calculateGastosLibres(100_000, [200_000, 300_000])).toBe(0);
  });

  it("returns full income when no reserved amounts", () => {
    expect(calculateGastosLibres(1_000_000, [])).toBe(1_000_000);
  });
});

describe("calculateAmountToPay", () => {
  it("uses customAmount when set", () => {
    expect(calculateAmountToPay({
      totalAmountArs: 500_000,
      customAmount: 200_000,
      payMinimum: false,
    })).toBe(200_000);
  });

  it("uses minimum when payMinimum is true", () => {
    expect(calculateAmountToPay({
      totalAmountArs: 500_000,
      minimumPayment: 80_000,
      payMinimum: true,
    })).toBe(80_000);
  });

  it("uses total + USD conversion when no override", () => {
    expect(calculateAmountToPay({
      totalAmountArs: 500_000,
      usdAmount: 100,
      dollarRateSnapshot: 1477,
      payMinimum: false,
    })).toBe(647_700);
  });

  it("prioritizes customAmount over payMinimum", () => {
    expect(calculateAmountToPay({
      totalAmountArs: 500_000,
      minimumPayment: 80_000,
      customAmount: 200_000,
      payMinimum: true,
    })).toBe(200_000);
  });
});

describe("calculateLoanTotal", () => {
  it("calculates total with interest", () => {
    // 40,000 principal × 18% weekly × 4 weeks = 40,000 + 28,800 = 68,800
    expect(calculateLoanTotal(40_000, 0.18, 4)).toBeCloseTo(68_800);
  });

  it("returns principal when rate is 0", () => {
    expect(calculateLoanTotal(100_000, 0, 12)).toBe(100_000);
  });
});

describe("calculateFunds", () => {
  it("separates ARS and USD movements", () => {
    const movements = [
      { currency: "ARS" as const, amount: 1_000_000 },
      { currency: "ARS" as const, amount: -200_000 },
      { currency: "USD" as const, amount: 500 },                            // not converted
      { currency: "USD" as const, amount: 300, amountArs: 442_000 },       // converted
    ];
    const { arsTotal, usdTotal } = calculateFunds(movements);
    expect(arsTotal).toBe(1_000_000 - 200_000 + 442_000);
    expect(usdTotal).toBe(500);
  });

  it("returns zeros for empty movements", () => {
    expect(calculateFunds([])).toEqual({ arsTotal: 0, usdTotal: 0 });
  });
});
