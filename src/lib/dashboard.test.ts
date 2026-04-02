// Prevent prisma from connecting during unit tests
jest.mock("./prisma", () => ({ prisma: {} }));
jest.mock("../../prisma/constants", () => ({
  HOUSEHOLD_ID: "test_household",
  AVELINO_ID:   "test_avelino",
  MARIA_ID:     "test_maria",
}));

import { isMonthInFuture, isCurrentMonth, MONTH_NAMES } from "./dashboard";

/**
 * Unit tests for dashboard helpers (pure functions only).
 * getDashboardData integration is covered by the running app + seed data.
 */

describe("isMonthInFuture", () => {
  it("returns false for a past month/year", () => {
    expect(isMonthInFuture("enero", 2020)).toBe(false);
    expect(isMonthInFuture("octubre", 2025)).toBe(false);
  });

  it("returns true for a future year", () => {
    expect(isMonthInFuture("enero", 2099)).toBe(true);
  });

  it("returns false for the current month", () => {
    const now   = new Date();
    const month = MONTH_NAMES[now.getMonth()];
    const year  = now.getFullYear();
    expect(isMonthInFuture(month, year)).toBe(false);
  });

  it("returns true for a future month in the current year", () => {
    const now          = new Date();
    const futureMonth  = MONTH_NAMES[(now.getMonth() + 2) % 12];
    const futureYear   = now.getMonth() >= 10 ? now.getFullYear() + 1 : now.getFullYear();
    expect(isMonthInFuture(futureMonth, futureYear)).toBe(true);
  });
});

describe("isCurrentMonth", () => {
  it("returns true for the current month", () => {
    const now   = new Date();
    const month = MONTH_NAMES[now.getMonth()];
    expect(isCurrentMonth(month, now.getFullYear())).toBe(true);
  });

  it("returns false for a different month", () => {
    expect(isCurrentMonth("enero", 2020)).toBe(false);
  });
});

describe("MONTH_NAMES", () => {
  it("has 12 entries", () => {
    expect(MONTH_NAMES).toHaveLength(12);
  });

  it("starts with enero and ends with diciembre", () => {
    expect(MONTH_NAMES[0]).toBe("enero");
    expect(MONTH_NAMES[11]).toBe("diciembre");
  });
});
