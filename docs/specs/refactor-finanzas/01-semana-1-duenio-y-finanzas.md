# Semana 1 — Dueño y finanzas

Rama: `feat/finanzas-s1-duenio-finanzas` (PR hacia `develop`). Contrato: `docs/specs/refactor-finanzas/00-contrato.md`. Diseño: artifact "Omero: Refactor a Finanzas" (secciones "Quién ve qué", "Identidad por finanza", "Plan por semanas").

Estado real del código sobre el que se construye (verificado):

- `Household` ya existe con `id`, `name`, `type HouseholdType (PERSONAL|SHARED|ORGANIZATION|MULTIPLE)`, `createdAt` (`prisma/schema.prisma:15`). No tiene dueño, color ni miembros.
- `User.householdId` es obligatorio: un usuario pertenece a **un solo** hogar. La sesión (`src/lib/auth.ts`, `findSession`) devuelve `user.householdId` y `householdType`.
- Las 27 rutas de `src/app/api/plan/**/route.ts` pasan por `withSession` (`src/lib/plan/server.ts:333`), que entrega `ctx = { householdId, userId }` tomando `session.user.householdId`. Cada ruta filtra a mano por `householdId` (`findFirst({ where: { id, householdId } })`).
- `inbox/apple-pay` NO usa sesión: autentica por `PlanApiToken` (hash) y toma `token.householdId`.
- Las rutas existentes actualizan con `PATCH`/`PUT` (no `POST /:id`). Esta semana NO se renombran ni se deprecan (R4); los endpoints nuevos usan los verbos estándar `POST` (crear), `PATCH` (actualizar) y `DELETE`.
- Mobile: `mobile/lib/api.ts` (fetch con `Authorization: Bearer`), `mobile/lib/session.tsx` (`SessionProvider`, guarda `omero_user`), `mobile/src/providers/AppProviders.tsx` (QueryClient > Session > Theme > Mascot > Privacy), tema en `mobile/src/design-system/tokens/themes.ts` + `theme/ThemeProvider.tsx`, mascota en `mobile/src/mascots/omero/`, movimientos en `mobile/src/features/movements/`.
- Web: `src/app/plan/layout.tsx` + `src/components/plan/plan-nav.tsx`; las páginas de servidor llaman `loadPlan(session.user.householdId, …)`.

---

## 1. Objetivo y "Listo cuando"

**Objetivo.** Que cada finanza tenga dueño, tipo, color y miembros con rol; que exista una única regla de acceso (`canAccess`) usada por todos los endpoints de `/api/plan`; que el usuario pueda cambiar de finanza desde Omero, ver cada finanza con su color, crear un Hogar compartido, y mover movimientos de una finanza a otra.

**Listo cuando** (observable, en iPhone con datos reales):

1. Avelino abre la app y ve su finanza **Personal** con el color de Omero (verde). Tocando a Omero (arriba a la izquierda) ve la lista "Personal · Hogar (si existe)" y cambia.
2. Avelino crea el **Hogar** (nombre + color violeta de la paleta) y agrega a Maria por correo como **Editor**. Maria entra, toca a Omero y ve "Personal" y "Hogar"; en el Hogar la barra y el borde de la pantalla son violetas.
3. Avelino selecciona varios gastos en pareja en Movimientos de su Personal, toca "Mover a finanza", elige "Hogar" y esos gastos desaparecen de Personal y aparecen en el Hogar con su categoría (mapeada por nombre). Los totales del mes de ambas finanzas se recalculan.
4. Cada finanza muestra **solo lo suyo**: lo cargado en Hogar no aparece en Personal y viceversa (verificado con `GET /api/plan/data`).
5. Un usuario sin membresía que manda `x-finance-id` de otra finanza recibe 403; un Lector no puede crear/editar/borrar (403); ningún endpoint de `src/app/api/plan` filtra el acceso a mano (todos declaran su acción a `withSession`).
6. Los datos actuales siguen intactos: tras el backfill, el hogar existente es la finanza PERSONAL de su dueño y todo `GET /api/plan/data` sin header devuelve lo mismo que antes.

## 2. Alcance / Fuera de alcance

**Alcance**

- Prisma: `Household.kind`, `Household.ownerUserId`, `Household.color`, modelo `FinanceMember`, enums `FinanceKind` y `FinanceRole`. Migración aditiva + backfill idempotente.
- `src/lib/plan/access.ts`: `canAccess`, `resolveFinance`, `ROLE_ACTIONS`, errores. `withSession` migrado a finanza activa (`x-finance-id`) con acción obligatoria.
- Migración **exhaustiva** de los 27 archivos `route.ts` de `src/app/api/plan` (sección 4.5).
- Endpoints nuevos: `finances` (listar/crear/editar), `finances/[id]/members` (agregar existente por correo, cambiar rol, quitar), `entries/move`.
- Paleta de colores de finanza (`src/lib/plan/finances.ts`).
- Mobile: `ActiveFinanceProvider`, header `x-finance-id`, Omero como selector (sheet), tema/borde por finanza, pantalla "Crear Hogar", "Mover a finanza" en Movimientos.
- Web (mínimo): cookie `omero_finance`, selector en el encabezado de `/plan` y borde de color, para que la web no se rompa ni muestre la finanza equivocada. El layout de escritorio completo es del spec Web.

**Fuera de alcance** (no tocar)

- Cuentas (`PlanAccount`, `accountId`) y tarjetas del usuario (`Card.ownerUserId`, `CardFinance`) → S2. En S1 `Card` sigue colgando de `householdId`; **mover compras de tarjeta entre finanzas no se hace en S1**.
- `EntryLink`, `FinanceCoverage`, `refCode`, vista "Otra finanza · monto · MOV-XXXX" → S3 (es la vista para NO miembros; en S1 un no miembro simplemente no ve nada).
- `Contact`, `Invite`, invitar por teléfono/correo no registrado, toggle Patrimonio → S4. En S1 solo se agrega como miembro a un usuario **ya registrado** por correo.
- Grupos → S5-6. Sign-up UI, envío de mails/SMS.
- Renombrar `Household`, renombrar métodos HTTP existentes, tocar `buildSummary` (no cambia esta semana).
- Eliminar/archivar una finanza (queda en Riesgos).

---

## 3. Spec funcional

### 3.1 Historias de usuario

1. Como usuario quiero que mi información actual sea mi finanza **Personal**, para no perder nada.
2. Como usuario quiero tocar a Omero y cambiar de finanza, para ver/cargar en la correcta.
3. Como usuario quiero que cada finanza tenga su color en barra y borde, para no cargar en la equivocada.
4. Como Administrador quiero crear un **Hogar** y agregar a mi pareja con un rol, para administrar juntos.
5. Como Editor quiero cargar/editar/borrar movimientos en las finanzas donde soy miembro; como Lector, solo verlos.
6. Como usuario quiero **mover** gastos de mi Personal al Hogar (uno o varios), para pasar los gastos en pareja.
7. Como Administrador quiero cambiar el rol, nombre y color del Hogar, y quitar miembros.

