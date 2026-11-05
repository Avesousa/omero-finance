/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
import { currentPeriod, todayIso, addDays, addMonths } from "../core";
import type { TestUser } from "./harness";

// Destino explícito para una base temporal; el arnés rechaza cualquier host remoto.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const { assertLocalDb, call, cleanup, makeUser } = require("./harness") as typeof import("./harness");
assertLocalDb();
const { prisma } = require("@/lib/prisma") as typeof import("@/lib/prisma");
const { POST } = require("@/app/api/plan/entries/route") as typeof import("@/app/api/plan/entries/route");
const { PATCH } = require("@/app/api/plan/entries/[id]/route") as typeof import("@/app/api/plan/entries/[id]/route");
const patchEntry: Parameters<typeof call>[0] = (req, ctx) => PATCH(req, { params: ctx.params.then(({ id }) => ({ id })) });
const { loadPlan } = require("../server") as typeof import("../server");
const period = currentPeriod();
let user: TestUser;

beforeAll(async () => {
  user = await makeUser("Income");
  await prisma.planMonth.create({ data: { householdId: user.personalId, period, usdRate: 1000 } });
});
afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

const body = () => ({ kind: "INCOME", period, name: "Sueldo", amount: 1000, currency: "ARS", fixed: { frequency: "MONTHLY", dueDay: 1 } });

it("crea sueldo cobrado, expone su fecha y conserva la regla sin estado de cobro", async () => {
  const r = await call(POST, user, { method: "POST", body: { ...body(), isDone: true, collectedAt: todayIso() } });
  expect(r.status).toBe(201);
  const entry = await prisma.planEntry.findUniqueOrThrow({ where: { id: r.json.id } });
  expect(entry.isDone).toBe(true);
  expect(entry.collectedAt?.toISOString().slice(0, 10)).toBe(todayIso());
  const rule = await prisma.planRecurring.findUniqueOrThrow({ where: { id: entry.recurringId! } });
  expect(rule).toMatchObject({ amount: expect.anything(), dueDay: 1, isActive: true });
  const plan = await loadPlan(user.personalId, period);
  expect(plan.entries.find((e) => e.id === entry.id)?.collectedAt).toBe(todayIso());
  const { POST: startMonth } = require("@/app/api/plan/month/route") as typeof import("@/app/api/plan/month/route");
  const next = addMonths(period, 1);
  const started = await call(startMonth, user, { method: "POST", body: { period: next, usdRate: 1000, entries: [{ recurringId: rule.id, amount: 1000 }] } });
  expect(started.status).toBe(201);
  const future = await prisma.planEntry.findFirstOrThrow({ where: { recurringId: rule.id, period: next } });
  expect(future).toMatchObject({ isDone: false, collectedAt: null });
});

it("confirma un sueldo existente sin duplicarlo ni cambiar su regla; permite deshacer", async () => {
  const r = await call(POST, user, { method: "POST", body: body() });
  expect(r.status).toBe(201);
  const entry = await prisma.planEntry.findUniqueOrThrow({ where: { id: r.json.id } });
  expect(entry).toMatchObject({ isDone: false, collectedAt: null });
  const rule = await prisma.planRecurring.findUniqueOrThrow({ where: { id: entry.recurringId! } });
  const count = await prisma.planEntry.count({ where: { householdId: user.personalId } });
  const paid = await call(patchEntry, user, { method: "PATCH", params: { id: entry.id }, body: { isDone: true, collectedAt: todayIso() } });
  expect(paid.status).toBe(200);
  expect(await prisma.planEntry.count({ where: { householdId: user.personalId } })).toBe(count);
  expect(await prisma.planRecurring.findUnique({ where: { id: rule.id } })).toEqual(rule);
  const undone = await call(patchEntry, user, { method: "PATCH", params: { id: entry.id }, body: { isDone: false } });
  expect(undone.status).toBe(200);
  expect(await prisma.planEntry.findUnique({ where: { id: entry.id } })).toMatchObject({ isDone: false, collectedAt: null });
});

it("rechaza fechas futuras antes de crear regla o movimiento", async () => {
  const count = await prisma.planRecurring.count({ where: { householdId: user.personalId } });
  const r = await call(POST, user, { method: "POST", body: { ...body(), isDone: true, collectedAt: addDays(todayIso(), 1) } });
  expect(r.status).toBe(400);
  expect(await prisma.planRecurring.count({ where: { householdId: user.personalId } })).toBe(count);
});
