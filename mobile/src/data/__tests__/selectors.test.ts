// Corre con: npm test  (node:test + type stripping de Node, sin dependencias nativas).
import test from "node:test";
import assert from "node:assert/strict";
import { clampChapter, dailyAllowance, fixedProgressRatio, notificationBadgeCount, spendingTotal } from "../selectors.ts";

test("dailyAllowance: libre / días, hacia abajo", () => {
  assert.equal(dailyAllowance(1_103_400, 27), 40_866);
  assert.equal(dailyAllowance(100, 3), 33);
});
test("dailyAllowance: casos borde", () => {
  assert.equal(dailyAllowance(1000, 0), 0);
  assert.equal(dailyAllowance(-500, 10), 0);
  assert.equal(dailyAllowance(NaN, 10), 0);
});
test("fixedProgressRatio", () => {
  assert.equal(fixedProgressRatio({ paid: 3, total: 7, paidAmount: 0, totalAmount: 0 }).toFixed(2), "0.43");
  assert.equal(fixedProgressRatio({ paid: 0, total: 0, paidAmount: 0, totalAmount: 0 }), 0);
  assert.equal(fixedProgressRatio({ paid: 9, total: 7, paidAmount: 0, totalAmount: 0 }), 1);
});
test("spendingTotal", () => {
  assert.equal(spendingTotal([{ id: "a", amount: 550_000 }, { id: "b", amount: 180_000 }, { id: "c", amount: 20_000 }]), 750_000);
  assert.equal(spendingTotal([]), 0);
});
test("notificationBadgeCount: pendientes + avisos sin leer", () => {
  const pending = [{}, {}] as never[];
  const notices = [{ read: false }, { read: false }, { read: true }] as never[];
  assert.equal(notificationBadgeCount(pending, notices), 4);
});
test("clampChapter", () => {
  assert.equal(clampChapter(0), 1);
  assert.equal(clampChapter(2.4), 2);
  assert.equal(clampChapter(9), 3);
});