### 3.2 Reglas de negocio

**Tipos y dueño**

- `kind = PERSONAL`: una por usuario (la del backfill / la que se crea al darlo de alta). Color siempre el de Omero; el campo `color` queda `null` y la UI usa el color de tema. Nombre mostrado: "Personal".
- `kind = SHARED`: las que se crean con "Crear Hogar". `color` obligatorio, una **clave de paleta** (`violeta`, `azul`, `naranja`, `rosa`, `turquesa`, `rojo`); default `violeta`.
- `Household.type` (legacy) se conserva como **subtipo descriptivo** (R1): una PERSONAL siempre tiene `type = PERSONAL`; una SHARED puede ser `SHARED` (default), `ORGANIZATION` o `MULTIPLE` (negocio, etc.). El comportamiento depende de `kind`, nunca de `type`; más adelante cada subtipo podrá tener reglas propias.
- `ownerUserId`: quien creó la finanza. El dueño es siempre ADMIN (aunque se le borre la fila de `FinanceMember`, `canAccess` lo trata como ADMIN). No se puede quitar al dueño ni cambiarle el rol.
- La finanza PERSONAL no se comparte (R2): su único miembro es su dueño. Agregar miembros a una PERSONAL → 422 "La finanza personal no se comparte. Creá un Hogar.". Lo que dos personas comparten se hace con finanzas SHARED y, desde S2, con cuentas compartidas.

**Roles** (`FinanceRole`) y acciones (`Action`)

| Acción | VIEWER | EDITOR | ADMIN |
|---|---|---|---|
| `read` (ver datos, mes, movimientos, patrimonio) | sí | sí | sí |
| `create` / `update` / `delete` (movimientos, categorías, presupuesto, fijos, préstamos, tarjetas del hogar, patrimonio, mes) | no | sí | sí |
| `manage` (nombre/color, miembros y roles, tokens de Apple Pay) | no | no | sí |

**Regla única de acceso** (`canAccess(userId, resource, action)`): se puede si el usuario es el `ownerUserId` de la finanza del recurso, o tiene fila en `FinanceMember` de esa finanza con un rol que permita la acción. Nada más. No hay "acceso por pertenecer al `User.householdId`" (eso queda solo como finanza activa por defecto).

**Finanza activa**

- El cliente manda `x-finance-id: <householdId>` en cada request. El servidor **nunca confía** en el header: lo valida con `canAccess(..., "read")`; si falla → 403 `{ error: "No tenés acceso a esa finanza" }`.
- Sin header (clientes viejos, web sin cookie, tokens) → se usa `User.householdId` (compatibilidad total con lo de hoy).
- Web (server components): cookie `omero_finance` con el mismo valor; el header gana sobre la cookie.
- Las listas/lecturas se acotan a la finanza activa (eso es *selección*, no autorización). Los recursos por `id` se cargan sin filtro de finanza y se autorizan contra **su propia** finanza (`assertAccess(row, action)`): un id de otra finanza donde no soy miembro responde 404 (no se filtra su existencia); si soy miembro pero sin permiso, 403.

**Crear Hogar**

- Nombre obligatorio (máx. 60), único (sin distinguir mayúsculas) entre las finanzas del usuario → 409 "Ya tenés una finanza con ese nombre".
- Crea `Household(kind SHARED, ownerUserId = yo, color)`, fila `FinanceMember(ADMIN)` para el dueño y las categorías por defecto (`ensurePlanDefaults`).
- Quedan vacías: sin mes iniciado, sin presupuesto. El mes se inicia como siempre con `POST /api/plan/month`.

**Miembros**

- Agregar: por correo de un usuario **existente**; si no existe → 404 "No hay un usuario con ese correo. Las invitaciones llegan pronto." (S4 lo reemplaza por `Invite`). Si ya es miembro → 409.
- No se puede dejar la finanza sin ADMIN: quitar o bajar de rol al último ADMIN → 409 "Tiene que quedar al menos un administrador".
- Un miembro puede salirse solo (DELETE de su propia fila) salvo que sea el dueño o el último ADMIN.
- Al quitar a alguien cuyo `User.householdId` es esa finanza, se reapunta su `User.householdId` a su finanza PERSONAL (si no tiene, se crea), para que su default siga siendo suyo.

**Mover a finanza** (`POST /api/plan/entries/move`)

- Origen = finanza de los movimientos (todos de la misma finanza); destino = otra finanza distinta. El usuario necesita `update` en el origen y `create` en el destino (EDITOR+ en ambas).
- Se mueve el `PlanEntry` completo: `householdId` cambia; `period`, `amount`, `currency`, `name`, `date`, `note`, `isDone` se conservan. El tipo de cambio queda inmutable: si el mes del destino no está iniciado, se **inicia con el mismo `usdRate` del mes de origen**; si ya está iniciado se respeta el del destino (el movimiento no guarda tipo de cambio propio, lo toma del mes).
- `categoryId` y `targetCategoryId` se remapean al destino **por nombre** (sin distinguir mayúsculas, mismo `kind`); si no hay equivalente queda `null` ("Sin categoría").
- No se mueven (se devuelven en `skipped` con motivo): movimientos con `recurringId` (fijos: "Es un fijo; editá el fijo."), con `loanId` (cuotas: "Es una cuota de un préstamo.") y los inexistentes/sin permiso ("No encontrado").
- Todo-o-nada sobre los movimientos válidos en una transacción; si no queda ninguno válido → 422.
- No hay "deshacer": se revierte volviendo a mover (la categoría se remapea por nombre otra vez).

### 3.3 Casos borde

- `x-finance-id` inexistente o de otro usuario → 403 (mismo mensaje en ambos casos, no revela existencia).
- Finanza activa guardada en el dispositivo que ya no es accesible (le sacaron el acceso) → la app recibe 403, vuelve a Personal, muestra toast "Ya no tenés acceso a {nombre}. Volviste a Personal".
- Usuario sin finanza PERSONAL propia (usuarios creados antes del backfill y no corridos): `resolveFinance` crea una PERSONAL al vuelo (idempotente) — red de seguridad, no camino normal.
- Mover entre dos finanzas donde el usuario es VIEWER en el destino → 403 para todo el lote, nada se mueve.
- Mover a la misma finanza → 422 "Elegí otra finanza".
- Mover > 200 movimientos → 422 "Máximo 200 por vez".
- Categoría del destino faltante tras `ensurePlanDefaults` (renombradas por el usuario) → `null`.
- Dos requests concurrentes moviendo el mismo movimiento: la transacción filtra por `householdId = origen`; el segundo no encuentra filas y lo reporta en `skipped`.
- Maria y Avelino cambian el nombre del Hogar a la vez: gana el último (sin versionado).
- Token Apple Pay de un usuario que dejó de ser EDITOR+ de la finanza del token → 403 (ver 4.5).

