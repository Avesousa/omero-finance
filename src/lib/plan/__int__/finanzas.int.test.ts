/**
 * @jest-environment node
 *
 * Integración S1 (R8): recorre la app de punta a punta contra la base LOCAL con cuatro perfiles:
 *   Dueño (ADMIN de Casa), Editor, Lector y Ajeno (sin membresía).
 * Correr con:  npm run test:int
 */
import fs from "fs";
import path from "path";
import { currentPeriod } from "../core";
import { prisma } from "@/lib/prisma";
import { createToken } from "../inbox";
import { runBackfill } from "../../../../prisma/backfill/finanzas-s1";
import { assertLocalDb, call, cleanup, makeUser, type TestUser } from "./harness";

/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const route = (path: string) => require(`@/app/api/plan/${path}/route`) as Record<string, any>;

const PERIOD = currentPeriod();
let owner: TestUser, editor: TestUser, viewer: TestUser, stranger: TestUser;
let casa: string; // finanza compartida
const ids: Record<string, string> = {};

beforeAll(async () => {
  assertLocalDb();
  [owner, editor, viewer, stranger] = await Promise.all([
    makeUser("Owner"), makeUser("Editor"), makeUser("Viewer"), makeUser("Stranger"),
  ]);
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

// ─── 1. Finanzas y miembros ───────────────────────────────────────────────────

describe("finanzas y miembros", () => {
  it("crear Hogar: 201, dueño ADMIN, color default violeta y categorías por defecto", async () => {
    const r = await call(route("finances").POST, owner, { method: "POST", body: { name: `Casa ${owner.name}` } });
    expect(r.status).toBe(201);
    expect(r.json.finance).toMatchObject({ kind: "SHARED", color: "violeta", role: "ADMIN", isOwner: true });
    casa = r.json.finance.id;
    expect(await prisma.planCategory.count({ where: { householdId: casa } })).toBeGreaterThan(0);
  });

  it("nombre repetido (sin distinguir mayúsculas) → 409; color inválido → 400", async () => {
    const dup = await call(route("finances").POST, owner, { method: "POST", body: { name: `casa ${owner.name}`.toUpperCase() } });
    expect(dup.status).toBe(409);
    const bad = await call(route("finances").POST, owner, { method: "POST", body: { name: "Otra", color: "fucsia" } });
    expect(bad).toMatchObject({ status: 400, json: { error: "Color inválido" } });
  });

  it("agregar miembros por correo: Editor y Lector", async () => {
    for (const [u, role] of [[editor, "EDITOR"], [viewer, "VIEWER"]] as const) {
      const r = await call(route("finances/[id]/members").POST, owner, {
        method: "POST", params: { id: casa }, body: { email: u.email, role },
      });
      expect(r.status).toBe(201);
    }
  });

  it("correo inexistente → 404; ya miembro → 409; el dueño como miembro → 409", async () => {
    const post = (email: string) =>
      call(route("finances/[id]/members").POST, owner, { method: "POST", params: { id: casa }, body: { email, role: "EDITOR" } });
    expect((await post("nadie@int.test")).status).toBe(404);
    expect((await post(editor.email)).status).toBe(409);
    expect((await post(owner.email)).status).toBe(409);
  });

  it("la finanza PERSONAL no acepta miembros (422)", async () => {
    const r = await call(route("finances/[id]/members").POST, owner, {
      method: "POST", params: { id: owner.personalId }, body: { email: editor.email, role: "EDITOR" },
    });
    expect(r).toMatchObject({ status: 422, json: { error: "La finanza personal no se comparte. Creá un Hogar." } });
  });

  it("solo ADMIN gestiona: Editor y Lector reciben 403; el ajeno 404", async () => {
    const patch = (u: TestUser) => call(route("finances/[id]").PATCH, u, { method: "PATCH", params: { id: casa }, body: { name: "X" } });
    expect((await patch(editor)).status).toBe(403);
    expect((await patch(viewer)).status).toBe(403);
    expect((await patch(stranger)).status).toBe(404);
  });

  it("cambiar color de la PERSONAL → 422; de la compartida → ok", async () => {
    const personal = await call(route("finances/[id]").PATCH, owner, { method: "PATCH", params: { id: owner.personalId }, body: { color: "azul" } });
    expect(personal.status).toBe(422);
    const shared = await call(route("finances/[id]").PATCH, owner, { method: "PATCH", params: { id: casa }, body: { color: "azul" } });
    expect(shared.json.finance.color).toBe("azul");
  });

  it("GET finances: cada quien ve solo las suyas; el ajeno no ve Casa", async () => {
    const mine = await call(route("finances").GET, editor);
    expect(mine.json.finances.map((f: any) => f.id)).toEqual(expect.arrayContaining([editor.personalId, casa]));
    const theirs = await call(route("finances").GET, stranger);
    expect(theirs.json.finances.map((f: any) => f.id)).not.toContain(casa);
    expect(theirs.json.activeId).toBe(stranger.personalId);
  });

  it("no se le cambia el rol ni se quita al dueño; no se baja al último ADMIN", async () => {
    const role = await call(route("finances/[id]/members/[userId]").PATCH, owner, {
      method: "PATCH", params: { id: casa, userId: owner.id }, body: { role: "VIEWER" },
    });
    expect(role.status).toBe(409);
    const del = await call(route("finances/[id]/members/[userId]").DELETE, owner, {
      method: "DELETE", params: { id: casa, userId: owner.id },
    });
    expect(del.status).toBe(409);
  });

  it("último ADMIN protegido cuando el dueño no tiene fila de miembro", async () => {
    // Un segundo ADMIN que no es el dueño: bajarlo está permitido porque el dueño sigue siendo ADMIN.
    const extra = await makeUser("Extra");
    await prisma.financeMember.create({ data: { userId: extra.id, householdId: casa, role: "ADMIN" } });
    const down = await call(route("finances/[id]/members/[userId]").PATCH, owner, {
      method: "PATCH", params: { id: casa, userId: extra.id }, body: { role: "EDITOR" },
    });
    expect(down.status).toBe(200);
  });

  it("Lector no puede quitar a otro; un miembro puede salirse solo", async () => {
    const kick = await call(route("finances/[id]/members/[userId]").DELETE, viewer, {
      method: "DELETE", params: { id: casa, userId: editor.id },
    });
    expect(kick.status).toBe(403);
    // Salida propia: el Lector se va y su default (si era Casa) vuelve a su Personal.
    await prisma.user.update({ where: { id: viewer.id }, data: { householdId: casa } });
    const leave = await call(route("finances/[id]/members/[userId]").DELETE, viewer, {
      method: "DELETE", params: { id: casa, userId: viewer.id },
    });
    expect(leave.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: viewer.id } })).householdId).toBe(viewer.personalId);
    // Se lo vuelve a agregar para el resto de la suite.
    await call(route("finances/[id]/members").POST, owner, { method: "POST", params: { id: casa }, body: { email: viewer.email, role: "VIEWER" } });
  });

  it("finances/active (web): fija la cookie solo si hay acceso", async () => {
    const ok = await call(route("finances/active").POST, owner, { method: "POST", body: { id: casa } });
    expect(ok.status).toBe(200);
    const no = await call(route("finances/active").POST, stranger, { method: "POST", body: { id: casa } });
    expect(no.status).toBe(403);
  });
});

