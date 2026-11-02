/** @jest-environment node */
import { ApiError } from "./api-error";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    household: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    financeMember: { findUnique: jest.fn() },
    user: { findUniqueOrThrow: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { assertAccess, canAccess, resolveFinance, roleAllows, roleIn, type Action, type Role } from "./access";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const ACTIONS: Action[] = ["read", "create", "update", "delete", "manage"];
const EXPECTED: Record<Role, Action[]> = {
  ADMIN: ["read", "create", "update", "delete", "manage"],
  EDITOR: ["read", "create", "update", "delete"],
  VIEWER: ["read"],
};
const fin = (over = {}) => ({ id: "f1", ownerUserId: "owner", kind: "SHARED", name: "Casa", color: "violeta", ...over });

beforeEach(() => {
  jest.resetAllMocks();
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
});

describe("roleAllows", () => {
  for (const role of Object.keys(EXPECTED) as Role[]) {
    for (const action of ACTIONS) {
      it(`${role} × ${action}`, () => expect(roleAllows(role, action)).toBe(EXPECTED[role].includes(action)));
    }
  }
  it("sin rol nunca puede", () => ACTIONS.forEach((a) => expect(roleAllows(null, a)).toBe(false)));
});

describe("roleIn / canAccess", () => {
  it("el dueño es ADMIN sin fila de miembro", async () => {
    expect(await roleIn("owner", fin())).toBe("ADMIN");
    expect(db.financeMember.findUnique).not.toHaveBeenCalled();
  });
  it("miembro VIEWER no puede update", async () => {
    db.household.findUnique.mockResolvedValue(fin());
    db.financeMember.findUnique.mockResolvedValue({ role: "VIEWER" });
    expect(await canAccess({ id: "u" }, { householdId: "f1" }, "update")).toBe(false);
    expect(await canAccess({ id: "u" }, { householdId: "f1" }, "read")).toBe(true);
  });
  it("no miembro → false", async () => {
    db.household.findUnique.mockResolvedValue(fin());
    db.financeMember.findUnique.mockResolvedValue(null);
    expect(await canAccess({ id: "x" }, { householdId: "f1" }, "read")).toBe(false);
  });
  it("finanza inexistente → false", async () => {
    db.household.findUnique.mockResolvedValue(null);
    expect(await canAccess({ id: "x" }, { householdId: "nada" }, "read")).toBe(false);
  });
});

describe("assertAccess", () => {
  it("fila nula → 404", async () => {
    await expect(assertAccess({ id: "u" }, null, "read")).rejects.toMatchObject({ status: 404 });
  });
  it("no miembro → 404 (no revela existencia)", async () => {
    db.household.findUnique.mockResolvedValue(fin());
    db.financeMember.findUnique.mockResolvedValue(null);
    await expect(assertAccess({ id: "x" }, { householdId: "f1" }, "read")).rejects.toMatchObject({ status: 404 });
  });
  it("miembro sin permiso → 403 con mensaje de Lector", async () => {
    db.household.findUnique.mockResolvedValue(fin());
    db.financeMember.findUnique.mockResolvedValue({ role: "VIEWER" });
    await expect(assertAccess({ id: "u" }, { householdId: "f1" }, "update")).rejects.toMatchObject({
      status: 403, message: expect.stringContaining("Lector"),
    });
  });
  it("EDITOR puede update", async () => {
    db.household.findUnique.mockResolvedValue(fin());
    db.financeMember.findUnique.mockResolvedValue({ role: "EDITOR" });
    await expect(assertAccess({ id: "u" }, { householdId: "f1" }, "update")).resolves.toBeUndefined();
  });
});

describe("resolveFinance", () => {
  it("sin header usa el fallback", async () => {
    db.household.findUnique.mockResolvedValue(fin({ id: "mine", ownerUserId: "u" }));
    const r = await resolveFinance("u", null, "mine");
    expect(r.householdId).toBe("mine");
    expect(r.role).toBe("ADMIN");
  });
  it("header ajeno → 403", async () => {
    db.household.findUnique.mockResolvedValue(fin());
    db.financeMember.findUnique.mockResolvedValue(null);
    await expect(resolveFinance("u", "f1", "mine")).rejects.toMatchObject({ status: 403 });
  });
  it("header inexistente → 403 con el mismo mensaje", async () => {
    db.household.findUnique.mockResolvedValue(null);
    const err = await resolveFinance("u", "nope", "mine").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, message: "No tenés acceso a esa finanza" });
  });
  it("header propio devuelve el rol de miembro", async () => {
    db.household.findUnique.mockResolvedValue(fin());
    db.financeMember.findUnique.mockResolvedValue({ role: "EDITOR" });
    const r = await resolveFinance("u", "f1", "mine");
    expect(r).toMatchObject({ householdId: "f1", role: "EDITOR" });
  });
  it("hogar legacy sin dueño (pre-backfill) y sin header → ADMIN legacy", async () => {
    db.household.findUnique.mockResolvedValue(fin({ id: "legacy", ownerUserId: null }));
    db.financeMember.findUnique.mockResolvedValue(null);
    expect((await resolveFinance("u", null, "legacy")).role).toBe("ADMIN");
  });
  it("hogar legacy sin dueño pero CON header → no se concede (403)", async () => {
    db.household.findUnique.mockResolvedValue(fin({ id: "legacy", ownerUserId: null }));
    db.financeMember.findUnique.mockResolvedValue(null);
    await expect(resolveFinance("u", "legacy", "x")).rejects.toMatchObject({ status: 403 });
  });
  it("usuario sin acceso a su fallback → cae a su Personal, creándola una sola vez", async () => {
    // fallback ajeno (con dueño, sin fila para u)
    db.household.findUnique.mockResolvedValue(fin({ id: "otra", ownerUserId: "otro" }));
    db.financeMember.findUnique.mockResolvedValue(null);
    db.household.findFirst.mockResolvedValue(null);
    db.user.findUniqueOrThrow.mockResolvedValue({ id: "u", name: "Maria" });
    db.household.create.mockResolvedValue({ id: "p1" });
    db.household.findUniqueOrThrow.mockResolvedValue(fin({ id: "p1", ownerUserId: "u", kind: "PERSONAL", name: "Personal de Maria", color: null }));
    const r = await resolveFinance("u", null, "otra");
    expect(r.householdId).toBe("p1");
    expect(db.household.create).toHaveBeenCalledTimes(1);

    // segunda vez: ya existe, no vuelve a crear
    db.household.findFirst.mockResolvedValue({ id: "p1" });
    await resolveFinance("u", null, "otra");
    expect(db.household.create).toHaveBeenCalledTimes(1);
  });
});