### 3.4 Textos de UI clave (es-AR)

| Lugar | Texto |
|---|---|
| Header (Omero) | "Personal" / "{Hogar}" + "cambiar ▾"; subtítulo = nombre del usuario o "Avelino y Maria" |
| Sheet selector | título "¿En qué finanza estás?"; ítems con punto de color, nombre y rol ("Administrador" / "Editor" / "Lector"); pie "Crear un Hogar" |
| Crear Hogar | título "Nuevo Hogar"; campos "Nombre" (placeholder "Ej: Casa"), "Color"; botón "Crear Hogar"; error 409 "Ya tenés una finanza con ese nombre" |
| Miembros | "Agregar por correo" / "Correo de la persona" / roles "Administrador", "Editor", "Lector" / vacío "Todavía sos el único miembro." |
| Mover | acción "Mover a finanza"; sheet "Mover {n} movimientos a…"; confirmación "Se mueven con su categoría (si existe igual en {destino}). Los totales de ambas finanzas se recalculan."; botón "Mover"; éxito "Movidos {n} a {destino}"; parcial "Movidos {n}. {m} no se pudieron mover" (con detalle de motivos) |
| 403 finanza | "Ya no tenés acceso a {nombre}. Volviste a Personal." |
| 403 rol | "Tu rol en {finanza} es Lector: solo podés ver." |
| Tema | borde de pantalla 3 px con el color de la finanza; en Personal, color de Omero |

### 3.5 Backfill: qué pasa con los datos actuales

- Cada `Household` existente queda `kind = PERSONAL` (y conserva su `type`).
- `ownerUserId` = el usuario del hogar con `role = ADMIN` más antiguo; si no hay, el más antiguo por `createdAt`. Si el hogar no tiene usuarios queda `null` (nadie accede; no se borra).
- `FinanceMember`: **solo el dueño**, como ADMIN (R2: dentro de una finanza personal no existe otro usuario).
- Cada usuario que no es dueño de su hogar actual (caso real: Maria) recibe su propia `Household(kind PERSONAL, ownerUserId = ella, name = "Personal de {nombre}")` vacía + `FinanceMember(ADMIN)`, y su `User.householdId` se **reapunta a esa finanza** (R3: el default de cada quien es su personal).
- **Consecuencia a tener en cuenta:** al correr el backfill, Maria deja de ver lo cargado hasta hoy en el hogar de Avelino. Los datos no se tocan ni se borran. El flujo esperado es: Avelino crea el Hogar, agrega a Maria, y mueve los gastos en pareja con "Mover a finanza". Por eso el backfill de producción se corre recién cuando la app con el selector está lista (tarea 20).

---

## 4. Spec técnico

### 4.1 Prisma (`prisma/schema.prisma`)

```prisma
enum FinanceKind {
  PERSONAL
  SHARED
}

enum FinanceRole {
  ADMIN
  EDITOR
  VIEWER
}

model Household {
  id          String        @id @default(cuid())
  name        String
  type        HouseholdType @default(PERSONAL) // legacy, no se usa más; se conserva
  /// Tipo de finanza (S1). PERSONAL = una por usuario; SHARED = Hogar/negocio.
  kind        FinanceKind   @default(PERSONAL)
  /// Dueño de la finanza. Siempre ADMIN implícito. Null solo en hogares huérfanos del backfill.
  ownerUserId String?
  /// Clave de paleta (ver src/lib/plan/finances.ts). Null en PERSONAL = color de Omero.
  color       String?
  createdAt   DateTime      @default(now())

  owner       User?                 @relation("FinanceOwner", fields: [ownerUserId], references: [id], onDelete: SetNull)
  users       User[]                @relation("UserHousehold")
  members     FinanceMember[]
  invitations HouseholdInvitation[]
  cards       Card[]
  // ...relaciones plan* sin cambios

  @@index([ownerUserId])
}

model User {
  // ...campos sin cambios
  household          Household       @relation("UserHousehold", fields: [householdId], references: [id])
  ownedFinances      Household[]     @relation("FinanceOwner")
  financeMemberships FinanceMember[]
}

model FinanceMember {
  id          String      @id @default(cuid())
  userId      String
  householdId String
  role        FinanceRole @default(EDITOR)
  createdAt   DateTime    @default(now())

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  household Household @relation(fields: [householdId], references: [id], onDelete: Cascade)

  @@unique([userId, householdId])
  @@index([householdId])
}
```

Notas: (a) al haber ahora dos relaciones `User`↔`Household`, Prisma exige nombrar ambas (`"UserHousehold"`, `"FinanceOwner"`); es un cambio solo de cliente, sin DDL. (b) `HouseholdType` y `Household.type` NO se tocan (la sesión aún expone `householdType`); `kind` es el campo de verdad desde S1. (c) Prisma 7: verificar la API del cliente generado antes de escribir queries (`npx prisma generate`).

### 4.2 Migración y backfill

- Migración `prisma/migrations/20261102120000_add_finance_owner_members/migration.sql`, generada con `npx prisma migrate dev --name add_finance_owner_members` y revisada a mano: solo `CREATE TYPE`, `ALTER TABLE "Household" ADD COLUMN "kind" ... DEFAULT 'PERSONAL', ADD COLUMN "ownerUserId" TEXT, ADD COLUMN "color" TEXT`, `CREATE TABLE "FinanceMember"`, índices y FKs. Sin `UPDATE` de datos ni `DROP`.
- Backfill: `prisma/backfill/finanzas-s1.ts` (ejecutar: `npx tsx prisma/backfill/finanzas-s1.ts`, con `--dry-run` que solo imprime). Idempotente:
  1. Por cada `Household` con `ownerUserId IS NULL` y al menos un usuario → fija `ownerUserId` (regla 3.5) y `kind = PERSONAL`.
  2. `upsert` de `FinanceMember` (clave `userId_householdId`): solo el dueño como ADMIN (R2); nunca baja un rol ya existente.
  3. Por cada `User` sin `Household(kind PERSONAL, ownerUserId = user.id)`: crea esa finanza + `FinanceMember` ADMIN + `ensurePlanDefaults`, y fija `User.householdId` = esa finanza (R3).
  4. Imprime resumen (hogares tocados, miembros creados, personales creadas). Segunda corrida → todo en 0.