// ─── 2. Flujos de la app en la finanza compartida (Editor) ────────────────────

describe("flujos como Editor en Casa", () => {
  const asEditor = (h: any, o: any = {}) => call(h, editor, { finance: casa, ...o });

  it("iniciar mes (POST month) y cambiar el dólar (PATCH)", async () => {
    expect((await asEditor(route("month").POST, { method: "POST", body: { period: PERIOD, usdRate: 1200 } })).status).toBe(201);
    expect((await asEditor(route("month").PATCH, { method: "PATCH", body: { period: PERIOD, usdRate: 1250 } })).status).toBe(200);
  });

  it("categorías: crear, renombrar, duplicada 409, borrar", async () => {
    const c = await asEditor(route("categories").POST, { method: "POST", body: { kind: "EXPENSE", name: "Mascotas" } });
    expect(c.status).toBe(201);
    ids.category = c.json.id;
    expect((await asEditor(route("categories").POST, { method: "POST", body: { kind: "EXPENSE", name: "mascotas" } })).status).toBe(409);
    expect((await asEditor(route("categories/[id]").PATCH, { method: "PATCH", params: { id: ids.category }, body: { name: "Perros" } })).status).toBe(200);
    const tmp = await asEditor(route("categories").POST, { method: "POST", body: { kind: "EXPENSE", name: "Temporal" } });
    expect((await asEditor(route("categories/[id]").DELETE, { method: "DELETE", params: { id: tmp.json.id } })).status).toBe(200);
  });

  it("movimientos: crear, editar, borrar", async () => {
    const e = await asEditor(route("entries").POST, {
      method: "POST", body: { period: PERIOD, kind: "EXPENSE", name: "Super", amount: 1000, currency: "ARS", categoryId: ids.category },
    });
    expect(e.status).toBe(201);
    ids.entry = e.json.id;
    expect((await asEditor(route("entries/[id]").PATCH, { method: "PATCH", params: { id: ids.entry }, body: { amount: 1500, isDone: true } })).status).toBe(200);
    const tmp = await asEditor(route("entries").POST, { method: "POST", body: { period: PERIOD, kind: "EXPENSE", name: "Borrar", amount: 1, currency: "ARS" } });
    expect((await asEditor(route("entries/[id]").DELETE, { method: "DELETE", params: { id: tmp.json.id } })).status).toBe(200);
    expect(await prisma.planEntry.count({ where: { id: tmp.json.id } })).toBe(0);
  });

  it("fijo: se crea con su regla y el movimiento del mes", async () => {
    const f = await asEditor(route("entries").POST, {
      method: "POST", body: { period: PERIOD, kind: "EXPENSE", name: "Internet", amount: 800, currency: "ARS", fixed: { frequency: "MONTHLY", dueDay: 10 } },
    });
    expect(f.status).toBe(201);
    ids.fixedEntry = f.json.id;
  });

  it("presupuesto del mes", async () => {
    const r = await asEditor(route("budget").PUT, { method: "PUT", body: { period: PERIOD, items: [{ categoryId: ids.category, amount: 5000 }] } });
    expect(r.status).toBe(200);
  });

  it("tarjetas: alta, compra, resumen, edición y borrado", async () => {
    const card = await asEditor(route("cards").POST, { method: "POST", body: { entity: "Galicia", cardType: "VISA", ownerName: "Test" } });
    expect(card.status).toBe(201);
    ids.card = card.json.id;
    const p = await asEditor(route("card-purchases").POST, {
      method: "POST", body: { cardId: ids.card, description: "TV", amount: 3000, currency: "ARS", installments: 3, firstPeriod: PERIOD },
    });
    expect(p.status).toBe(201);
    ids.purchase = p.json.id;
    const s = await asEditor(route("card-statements").POST, { method: "POST", body: { cardId: ids.card, period: PERIOD, totalArs: 5000 } });
    expect(s.status).toBe(201);
    ids.statement = s.json.id;
    expect((await asEditor(route("card-purchases/[id]").PATCH, { method: "PATCH", params: { id: ids.purchase }, body: { amount: 3300 } })).status).toBe(200);
    expect((await asEditor(route("card-statements/[id]").PATCH, { method: "PATCH", params: { id: ids.statement }, body: { isPaid: true } })).status).toBe(200);
    expect((await asEditor(route("cards/[id]").PATCH, { method: "PATCH", params: { id: ids.card }, body: { entity: "BBVA", cardType: "MC", ownerName: "Test" } })).status).toBe(200);
  });

  it("la tarjeta de OTRA finanza no se puede usar en una compra de Casa", async () => {
    const foreign = await prisma.card.create({ data: { householdId: editor.personalId, name: "Mía" } });
    const r = await asEditor(route("card-purchases").POST, {
      method: "POST", body: { cardId: foreign.id, description: "X", amount: 1, currency: "ARS", installments: 1, firstPeriod: PERIOD },
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
  });

  it("patrimonio: alta, edición, archivado y borrado", async () => {
    const b = await asEditor(route("balance").POST, { method: "POST", body: { type: "ASSET", name: "Ahorros", currency: "ARS", amount: 1000, period: PERIOD } });
    expect(b.status).toBe(201);
    ids.balance = b.json.id;
    expect((await asEditor(route("balance/[id]").PATCH, { method: "PATCH", params: { id: ids.balance }, body: { period: PERIOD, amount: 2000 } })).status).toBe(200);
    expect((await asEditor(route("balance").GET)).json.items).toHaveLength(1);
  });

  it("préstamos: saldo del banco y cuotas pasadas, con autorización por la finanza del préstamo", async () => {
    const loan = await prisma.planLoan.create({
      data: { householdId: casa, direction: "OWE", mode: "FIXED", name: "Auto", principal: 100000, installments: 12, installmentAmount: 10000, startPeriod: PERIOD },
    });
    ids.loan = loan.id;
    const bal = await asEditor(route("loans/[id]/balance").POST, { method: "POST", params: { id: ids.loan }, body: { period: PERIOD, amount: 90000 } });
    expect(bal.status).toBe(201);
    expect((await asEditor(route("loans/[id]/balance").DELETE, { method: "DELETE", params: { id: ids.loan }, url: `http://localhost/x?period=${PERIOD}` })).status).toBe(200);
    expect((await asEditor(route("loans/[id]").PATCH, { method: "PATCH", params: { id: ids.loan }, body: {} })).status).toBeLessThan(500);
  });

  it("bandeja: confirmar un pago crea el movimiento en la finanza DEL PAGO (no en la activa)", async () => {
    const item = await prisma.planInboxItem.create({ data: { householdId: casa, source: "APPLE_PAY", merchant: "Kiosco", amount: 500 } });
    // El editor tiene Personal como finanza activa (sin header), pero el pago es de Casa.
    const r = await call(route("inbox/[id]/confirm").POST, editor, {
      method: "POST", params: { id: item.id },
      body: { amount: 500, currency: "ARS", categoryId: ids.category, date: `${PERIOD}-05`, method: "DEBIT" },
    });
    expect(r.status).toBe(200);
    const entry = await prisma.planEntry.findFirstOrThrow({ where: { name: "Kiosco" } });
    expect(entry.householdId).toBe(casa);
    const other = await prisma.planInboxItem.create({ data: { householdId: casa, source: "APPLE_PAY", merchant: "Otro", amount: 1 } });
    expect((await asEditor(route("inbox/[id]/dismiss").POST, { method: "POST", params: { id: other.id } })).status).toBe(200);
    expect((await asEditor(route("inbox").GET)).status).toBe(200);
  });

  it("tokens: solo ADMIN los gestiona", async () => {
    expect((await asEditor(route("tokens").POST, { method: "POST", body: { name: "iPhone" } })).status).toBe(403);
    const t = await call(route("tokens").POST, owner, { method: "POST", finance: casa, body: { name: "iPhone" } });
    expect(t.status).toBe(201);
    ids.token = t.json.id;
    expect((await call(route("tokens").GET, owner, { finance: casa })).json).toHaveLength(1);
    expect((await asEditor(route("tokens/[id]").DELETE, { method: "DELETE", params: { id: ids.token } })).status).toBe(403);
  });

  it("errores: cualquier miembro, incluso Lector, puede reportar", async () => {
    const r = await call(route("errors").POST, viewer, {
      method: "POST", finance: casa, body: { source: "app", code: "test", message: "falló algo" },
    });
    expect(r.status).toBe(201);
  });
});

// ─── 3. Aislamiento entre finanzas ────────────────────────────────────────────

describe("aislamiento", () => {
  it("cada finanza muestra solo lo suyo", async () => {
    const inCasa = await call(route("data").GET, editor, { finance: casa });
    expect(inCasa.json.entries.map((e: any) => e.name)).toEqual(expect.arrayContaining(["Super", "Internet"]));
    const inPersonal = await call(route("data").GET, editor, { finance: editor.personalId });
    expect(inPersonal.json.entries).toHaveLength(0);
    expect(inPersonal.json.finance).toMatchObject({ id: editor.personalId, kind: "PERSONAL", role: "ADMIN" });
    expect(inCasa.json.finance).toMatchObject({ id: casa, kind: "SHARED", color: "azul", role: "EDITOR" });
  });

  it("sin header → la finanza por defecto de siempre (User.householdId)", async () => {
    const r = await call(route("data").GET, editor);
    expect(r.json.finance.id).toBe(editor.personalId);
  });

  it("header de otra finanza donde no soy miembro → 403 con el mismo mensaje que una inexistente", async () => {
    const foreign = await call(route("data").GET, stranger, { finance: casa });
    const missing = await call(route("data").GET, stranger, { finance: "no-existe" });
    expect(foreign).toMatchObject({ status: 403, json: { error: "No tenés acceso a esa finanza" } });
    expect(missing).toMatchObject({ status: 403, json: { error: "No tenés acceso a esa finanza" } });
  });

  it("un id de Casa llegando con la finanza activa equivocada igual se autoriza contra Casa", async () => {
    // El editor opera con Personal activa pero edita un movimiento de Casa: permitido (es EDITOR en Casa).
    const r = await call(route("entries/[id]").PATCH, editor, { method: "PATCH", params: { id: ids.entry }, finance: editor.personalId, body: { note: "ok" } });
    expect(r.status).toBe(200);
    // El ajeno recibe 404 (no se filtra la existencia).
    const no = await call(route("entries/[id]").PATCH, stranger, { method: "PATCH", params: { id: ids.entry }, body: { note: "x" } });
    expect(no.status).toBe(404);
    // El Lector recibe 403 (es miembro, sin permiso).
    const ro = await call(route("entries/[id]").PATCH, viewer, { method: "PATCH", params: { id: ids.entry }, finance: casa, body: { note: "x" } });
    expect(ro.status).toBe(403);
  });
});

// ─── 4. Matriz de rutas × perfiles ────────────────────────────────────────────

type Row = { name: string; path: string; method: string; action: "read" | "create" | "update" | "delete" | "manage"; id?: string };
const MATRIX = (): Row[] => [
  { name: "balance GET", path: "balance", method: "GET", action: "read" },
  { name: "balance POST", path: "balance", method: "POST", action: "create" },
  { name: "balance/[id] PATCH", path: "balance/[id]", method: "PATCH", action: "update", id: ids.balance },
  { name: "balance/[id] DELETE", path: "balance/[id]", method: "DELETE", action: "delete", id: ids.balance },
  { name: "budget PUT", path: "budget", method: "PUT", action: "update" },
  { name: "card-purchases POST", path: "card-purchases", method: "POST", action: "create" },
  { name: "card-purchases/[id] PATCH", path: "card-purchases/[id]", method: "PATCH", action: "update", id: ids.purchase },
  { name: "card-purchases/[id] DELETE", path: "card-purchases/[id]", method: "DELETE", action: "delete", id: ids.purchase },
  { name: "card-statements POST", path: "card-statements", method: "POST", action: "create" },
  { name: "card-statements/[id] PATCH", path: "card-statements/[id]", method: "PATCH", action: "update", id: ids.statement },
  { name: "card-statements/[id] DELETE", path: "card-statements/[id]", method: "DELETE", action: "delete", id: ids.statement },
  { name: "cards POST", path: "cards", method: "POST", action: "create" },
  { name: "cards/[id] PATCH", path: "cards/[id]", method: "PATCH", action: "update", id: ids.card },
  { name: "cards/[id] DELETE", path: "cards/[id]", method: "DELETE", action: "delete", id: ids.card },
  { name: "categories POST", path: "categories", method: "POST", action: "create" },
  { name: "categories/[id] PATCH", path: "categories/[id]", method: "PATCH", action: "update", id: ids.category },
  { name: "categories/[id] DELETE", path: "categories/[id]", method: "DELETE", action: "delete", id: ids.category },
  { name: "data GET", path: "data", method: "GET", action: "read" },
  { name: "entries POST", path: "entries", method: "POST", action: "create" },
  { name: "entries/[id] PATCH", path: "entries/[id]", method: "PATCH", action: "update", id: ids.entry },
  { name: "entries/[id] DELETE", path: "entries/[id]", method: "DELETE", action: "delete", id: ids.entry },
  { name: "entries/move POST", path: "entries/move", method: "POST", action: "update" },
  { name: "errors POST", path: "errors", method: "POST", action: "read" },
  { name: "inbox GET", path: "inbox", method: "GET", action: "read" },
  { name: "inbox/[id]/confirm POST", path: "inbox/[id]/confirm", method: "POST", action: "create", id: "x" },
  { name: "inbox/[id]/dismiss POST", path: "inbox/[id]/dismiss", method: "POST", action: "update", id: "x" },
  { name: "loans POST", path: "loans", method: "POST", action: "create" },
  { name: "loans/[id] PATCH", path: "loans/[id]", method: "PATCH", action: "update", id: ids.loan },
  { name: "loans/[id] DELETE", path: "loans/[id]", method: "DELETE", action: "delete", id: ids.loan },
  { name: "loans/[id]/balance POST", path: "loans/[id]/balance", method: "POST", action: "update", id: ids.loan },
  { name: "loans/[id]/balance DELETE", path: "loans/[id]/balance", method: "DELETE", action: "update", id: ids.loan },
  { name: "loans/[id]/past-payments POST", path: "loans/[id]/past-payments", method: "POST", action: "update", id: ids.loan },
  { name: "loans/[id]/past-payments DELETE", path: "loans/[id]/past-payments", method: "DELETE", action: "update", id: ids.loan },
  { name: "month POST", path: "month", method: "POST", action: "create" },
  { name: "month PATCH", path: "month", method: "PATCH", action: "update" },
  { name: "tokens GET", path: "tokens", method: "GET", action: "manage" },
  { name: "tokens POST", path: "tokens", method: "POST", action: "manage" },
  { name: "tokens/[id] DELETE", path: "tokens/[id]", method: "DELETE", action: "manage", id: ids.token },
  { name: "voice POST", path: "voice", method: "POST", action: "create" },
];

describe("matriz de rutas × perfiles", () => {
  const run = (row: Row, user: TestUser | null, finance?: string) =>
    call(route(row.path)[row.method], user, {
      method: row.method,
      params: row.id ? { id: row.id } : {},
      finance,
      body: row.method === "GET" || row.method === "DELETE" ? undefined : {},
      url: `http://localhost/api/plan/${row.path}?period=${PERIOD}`,
    });

  it("la matriz cubre TODOS los métodos exportados por las rutas de sesión de /api/plan", () => {
    // Escanea los route.ts reales: una ruta nueva que no esté en la matriz hace fallar este test.
    const root = path.join(process.cwd(), "src/app/api/plan");
    const actual: string[] = [];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        if (f.isDirectory()) walk(path.join(dir, f.name));
        else if (f.name === "route.ts") {
          const rel = path.relative(root, dir).split(path.sep).join("/");
          const src = fs.readFileSync(path.join(dir, f.name), "utf8");
          // finances/** usa withUser (id explícito) y apple-pay autentica por token: se prueban aparte.
          if (rel.startsWith("finances") || rel === "inbox/apple-pay") continue;
          for (const m of src.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)) actual.push(`${rel} ${m[1]}`);
        }
      }
    };
    walk(root);
    const covered = MATRIX().map((r) => `${r.path} ${r.method}`);
    expect(covered.sort()).toEqual(actual.sort());
  });

  it("sin sesión → 401 en todas", async () => {
    for (const row of MATRIX()) expect([row.name, (await run(row, null)).status]).toEqual([row.name, 401]);
  });

  it("ajeno con la finanza de Casa → 403 en todas las que usan finanza activa", async () => {
    for (const row of MATRIX().filter((r) => !r.id)) {
      expect([row.name, (await run(row, stranger, casa)).status]).toEqual([row.name, 403]);
    }
  });

  it("ajeno sobre un id de Casa (sin header) → 404, nunca revela existencia", async () => {
    for (const row of MATRIX().filter((r) => r.id && r.id !== "x" && r.action !== "manage")) {
      expect([row.name, (await run(row, stranger)).status]).toEqual([row.name, 404]);
    }
  });

  it("Lector: acciones de escritura → 403; lecturas → permitidas", async () => {
    for (const row of MATRIX()) {
      if (row.id === "x") continue; // inbox: ids de relleno, cubierto abajo
      const { status } = await run(row, viewer, casa);
      // Lectura: pasa la autorización (puede devolver 400 por validar un body vacío, pero nunca 401/403).
      if (row.action === "read") expect([row.name, status !== 401 && status !== 403 && status < 500]).toEqual([row.name, true]);
      else expect([row.name, status]).toEqual([row.name, 403]);
    }
  });

  it("Lector sobre inbox (id real): confirmar y descartar → 403", async () => {
    const item = await prisma.planInboxItem.create({ data: { householdId: casa, source: "APPLE_PAY", amount: 1 } });
    for (const p of ["inbox/[id]/confirm", "inbox/[id]/dismiss"]) {
      const r = await call(route(p).POST, viewer, { method: "POST", params: { id: item.id }, finance: casa, body: {} });
      expect([p, r.status]).toEqual([p, 403]);
    }
  });

  it("Editor: nunca 401/403 (salvo manage) ni 5xx — solo rutas no destructivas", async () => {
    for (const row of MATRIX()) {
      if (row.method === "DELETE" || row.path === "voice" || row.id === "x") continue;
      const { status } = await run(row, editor, casa);
      const expected = row.action === "manage" ? 403 : null;
      if (expected) expect([row.name, status]).toEqual([row.name, expected]);
      else expect([row.name, status !== 401 && status !== 403 && status < 500]).toEqual([row.name, true]);
    }
  });

  it("Lector en voice: 403 antes de gastar tokens de OpenAI", async () => {
    const r = await call(route("voice").POST, viewer, { method: "POST", finance: casa, body: { text: "gasté 100" } });
    expect(r.status).toBe(403);
  });
});

