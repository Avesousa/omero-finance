import test from "node:test";
import assert from "node:assert/strict";
import { equityRatio, goalProgress, nestStage, wealthTotals } from "../selectors.ts";
import type { WealthGoal, WealthItem } from "../types.ts";

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("equityRatio: activos sobre activos + deudas", () => {
  near(equityRatio(8_210_000, 5_731_050), 8_210_000 / 13_941_050);
  assert.equal(equityRatio(0, 0), 0);
  assert.equal(equityRatio(0, 100), 0);
  assert.equal(equityRatio(100, 0), 1);
});

test("nestStage: límites de capítulo", () => {
  assert.equal(nestStage(0).chapter, 1);
  assert.equal(nestStage(0.33).chapter, 1);
  assert.equal(nestStage(1 / 3).chapter, 2);
  assert.equal(nestStage(0.66).chapter, 2);
  assert.equal(nestStage(2 / 3).chapter, 3);
  assert.equal(nestStage(1).chapter, 3);
});

test("nestStage: progreso dentro del tercio", () => {
  near(nestStage(0).progress, 0);
  near(nestStage(1 / 6).progress, 0.5);
  near(nestStage(0.5).progress, 0.5);
  near(nestStage(1).progress, 1);
  near(nestStage(5 / 6).progress, 0.5);
});

test("nestStage: acota y tolera valores inválidos", () => {
  assert.deepEqual(nestStage(-1), { chapter: 1, progress: 0, equity: 0 });
  assert.deepEqual(nestStage(2), { chapter: 3, progress: 1, equity: 1 });
  assert.equal(nestStage(Number.NaN).chapter, 1);
});

test("nestStage: datos del mock dan capítulo 2, avance ~0,77", () => {
  const items: WealthItem[] = [
    { id: "a", kind: "asset", source: "manual", name: "a", currency: "ARS", amount: 8_210_000, previous: null },
    { id: "d", kind: "debt", source: "manual", name: "d", currency: "ARS", amount: 5_731_050, previous: null },
  ];
  const { assets, debts } = wealthTotals(items, 1450);
  const stage = nestStage(equityRatio(assets, debts));
  assert.equal(stage.chapter, 2);
  near(stage.progress, 0.768, 0.005);
});

const goal = (over: Partial<WealthGoal> = {}): WealthGoal => ({
  id: "g", name: "x", target: 1_500_000, saved: 450_000, monthly: 175_000, currency: "ARS", ...over,
});

test("goalProgress: ratio, faltante y meses", () => {
  const p = goalProgress(goal());
  near(p.ratio, 0.3);
  assert.equal(p.missing, 1_050_000);
  assert.equal(p.monthsLeft, 6);
});

test("goalProgress: sin aporte no hay meses", () => {
  assert.equal(goalProgress(goal({ monthly: null })).monthsLeft, null);
  assert.equal(goalProgress(goal({ monthly: 0 })).monthsLeft, null);
});

test("goalProgress: meta cumplida o pasada", () => {
  const p = goalProgress(goal({ saved: 2_000_000 }));
  assert.equal(p.ratio, 1);
  assert.equal(p.missing, 0);
  assert.equal(p.monthsLeft, 0);
  assert.equal(goalProgress(goal({ target: 0 })).ratio, 0);
});