- Orden de despliegue: migración → deploy del backend (compatible con y sin backfill gracias al fallback de `resolveFinance`) → backfill → release de la app. Rollback: el código nuevo es tolerante; revertir deploy no rompe porque las columnas tienen default.

### 4.3 Helpers (`src/lib/plan/access.ts`, `src/lib/plan/finances.ts`)

`src/lib/plan/access.ts` (sin dependencias de Next salvo `ApiError`; la lógica de roles es pura y testeable):

```ts
export type Action = "read" | "create" | "update" | "delete" | "manage";
export type Role = "ADMIN" | "EDITOR" | "VIEWER";

/** Pura. Tabla de la sección 3.2. */
export function roleAllows(role: Role | null, action: Action): boolean;

export interface FinanceRef { id: string; ownerUserId: string | null }

/** Rol efectivo del usuario en una finanza: ADMIN si es dueño, si no el de FinanceMember, si no null. */
export async function roleIn(userId: string, finance: FinanceRef): Promise<Role | null>;

/** LA regla de acceso (principio 2 del contrato). */
export async function canAccess(
  user: { id: string },
  resource: { householdId: string },   // cualquier fila con finanza (PlanEntry, PlanLoan, Card, ...)
  action: Action,
): Promise<boolean>;

/** Resuelve la finanza activa: header/cookie/fallback User.householdId. Lanza ApiError 403. */
export async function resolveFinance(
  userId: string,
  requestedId: string | null,
  fallbackHouseholdId: string,
): Promise<{ householdId: string; role: Role; finance: FinanceRef & { kind: "PERSONAL" | "SHARED"; name: string; color: string | null } }>;

/** Para ids sueltos: 404 si no es miembro, 403 si es miembro sin permiso. */
export async function assertAccess(user: { id: string }, row: { householdId: string } | null, action: Action): Promise<void>;
```

`src/lib/plan/finances.ts`:

```ts
export const FINANCE_PALETTE = {
  violeta:  { light: "#6A43B8", dark: "#B79CF0" },
  azul:     { light: "#1F5FBF", dark: "#7FB0F5" },
  naranja:  { light: "#B45309", dark: "#F0B84A" },
  rosa:     { light: "#B83280", dark: "#F29BCB" },
  turquesa: { light: "#0E7C86", dark: "#6FD3DB" },
  rojo:     { light: "#A3352B", dark: "#F08A7E" },
} as const;
export const DEFAULT_SHARED_COLOR = "violeta";
export const OMERO_PERSONAL = { light: "#0F6B4F", dark: "#5FD3A4" };
export function isPaletteKey(v: unknown): v is keyof typeof FINANCE_PALETTE;
export async function listFinancesFor(userId: string): Promise<FinanceDTO[]>;   // owner ∪ members
export async function ensurePersonalFinance(userId: string): Promise<string>;   // idempotente
export async function mapCategoriesByName(tx, fromId: string, toId: string, ids: string[]): Promise<Map<string, string | null>>;
export async function moveEntries(tx, input: { entryIds: string[]; fromId: string; toId: string }): Promise<{ moved: string[]; skipped: { id: string; reason: string }[] }>;
```

`FinanceDTO = { id, name, kind, color: string | null, role: Role, ownerUserId, isOwner, memberCount }`.

`withSession` (en `src/lib/plan/server.ts`) pasa a **requerir la acción**:

```ts
export interface ApiContext {
  userId: string;
  householdId: string;          // finanza ACTIVA, ya autorizada para `action`
  role: Role;
  finance: { id: string; kind: "PERSONAL" | "SHARED"; name: string; color: string | null; ownerUserId: string | null };
  /** Para ids: carga la fila (sin filtro de finanza) y autoriza contra SU finanza. */
  assert: (row: { householdId: string } | null, action: Action) => Promise<void>;
}
export async function withSession(
  req: NextRequest,
  action: Action,                              // obligatorio: si una ruta no lo declara, no compila
  handler: (ctx: ApiContext) => Promise<Response>,
): Promise<Response>;
```

Flujo: `requireSession` (401) → `resolveFinance(session.user.id, req.headers.get("x-finance-id") ?? cookie omero_finance, session.user.householdId)` (403) → `roleAllows(role, action)` o 403 `"Tu rol en {finanza} es {rol}: no podés hacer esto"` → handler. Se conserva el `try/catch` de `ApiError`. Se agregan `ApiError(…, 403)` y `ApiError(…, 404)` ya soportados por el constructor.

Convención de las rutas migradas: las listas siguen usando `where: { householdId: ctx.householdId }` (acotar a la finanza activa); los `find*ById` pasan a `findUnique({ where: { id } })` + `await ctx.assert(row, "<acción>")`. Las funciones de `server.ts` que reciben `householdId` (`loadPlan`, `categoryIdOrNull`, `requireCard`, `requireStartedMonth`, `loadLoans`, etc.) **no cambian de firma**: reciben un `householdId` ya autorizado.

CORS/headers: `x-finance-id` debe estar permitido si hay configuración CORS (revisar `next.config.ts`; mobile no pasa por CORS, web es mismo origen).

### 4.4 Endpoints nuevos

Todos con `withSession`; `{ error: string }` en errores.

| Método y ruta | Body | Respuesta | Permiso |
|---|---|---|---|
| `GET /api/plan/finances` | — | `{ finances: FinanceDTO[], activeId: string }` | sesión (no usa finanza activa: `withSession(req,"read")` con fallback; ver nota) |
| `POST /api/plan/finances` | `{ name: string, color?: PaletteKey, type?: "SHARED"\|"ORGANIZATION"\|"MULTIPLE" }` | 201 `{ finance: FinanceDTO }` | cualquier usuario autenticado (crea SHARED, será su ADMIN/dueño) |
| `PATCH /api/plan/finances/[id]` | `{ name?: string, color?: PaletteKey }` | `{ finance: FinanceDTO }` | `manage` sobre `[id]` |
| `GET /api/plan/finances/[id]/members` | — | `{ members: [{ userId, name, email, role, isOwner }] }` | `read` sobre `[id]` |
| `POST /api/plan/finances/[id]/members` | `{ email: string, role: "ADMIN"\|"EDITOR"\|"VIEWER" }` | 201 `{ member }` | `manage` sobre `[id]` |
| `PATCH /api/plan/finances/[id]/members/[userId]` | `{ role }` | `{ member }` | `manage` sobre `[id]` |
| `DELETE /api/plan/finances/[id]/members/[userId]` | — | `{ ok: true }` | `manage`, o el propio usuario saliéndose |
| `POST /api/plan/entries/move` | `{ entryIds: string[] (1..200), toFinanceId: string }` | `{ moved: string[], skipped: { id, reason }[], from: FinanceDTO, to: FinanceDTO }` | `update` en origen y `create` en destino |