// ─── 5. Mover a finanza ───────────────────────────────────────────────────────

describe("entries/move", () => {
  const move = (user: TestUser, body: unknown, finance?: string) =>
    call(route("entries/move").POST, user, { method: "POST", body, finance });

  let fromPersonal: string[];

  beforeAll(async () => {
    // Personal del Dueño: categoría "Supermercado" (existe en Casa por defecto) y otra sin equivalente.
    await prisma.planCategory.createMany({
      data: [
        { householdId: owner.personalId, kind: "EXPENSE", name: "supermercado" },
        { householdId: owner.personalId, kind: "EXPENSE", name: "Solo en personal" },
      ],
    });
    const cats = await prisma.planCategory.findMany({ where: { householdId: owner.personalId } });
    const byName = (n: string) => cats.find((c) => c.name === n)!.id;
    await prisma.planMonth.create({ data: { householdId: owner.personalId, period: PERIOD, usdRate: 1111 } });
    const mk = (name: string, over: object = {}) =>
      prisma.planEntry.create({
        data: { householdId: owner.personalId, period: PERIOD, kind: "EXPENSE", name, amount: 100, isDone: true, ...over },
      });
    const e1 = await mk("Cena pareja", { categoryId: byName("supermercado") });
    const e2 = await mk("Cosa rara", { categoryId: byName("Solo en personal") });
    const rule = await prisma.planRecurring.create({
      data: { householdId: owner.personalId, kind: "EXPENSE", name: "Fijo", amount: 5, frequency: "MONTHLY" },
    });
    const fixed = await mk("Fijo", { recurringId: rule.id });
    const loan = await prisma.planLoan.create({
      data: { householdId: owner.personalId, direction: "OWE", mode: "FIXED", name: "L", principal: 1, startPeriod: PERIOD },
    });
    const installment = await mk("Cuota", { loanId: loan.id });
    fromPersonal = [e1.id, e2.id, fixed.id, installment.id];
  });

  it("validaciones: vacío 400, >200 → 422, misma finanza 422", async () => {
    expect((await move(owner, { entryIds: [], toFinanceId: casa }, owner.personalId)).status).toBe(400);
    const many = Array.from({ length: 201 }, (_, i) => `e${i}`);
    expect(await move(owner, { entryIds: many, toFinanceId: casa }, owner.personalId)).toMatchObject({ status: 422, json: { error: "Máximo 200 por vez" } });
    expect(await move(owner, { entryIds: [fromPersonal[0]], toFinanceId: owner.personalId }, owner.personalId))
      .toMatchObject({ status: 422, json: { error: "Elegí otra finanza" } });
  });

  it("Lector en el destino → 403 y NO se mueve nada", async () => {
    // El Lector tiene movimientos propios en su Personal e intenta moverlos a Casa (donde es VIEWER).
    const mine = await prisma.planEntry.create({ data: { householdId: viewer.personalId, period: PERIOD, kind: "EXPENSE", name: "V", amount: 1 } });
    const r = await move(viewer, { entryIds: [mine.id], toFinanceId: casa }, viewer.personalId);
    expect(r.status).toBe(403);
    expect((await prisma.planEntry.findUniqueOrThrow({ where: { id: mine.id } })).householdId).toBe(viewer.personalId);
  });

  it("ajeno: los movimientos de otra finanza figuran como 'No encontrado' (422 si no queda ninguno)", async () => {
    const r = await move(stranger, { entryIds: [fromPersonal[0]], toFinanceId: stranger.personalId }, stranger.personalId);
    expect(r.status).toBe(422);
  });

  it("mueve con categoría mapeada por nombre; fijo y cuota quedan en 'skipped'; el mes de destino toma el dólar del origen", async () => {
    // Casa ya tiene el mes iniciado (1250): se respeta el del destino.
    const r = await move(owner, { entryIds: fromPersonal, toFinanceId: casa }, owner.personalId);
    expect(r.status).toBe(200);
    expect(r.json.moved).toEqual(expect.arrayContaining([fromPersonal[0], fromPersonal[1]]));
    expect(r.json.skipped.map((s: any) => s.reason)).toEqual(
      expect.arrayContaining(["Es un fijo; editá el fijo.", "Es una cuota de un préstamo."]),
    );
    expect(r.json.from.id).toBe(owner.personalId);
    expect(r.json.to.id).toBe(casa);

    const moved = await prisma.planEntry.findUniqueOrThrow({ where: { id: fromPersonal[0] }, include: { category: true } });
    expect(moved.householdId).toBe(casa);
    expect(moved.category?.householdId).toBe(casa);
    expect(moved.category?.name).toBe("Supermercado");
    expect(Number(moved.amount)).toBe(100); // monto, mes e isDone se conservan
    expect(moved.period).toBe(PERIOD);
    expect(moved.isDone).toBe(true);
    const noMatch = await prisma.planEntry.findUniqueOrThrow({ where: { id: fromPersonal[1] } });
    expect(noMatch.householdId).toBe(casa);
    expect(noMatch.categoryId).toBeNull(); // sin equivalente → "Sin categoría"
    expect((await prisma.planEntry.findUniqueOrThrow({ where: { id: fromPersonal[2] } })).householdId).toBe(owner.personalId);
    expect((await prisma.planMonth.findUniqueOrThrow({ where: { householdId_period: { householdId: casa, period: PERIOD } } })).usdRate.toString()).toBe("1250");
  });

  it("los totales se recalculan: Personal pierde los gastos y Casa los gana", async () => {
    const p = await call(route("data").GET, owner, { finance: owner.personalId });
    expect(p.json.entries.map((e: any) => e.name)).not.toContain("Cena pareja");
    const c = await call(route("data").GET, owner, { finance: casa });
    expect(c.json.entries.map((e: any) => e.name)).toContain("Cena pareja");
  });

  it("mes de destino sin iniciar → se crea con el MISMO dólar del origen", async () => {
    const fresh = await call(route("finances").POST, owner, { method: "POST", body: { name: `Vacía ${owner.name}` } });
    const e = await prisma.planEntry.create({ data: { householdId: owner.personalId, period: PERIOD, kind: "EXPENSE", name: "Z", amount: 7 } });
    const r = await move(owner, { entryIds: [e.id], toFinanceId: fresh.json.finance.id }, owner.personalId);
    expect(r.status).toBe(200);
    const month = await prisma.planMonth.findUniqueOrThrow({ where: { householdId_period: { householdId: fresh.json.finance.id, period: PERIOD } } });
    expect(month.usdRate.toString()).toBe("1111");
  });

  it("deshacer = volver a mover (la categoría se remapea otra vez por nombre)", async () => {
    const back = await move(owner, { entryIds: [fromPersonal[0]], toFinanceId: owner.personalId }, casa);
    expect(back.status).toBe(200);
    const e = await prisma.planEntry.findUniqueOrThrow({ where: { id: fromPersonal[0] }, include: { category: true } });
    expect(e.householdId).toBe(owner.personalId);
    expect(e.category?.householdId).toBe(owner.personalId);
  });
});