Notas:

- `finances` y `finances/[id]/*` operan sobre un `[id]` explícito, no sobre la finanza activa: usan una variante `withUser(req, handler)` (solo sesión, sin finanza activa) + `assertAccess` sobre `[id]`. `GET /finances` y `POST /finances` también usan `withUser`. (`withUser` y `withSession` comparten el manejo de errores.)
- Validación con los `v.*` existentes (`v.text(name, "Nombre", 60)`, etc.). `color` inválido → 400 "Color inválido". Cambiar `color` de una PERSONAL → 422 "La finanza personal usa el color de Omero".
- `entries/move`: el origen se infiere del primer movimiento (se cargan los movimientos por id sin filtro de finanza; si pertenecen a finanzas distintas → 422 "Los movimientos tienen que ser de la misma finanza"). Para no filtrar existencia, ids de finanzas ajenas se reportan como "No encontrado".
- Ruta `entries/move` convive con `entries/[id]`: en Next App Router el segmento estático `move` tiene prioridad sobre `[id]` (verificar con `node_modules/next/dist/docs/` según `AGENTS.md`).
- Verbos (R4): los endpoints nuevos usan `POST` (crear), `PATCH` (actualizar) y `DELETE`. Los 27 existentes conservan su método y **no se deprecan** en S1: siguen sirviendo a la app publicada. Se deprecarán solo si algún día una ruta tiene una versión incompatible.

### 4.5 Migración de los endpoints existentes (lista exhaustiva)

Regla: reemplazar `withSession(req, async ({ householdId }) => …)` por `withSession(req, "<acción>", async (ctx) => …)`, usar `ctx.householdId` para listas/escrituras en la finanza activa y `ctx.assert(row, acción)` donde hoy hay `findX(householdId, id)`. Archivos bajo `src/app/api/plan/`:

| # | Archivo | Métodos | Acción | Cambio específico |
|---|---|---|---|---|
| 1 | `balance/route.ts` | GET, POST | GET `read`; POST `create` | patrimonio de la finanza activa (S4 agrega toggle) |
| 2 | `balance/[id]/route.ts` | PATCH, DELETE | `update` / `delete` | `findItem` → `findUnique` + `assert` |
| 3 | `budget/route.ts` | PUT | `update` | presupuesto del mes de la finanza activa |
| 4 | `card-purchases/route.ts` | POST | `create` | `requireCard(ctx.householdId, …)`: la tarjeta tiene que ser de la finanza activa (S2 lo cambia) |
| 5 | `card-purchases/[id]/route.ts` | PATCH, DELETE | `update` / `delete` | `findPurchase` → `findUnique` + `assert`; si cambia `cardId`, la tarjeta debe ser de la misma finanza que la compra |
| 6 | `card-statements/route.ts` | POST | `create` | idem `requireCard` |
| 7 | `card-statements/[id]/route.ts` | PATCH, DELETE | `update` / `delete` | `findStatement` → `findUnique` + `assert` |
| 8 | `cards/route.ts` | POST | `create` | `Card.householdId = ctx.householdId` |
| 9 | `cards/[id]/route.ts` | PATCH, DELETE | `update` / `delete` | `findCard` → `findUnique` + `assert` |
| 10 | `categories/route.ts` | POST | `create` | duplicados acotados a la finanza activa |
| 11 | `categories/[id]/route.ts` | PATCH, DELETE | `update` / `delete` | `findCategory` → `findUnique` + `assert`; duplicado de nombre dentro de la finanza **de la categoría** |
| 12 | `data/route.ts` | GET | `read` | `loadPlan(ctx.householdId, period)`; agregar al DTO `finance: { id, name, kind, color, role }` para que el cliente pinte tema y oculte acciones de Lector |
| 13 | `entries/route.ts` | POST | `create` | categorías validadas contra la finanza activa; `requireStartedMonth` igual |
| 14 | `entries/[id]/route.ts` | PATCH, DELETE | `update` / `delete` | `findEntry` → `findUnique` + `assert`; `categoryIdOrNull(row.householdId, …)` (finanza del movimiento, no la activa) |
| 15 | `entries/move/route.ts` | POST (nuevo) | `update`+`create` | ver 4.4 |
| 16 | `errors/route.ts` | POST | `read` | cualquier miembro (incluso Lector) puede reportar; guarda `householdId` activo |
| 17 | `inbox/route.ts` | GET | `read` | bandeja de la finanza activa |
| 18 | `inbox/[id]/confirm/route.ts` | POST | `create` | `findFirst({id,householdId})` → `findUnique` + `assert(item,"create")`; el movimiento se crea en `item.householdId`; reglas (`PlanInboxRule`) en esa finanza |
| 19 | `inbox/[id]/dismiss/route.ts` | POST | `update` | `findUnique` + `assert(item,"update")` |
| 20 | `inbox/apple-pay/route.ts` | POST | `create` (por token) | NO usa `withSession`. `PlanApiToken.userId` ya es obligatorio (R9: no hay tokens legacy, sin camino de compatibilidad). Tras validar el hash: `canAccess({ id: token.userId }, { householdId: token.householdId }, "create")`; si falla → 403 `{ error: "El token ya no tiene permiso en esta finanza" }`. El token queda atado a la finanza activa donde un ADMIN lo creó (fila 26) |
| 21 | `loans/route.ts` | POST | `create` | `loanFields(ctx.householdId, …)` |
| 22 | `loans/[id]/route.ts` | PATCH, DELETE | `update` / `delete` | `findLoan` → `loadLoans(...)` + `assert`; usar la finanza del préstamo |
| 23 | `loans/[id]/balance/route.ts` | POST, DELETE | `update` | `assert` sobre el préstamo antes de `setLoanBalance` / `removeLoanBalance` |
| 24 | `loans/[id]/past-payments/route.ts` | POST, DELETE | `update` | `assert` sobre el préstamo antes de `addPastPayments` / `removeOldestPastPayment` |
| 25 | `month/route.ts` | POST, PATCH | `create` / `update` | iniciar y editar el mes de la finanza activa (fijos, cuotas, presupuesto sugerido) |
| 26 | `tokens/route.ts` | GET, POST | `manage` | solo ADMIN gestiona tokens (dan escritura a la finanza); `PlanApiToken.userId = ctx.userId`, `householdId = ctx.householdId` |
| 27 | `tokens/[id]/route.ts` | DELETE | `manage` | `findUnique` + `assert(token,"manage")` |
| 28 | `voice/route.ts` | POST | `create` | categorías de la finanza activa; Lector → 403 antes de gastar tokens de OpenAI |