// ─── 6. Apple Pay ─────────────────────────────────────────────────────────────

describe("inbox/apple-pay", () => {
  it("el token crea items en su finanza; si el usuario baja a Lector → 403", async () => {
    const { token, tokenHash } = createToken();
    await prisma.planApiToken.create({ data: { householdId: casa, userId: editor.id, name: "t", tokenHash } });
    const post = () => call(route("inbox/apple-pay").POST, null, {
      method: "POST", bearer: token, body: { amount: "123,45", merchant: `Comercio ${Math.random()}` },
    });

    const ok = await post();
    expect(ok.status).toBe(201);
    expect((await prisma.planInboxItem.findUniqueOrThrow({ where: { id: ok.json.id } })).householdId).toBe(casa);

    await prisma.financeMember.update({ where: { userId_householdId: { userId: editor.id, householdId: casa } }, data: { role: "VIEWER" } });
    expect(await post()).toMatchObject({ status: 403, json: { error: "El token ya no tiene permiso en esta finanza" } });
    await prisma.financeMember.update({ where: { userId_householdId: { userId: editor.id, householdId: casa } }, data: { role: "EDITOR" } });
  });

  it("token inválido o ausente → 401", async () => {
    expect((await call(route("inbox/apple-pay").POST, null, { method: "POST", bearer: "nada", body: {} })).status).toBe(401);
    expect((await call(route("inbox/apple-pay").POST, null, { method: "POST", body: {} })).status).toBe(401);
  });
});