(28 filas = los 27 `route.ts` existentes + el nuevo `entries/move`.) Archivos no-`plan` que usan sesión (`src/app/api/auth/*`): sin cambios de lógica; opcional agregar `finances` al `GET /api/auth/me` (no obligatorio, el cliente usa `GET /api/plan/finances`).

Verificación de exhaustividad (tarea 5 del plan): `grep -L 'withSession(req, "' $(find src/app/api/plan -name route.ts)` debe listar solo `inbox/apple-pay/route.ts`; `grep -rn "session.user.householdId" src` solo debe aparecer en `access.ts`/`server.ts` (fallback) y en las páginas web migradas.

### 4.6 Impacto en `buildSummary`

Ninguno. `buildSummary` (`src/lib/plan/core.ts`) recibe los movimientos de **una** finanza ya filtrados; al ser `loadPlan(ctx.householdId, period)` por finanza, cada finanza calcula su propio resumen. "Mover" cambia qué movimientos entran en cada finanza y los totales se recalculan solos en la siguiente lectura (los clientes invalidan caché, 4.7).

### 4.7 Mobile (`mobile/`)

- `mobile/lib/api.ts`: variable de módulo `activeFinanceId` + `setActiveFinanceId(id | null)`; `fetch` agrega `x-finance-id` cuando hay valor. En una respuesta 403 con `error` que empieza por "No tenés acceso a esa finanza" → dispara `onFinanceDenied` (el provider vuelve a Personal).
- Nuevo `mobile/src/providers/ActiveFinanceProvider.tsx` (se agrega en `AppProviders.tsx` dentro de `SessionProvider` y **por fuera** de `ThemeProvider`, porque el tema depende de la finanza): carga `GET /api/plan/finances`, persiste la elección en `prefSet("omero_finance_id")`, expone `{ finances, active, setActive, createHome, refresh }`. Al cambiar de finanza: `setActiveFinanceId(id)` + `queryClient.clear()` (no mezclar cachés). Las query keys de `mobile/src/data/` deben incluir `active.id` como defensa en profundidad.
- Tema por finanza: `ThemeProvider` recibe `accent` del provider (clave de paleta → hex según `statusBar`/modo claro-oscuro). Para SHARED, el override reemplaza `primary` y lo que deriva de él en `mobile/src/design-system/tokens/themes.ts` (`tabActive`, `fab`, `chartHighlight`, `chart[0]`); PERSONAL no hace override (color de Omero). Mantener `useTheme()` sin cambios de API. Los hex de la paleta se **copian** a `mobile/src/design-system/tokens/financeColors.ts` (mobile no importa de `src/lib`; mantener en sincronía con `FINANCE_PALETTE`, test que los compara).
- Borde y barra: `mobile/app/_layout.tsx` envuelve la navegación en un `View` con `borderWidth: 3` y `borderColor: accent`; la barra superior toma `accent` de fondo.
- Omero como selector: nuevo `mobile/src/components/organisms/FinanceSwitcher.tsx` (trigger = mascota `mobile/src/mascots/omero` + nombre + "cambiar ▾") y `FinanceSheet.tsx` (lista, rol, "Crear un Hogar"). Se monta en el header de las pestañas (`mobile/app/(tabs)/_layout.tsx` / `HomeScreen.tsx` donde hoy está la mascota). Con una sola finanza el trigger igual abre el sheet (para descubrir "Crear un Hogar").
- Pantallas nuevas: `mobile/app/finanzas/nueva.tsx` (Crear Hogar) y `mobile/app/finanzas/[id].tsx` (nombre, color, miembros, agregar por correo, cambiar rol, quitar), accesibles desde el sheet y desde Menú (`mobile/src/features/menu/MenuScreen.tsx`). Features en `mobile/src/features/finances/`.
- Mover a finanza: en `mobile/src/features/movements/MovementsScreen.tsx` modo selección (long-press) + barra de acciones "Mover a finanza"; también en `EditMovementScreen.tsx` ("Mover a finanza" para uno). Llama `POST /api/plan/entries/move`, invalida queries de ambas finanzas. Ocultar si hay una sola finanza o si el rol activo es Lector.
- Rol Lector: según `data.finance.role`, ocultar botón de cargar (FAB), editar y borrar; el servidor igual lo impide.
- i18n: textos de 3.4 en `mobile/src/i18n/locales/*` (claves bajo `finances.*`).
- Tipos: `mobile/lib/types.ts` agrega `FinanceDTO`, `PlanData.finance` (mantener en sincronía con `src/lib/plan/server.ts`, como indica el comentario del archivo).

### 4.8 Web (`src/app/plan`, mínimo S1)

- `src/lib/plan/page.ts`: helper `getActiveFinanceId()` que lee la cookie `omero_finance` y valida con `resolveFinance`; las `page.tsx` de `src/app/plan/**` dejan de usar `session.user.householdId` directo (enumerar con `grep -rn "householdId" src/app/plan src/components/plan`).
- `src/components/plan/finance-switcher.tsx` (client) en el encabezado de `src/app/plan/layout.tsx`: setea la cookie vía un route handler `POST /api/plan/finances/active` `{ id }` (valida acceso, `Set-Cookie omero_finance`, httpOnly=false, sameSite lax) y hace `router.refresh()`.
- Borde de color en el contenedor de `layout.tsx` según la finanza activa. La experiencia de escritorio completa y la mascota en web son del spec Web.

---

## 5. Plan de tareas

Leyenda: `[P]` paralelizable con las de su mismo bloque.

**Bloque A — Base (secuencial)**
0. Leer `node_modules/next/dist/docs/` y confirmar: prioridad de `entries/move` sobre `entries/[id]`, API de `cookies()`/`headers()` en route handlers (R11, `AGENTS.md`). Documentar el hallazgo en el PR. (sin dependencias)
1. Prisma: enums, columnas de `Household`, `FinanceMember`, nombres de relaciones; `prisma migrate dev`; revisar el SQL; `prisma generate`. (sin dependencias)
2. Script `prisma/backfill/finanzas-s1.ts` con `--dry-run` + corrida contra una copia/branch de Neon. (dep. 1)

**Bloque B — Núcleo backend**
3. `src/lib/plan/access.ts` (`roleAllows`, `roleIn`, `canAccess`, `resolveFinance`, `assertAccess`) + tests unitarios. (dep. 1)
4. `src/lib/plan/finances.ts` (paleta, `listFinancesFor`, `ensurePersonalFinance`, `mapCategoriesByName`, `moveEntries`) + tests. (dep. 1) `[P con 3]`
5. `withSession`/`withUser` nuevos en `server.ts` con acción obligatoria, `ApiContext` ampliado; `loadPlan` devuelve `finance`. (dep. 3, 4)

**Bloque C — Endpoints (todos dep. 5; paralelizables entre sí, uno por agente)**
6. Migrar rutas 1–7 (`balance*`, `budget`, `card-purchases*`, `card-statements*`). `[P]`
7. Migrar rutas 8–14 (`cards*`, `categories*`, `data`, `entries`, `entries/[id]`). `[P]`
8. Migrar rutas 16–24 (`errors`, `inbox*`, `apple-pay`, `loans*`). `[P]`
9. Migrar rutas 25–28 (`month`, `tokens*`, `voice`). `[P]`
10. Endpoints nuevos `finances`, `finances/[id]`, `members*`, `finances/active` (web). `[P]`
11. `entries/move` (ruta 15). `[P]`
12. Verificación de exhaustividad con los `grep` de 4.5 y `npx tsc --noEmit`. (dep. 6–11)
12b. Suite de integración completa (R8): recorre todos los flujos de la app (cargar, editar, borrar, mes, tarjetas, préstamos, bandeja, voz, tokens, patrimonio, finanzas, miembros, mover) contra una base de test, con usuarios Dueño/Editor/Lector/ajeno. Es condición para la tarea 20. (dep. 12)

**Bloque D — Cliente (dep. 5 y contrato de 4.4; puede arrancar contra endpoints mockeados)**
13. Mobile: `api.ts` header + `ActiveFinanceProvider` + persistencia + manejo 403. `[P]`
14. Mobile: tema/borde por finanza (`financeColors.ts`, `ThemeProvider`, `_layout.tsx`). (dep. 13)
15. Mobile: `FinanceSwitcher` + `FinanceSheet` + header. (dep. 13)
16. Mobile: pantallas Crear Hogar y detalle/miembros. (dep. 13) `[P con 15]`
17. Mobile: "Mover a finanza" en Movimientos/Edit. (dep. 13, 11)
18. Mobile: modo Lector (ocultar acciones) + i18n + tipos. (dep. 13) `[P]`
19. Web mínimo (4.8). (dep. 10) `[P con 13–18]`

**Bloque E — Cierre**
20. Correr backfill en producción tras deploy de backend y con la app nueva lista (ver 3.5: Maria deja de ver el hogar de Avelino); smoke con `GET /api/plan/data` antes/después (mismos totales para el dueño). Requiere confirmación explícita antes de correrse. (dep. 12b)
21. E2E manual en iPhone (sección 6) y release EAS. (dep. 13–19, 20)

## 6. Tests

**Unitarios (Jest, `src/lib/plan/`)** — nota: `jest.config` usa `jsdom`; los tests con Prisma mockeado llevan `/** @jest-environment node */`.

- `access.test.ts`: `roleAllows` para las 15 combinaciones rol×acción; `canAccess` dueño sin fila de miembro = ADMIN; miembro VIEWER no puede `update`; no miembro → false; `resolveFinance` sin header usa el fallback; con header ajeno lanza 403; con header propio devuelve rol; usuario sin PERSONAL → la crea una sola vez.
- `finances.test.ts`: `isPaletteKey`; `mapCategoriesByName` (case-insensitive, mismo `kind`, sin match → `null`); `moveEntries` separa `moved`/`skipped` (fijo, cuota, inexistente), conserva `period/amount/currency/isDone`, remapea `categoryId` y `targetCategoryId`; no deja último ADMIN (`members`).
- Paridad de paleta mobile↔server (test en `mobile/src/data/__tests__/` que compara `financeColors.ts` con `FINANCE_PALETTE`).
- Existentes: `core.test.ts`, `export.test.ts`, `voice*.test.ts` siguen verdes sin cambios.

**Integración completa (R8)** — además de la matriz de abajo, una suite que ejercita la app de punta a punta (todos los módulos, no solo los nuevos) con los cuatro perfiles de usuario, y se corre antes de cada deploy de la rama.

**Integración API** (handlers invocados con `NextRequest` y Prisma mockeado o base de test):

- Matriz de las 28 rutas × {sin sesión 401, no miembro 403/404, VIEWER en rutas de escritura 403, EDITOR ok}; test de tabla que itera la lista de 4.5.
- `x-finance-id` válido devuelve datos solo de esa finanza (`data`); header ajeno → 403; sin header → igual a hoy.
- `entries/move`: ok con categorías; parcial con fijo/cuota; VIEWER destino → 403 sin mover nada; misma finanza → 422; >200 → 422; mes destino no iniciado se crea con el mismo `usdRate`.
- `finances`: crear (409 por nombre repetido), color inválido 400, PERSONAL no acepta miembros (422), último ADMIN protegido (409), salirse, reapuntado de `User.householdId`.
- `inbox/apple-pay`: token de usuario degradado a VIEWER → 403.
- Backfill: dos corridas seguidas → segunda sin cambios; hogar con 2 usuarios → dueño ADMIN + otro EDITOR + Personal nueva para el segundo.

**E2E manual en iPhone**

1. Login como Avelino (post backfill): ver Personal en verde; totales del mes idénticos a antes.
2. Omero → "Crear un Hogar" "Casa" violeta → la app cambia a violeta (barra, borde, FAB).
3. Hogar → Miembros → agregar el correo de Maria como Editor.
4. Cambiar a Personal → Movimientos → long-press 3 gastos → "Mover a finanza" → "Casa". Verificar: desaparecen de Personal, aparecen en Casa con categoría; resúmenes de ambas cambian.
5. Login como Maria (otro dispositivo/sesión): Omero muestra "Personal de Maria" y "Casa" (tras ser agregada); en Casa ve los gastos movidos; como Editor puede cargar; el admin la baja a Lector → pierde FAB y recibe 403 al forzar.
6. Maria entra tras el backfill: su default es "Personal de Maria" (vacía) y no ve la Personal de Avelino.
7. Matar y reabrir la app: recuerda la última finanza; si se le revoca el acceso, vuelve a Personal con el toast.
8. Web: `/plan` con el selector; cambiar de finanza muestra datos y borde correctos.
9. Apple Pay: token existente sigue creando items en su finanza.

## 7. Riesgos y decisiones abiertas