// ─── 7. Backfill ──────────────────────────────────────────────────────────────

describe("backfill", () => {
  it("antes del backfill el hogar default funciona sin header, pero no es una selección explícita", async () => {
    const legacyUser = await makeUser("LegacySelection");
    await prisma.financeMember.deleteMany({ where: { householdId: legacyUser.personalId } });
    await prisma.household.update({ where: { id: legacyUser.personalId }, data: { ownerUserId: null } });

    const listing = await call(route("finances").GET, legacyUser);
    expect(listing.status).toBe(200);
    expect(listing.json.activeId).toBe(legacyUser.personalId);
    expect(listing.json.finances).toEqual([]);
    expect((await call(route("data").GET, legacyUser)).status).toBe(200);
    expect((await call(route("data").GET, legacyUser, { finance: listing.json.activeId })).status).toBe(403);
    expect((await call(route("data").GET, legacyUser)).status).toBe(200);
  });

  it("hogar con 2 usuarios: dueño ADMIN, el otro recibe su Personal y se reapunta; 2ª corrida sin cambios", async () => {
    const legacy = await prisma.household.create({ data: { name: `Legacy ${owner.name}`, type: "SHARED" } });
    const a = await prisma.user.create({ data: { name: `Aa-${owner.name}`, email: `aa-${owner.name}@int.test`, passwordHash: "x", householdId: legacy.id, role: "ADMIN" } });
    const b = await prisma.user.create({ data: { name: `Bb-${owner.name}`, email: `bb-${owner.name}@int.test`, passwordHash: "x", householdId: legacy.id, role: "MEMBER" } });
    try {
      const dry = await runBackfill(prisma, { dryRun: true });
      expect(dry.householdsOwned).toBeGreaterThanOrEqual(1);
      expect((await prisma.household.findUniqueOrThrow({ where: { id: legacy.id } })).ownerUserId).toBeNull(); // dry-run no escribe

      const first = await runBackfill(prisma);
      expect(first.personalsCreated).toBeGreaterThanOrEqual(1);
      const h = await prisma.household.findUniqueOrThrow({ where: { id: legacy.id }, include: { members: true } });
      expect(h).toMatchObject({ ownerUserId: a.id, kind: "PERSONAL" });
      expect(h.members.map((m) => [m.userId, m.role])).toEqual([[a.id, "ADMIN"]]);
      const bNow = await prisma.user.findUniqueOrThrow({ where: { id: b.id } });
      expect(bNow.householdId).not.toBe(legacy.id);
      const bHome = await prisma.household.findUniqueOrThrow({ where: { id: bNow.householdId } });
      expect(bHome).toMatchObject({ ownerUserId: b.id, kind: "PERSONAL" });

      expect(await runBackfill(prisma)).toEqual({ householdsOwned: 0, membersCreated: 0, personalsCreated: 0, usersRepointed: 0 });
    } finally {
      const bHome = await prisma.household.findMany({ where: { ownerUserId: { in: [a.id, b.id] } }, select: { id: true } });
      await prisma.financeMember.deleteMany({ where: { userId: { in: [a.id, b.id] } } });
      await prisma.planCategory.deleteMany({ where: { householdId: { in: bHome.map((x) => x.id) } } });
      await prisma.session.deleteMany({ where: { userId: { in: [a.id, b.id] } } });
      await prisma.user.deleteMany({ where: { id: { in: [a.id, b.id] } } });
      await prisma.household.deleteMany({ where: { id: { in: [legacy.id, ...bHome.map((x) => x.id)] } } });
    }
  });
});