1. **`kind` vs `HouseholdType` existente.** Ya hay `Household.type` con `PERSONAL|SHARED|ORGANIZATION|MULTIPLE`. Se agrega `kind` con enum propio `FinanceKind` (el contrato pide `kind (PERSONAL|SHARED)`) y `type` queda legacy sin uso. Alternativa: reutilizar `type`; se descarta por los valores extra y por `householdType` en la sesión. Decisión propuesta: confirmar.
- R1: Podríamos mantener el type como Personal, organización, shared o multiple, no me parece mal, capaz más adelante definamos cosas para los tipos diferentes, pero si o si personal que funcione como el kind que definimos en la nueva estructura y shared que pueda ser cualquiera, organizacion, negocio, multiple, o wherever.
2. **Maria queda como EDITOR en la Personal de Avelino tras el backfill** (para no cortarle acceso a datos existentes), lo que contradice "la personal tiene un solo miembro". Es transitorio; la regla 422 aplica solo a *agregar*. Confirmar que es aceptable o preferir que el backfill convierta el hogar actual en `SHARED` "Hogar" (desviaría del principio 1 del contrato).
- R2: No puede existir dentro de una finanzas personales un usuario diferente al dueño. La unica cosa que pueden hacer es generar una transferencia de cuentas compartidas, si el usuario tiene acceso alguna de las finanzas de esa cuenta compartida puede hacer el gasto o el ingreso.
3. **`User.householdId` se mantiene** como finanza activa por defecto sin header (compat). Para Maria apunta a la finanza de Avelino hasta que Avelino la quite o ella elija otra; la app nueva siempre manda header persistido. Futuro: deprecar la columna (fuera de este ciclo).
- R3: Cada quien a punta como default las finanzas personales, y en el circulo puedes ir a una u otra finanzas
4. **Métodos HTTP existentes** (`PATCH`/`PUT`) contradicen el principio 7 del contrato (`POST /:id`). No se renombran en S1 para no romper builds de mobile ya instaladas; se propone un ciclo aparte con rutas alias.
- R4: Podría hacerse un nuevo endpoint, y dejar como deprecado a los patch/put si lo vemos necesario y así no romper con lo existente.
5. **Mover compras de tarjeta** entre finanzas no entra (la tarjeta es de la finanza hasta S2). El usuario con gastos en pareja pagados con tarjeta solo puede mover los movimientos manuales/confirmados; las compras de tarjeta se resuelven en S2 con `PlanCardPurchase.householdId` por compra.
- R5: Ok, si que los movimientos estén relacionados a la tarjeta y es de la finanza personal unicamente, hasta el S2
6. **Sin "deshacer" ni eliminar/archivar finanza** en S1. Una finanza creada por error queda; si molesta, definir en S2+ archivado (`isArchived`) — sería una columna nueva fuera del contrato, por eso no se agrega ahora.
- R6: OK.
7. **Agregar miembro solo por correo de usuario ya registrado**; las invitaciones a no registrados llegan en S4 con `Invite`. Mientras tanto la tabla `HouseholdInvitation` (legacy, con UI sin terminar) no se usa.
- R7: OK.
8. **Riesgo alto: cobertura de la migración de endpoints.** Un endpoint olvidado seguiría filtrando por `User.householdId`. Mitigación: acción obligatoria en la firma de `withSession` (error de compilación), `grep` de la tarea 12 y test de tabla de 28 rutas.
- R8: Debería cubrirse en todo lo largo y ancho de la app, hay que hacer pruebas de integración completa.
9. **Token de Apple Pay** autoriza por `token.userId`; tokens legacy sin `userId` se aceptan como hoy (verificar si existen en producción antes del release).
- R9: No existen hoy así que hagamos el cambio directo con el nuevo token, y esas validaciones definir en donde se agrega o a que finanzas o si se ignoran.
10. **Rol de `errors` y `voice`:** `errors` permite a Lectores; `voice` exige EDITOR. Confirmar.
- R10: ERRORS que seria?. voice si necesita ser editor para poder impactar cambios.
11. **Next.js 16:** confirmar en `node_modules/next/dist/docs/` la prioridad de rutas estáticas (`entries/move`) sobre dinámicas y la API de cookies/headers en route handlers (según `AGENTS.md`).
- R11: si.

## 7b. Resolución de las respuestas R1–R11 (aplicadas arriba)

- R1: `type` se conserva como subtipo; `kind` manda (3.2). R2/R3: sin miembros ajenos en una personal; default = personal propia (3.5, 4.2). R4: verbos estándar en lo nuevo, nada se deprecia hoy (4.4). R5: tarjeta = personal hasta S2. R8: suite de integración completa (tarea 12b). R9: sin tokens legacy (fila 20). R10: `errors` es el reporte de errores de la propia app (`reportError`) y queda en `read` para que cualquier miembro, incluso Lector, pueda reportar; `voice` exige `create` (EDITOR+). R11: tarea 0.

## 8. Contrato hacia la siguiente semana (S2: cuentas y tarjetas)

**S1 deja listo**

- `Household.kind/ownerUserId/color`, `FinanceMember` y los enums `FinanceKind`/`FinanceRole` en producción, con backfill aplicado.
- `src/lib/plan/access.ts` (`canAccess`, `roleIn`, `resolveFinance`, `assertAccess`) y `withSession(req, action, handler)` con `ctx.householdId` (finanza activa autorizada), `ctx.role`, `ctx.finance`, `ctx.assert`. Toda ruta nueva de S2 debe usarlos.
- `x-finance-id` / cookie `omero_finance` y `ActiveFinanceProvider` en mobile (con `active.id` en las query keys) y selector de finanza en web mínimo.
- `moveEntries` y `entries/move` operativos (S2 debe extenderlos para que, al mover, el `accountId` del movimiento se conserve y la cuenta quede relacionada con la finanza destino vía `AccountFinance`).
- Paleta/tema por finanza listos; `PlanData.finance` en `GET /api/plan/data`.

**S2 asume**

- Que toda lectura/escritura pasa por `ctx` (no hay otro acceso por `User.householdId`).
- Que `PlanAccount.ownerUserId` y `Card.ownerUserId` se autorizan con `canAccess` sobre la finanza de cada movimiento/compra y, para cuentas, con el dueño; `AccountFinance`/`CardFinance` se crean ligando a finanzas donde el usuario es EDITOR+.
- Que el backfill de S2 asigna las tarjetas existentes (`Card.householdId`) al `ownerUserId` de su finanza y las relaciona con ella en `CardFinance`.
- Que "Mover a finanza" de compras de tarjeta y el reparto del pago de resumen por finanza (decisión A del diseño) se implementan en S2 sobre `PlanCardPurchase.householdId`.
- Que los métodos HTTP existentes siguen siendo `PATCH`/`PUT` (no deprecados) y lo nuevo usa `POST`/`PATCH`/`DELETE` (R4).
- **Cuentas compartidas (R2):** una cuenta puede estar relacionada con varias finanzas; quien tenga acceso a alguna de esas finanzas puede registrar gastos e ingresos sobre la cuenta. Dos personas que comparten plata lo hacen así (cuenta compartida / transferencia entre cuentas), nunca metiendo a otro usuario en una finanza personal.
- Los movimientos de tarjeta pertenecen a la finanza personal hasta S2 (R5).
