# Semana 3 — Vínculos (EntryLink, FinanceCoverage, carryOver, buildSummary)

Rama: `feat/finanzas-s3-vinculos` -> PR a `develop`. Sigue `00-contrato.md`. Asume S1 (finanzas, `canAccess`, `x-finance-id`) y S2 (`PlanAccount`, `PlanEntry.accountId`, `PlanAccountTransfer`, reparto del resumen por finanza) completas y mergeadas.

---

## 1. Objetivo y "Listo cuando"

Un solo mecanismo para que un ingreso "pague" un gasto (reintegro de grupo, venta de algo comprado, negocio), aportes opcionales entre finanzas que generan gasto + ingreso espejo, y la deuda de tarjeta guardada de forma explícita (`carryOver`). `buildSummary` resta los ingresos vinculados del gasto en vez de sumarlos a Ingresos.

**Listo cuando** (todo observable en el iPhone y en `/plan`):

1. El juguete: gasto 70, ingreso 100 vinculado (tipo Negocio) -> la tarjeta del gasto muestra "Gastaste 70 · Cobraste 100 · Ganaste 30"; el resumen del mes muestra gasto 0 e Ingresos 30; Disponible = 30 (idéntico a no vincular nada).
2. La cena de 90.000 con 2 reintegros de 30.000 deja el gasto neto en 30.000 y cuenta 30.000 en el presupuesto "Salidas".
3. Un reintegro mayor al gasto deja el gasto neto en 0 y el excedente suma a Ingresos.
4. Con un aporte definido (Personal -> Hogar), al iniciar el mes aparecen, ya creados, el gasto "Aporte a Hogar" en Personal y el ingreso "Aporte de Avelino" en Hogar, con el mismo `linkId`. Marcar uno como pagado marca el otro (y mueve la plata entre cuentas si son distintas).
5. Pagar una tarjeta con mínimo o monto custom deja el saldo no pagado guardado en `PlanCardStatement.carryOver` y visible en Deudas; no cambia si después cambia el dólar.
6. Todos los movimientos (nuevos y viejos) tienen `source` y `refCode` (`MOV-XXXX`).
7. `npx jest src/lib/plan` en verde, incluida la tabla de la sección 6.1.

## 2. Alcance / Fuera de alcance

**Dentro**
- `EntryLink` (REIMBURSEMENT | BUSINESS): modelo, API, validaciones, UI de vincular/desvincular en mobile y web.
- `FinanceCoverage`: modelo, API CRUD, generación al iniciar mes (gasto + ingreso espejo, mismo `linkId`), sincronización de estado pagado, UI.
- `PlanCardStatement.carryOver`: persistencia al pagar, backfill, uso en `statementDebt` / `cardDebts`.
- `PlanEntry.source / linkId / refCode`: columnas, valores por defecto, backfill, generación de `refCode`.
- Ajuste de `buildSummary` y de los tipos que consume mobile (`mobile/src/domain/index.ts` re-exporta explícitamente).

**Fuera** (no hacer)
- Contactos, invitaciones, préstamos con contraparte, `LOAN_OUT` en el resumen (S4; solo se declara el valor del enum).
- Grupos y generación de `GROUP` / `GROUP_BACK` (S5-6; solo se declaran los valores del enum).
- Vincular entre finanzas distintas (v1: ingreso y gasto de la misma finanza).
- Vínculos entre períodos distintos y entre monedas distintas (ver Riesgos).
- Pantalla web de escritorio nueva (la spec Web consume esto).

---

## 3. Spec funcional

### 3.1 Historias de usuario

- Como usuario, pagué una cena de 90.000 y me devolvieron 30.000 + 30.000: al registrar cada ingreso lo vinculo a la cena y veo "Tu gasto real: 30.000".
- Como usuario, compré un juguete a 70 y lo vendí a 100: vinculo la venta a la compra (Negocio) y veo 30 de ganancia.
- Como usuario, me devolvieron más de lo que gasté: el gasto queda en 0 y la diferencia es ingreso.
- Como usuario, defino "cada mes aporto 350.000 de Personal a Hogar" (o 30% de mis ingresos): al iniciar el mes ya están creados el gasto y el ingreso espejo, listos para marcar pagados.
- Como usuario, pago el mínimo de la tarjeta y veo en Deudas cuánto quedó pendiente.
- Como usuario, quito un vínculo y todo vuelve a como estaba (gasto completo, ingreso completo).

### 3.2 Reglas de negocio

**Vínculos (EntryLink)**
1. Une un `PlanEntry` INCOME con un `PlanEntry` EXPENSE de la **misma finanza**, **mismo período** y **misma moneda**. `amount` = parte del ingreso aplicada a ese gasto, en la moneda de ambos.
2. Un ingreso puede vincularse a varios gastos y un gasto recibir varios ingresos. Restricción: `Σ links del ingreso <= monto del ingreso`. No hay tope por el lado del gasto (el excedente es válido, regla 5).
3. No se vincula un ingreso "por cobrar" (`isReceivable`: cuota de préstamo sin cobrar), ni entries con `source = COVERAGE` (ni como ingreso ni como gasto: los aportes no se vinculan).
4. Para un gasto E con vínculos: `aplicado = min(Σ links, monto(E))`, `excedente = Σ links − aplicado`, `neto(E) = monto(E) − aplicado`.
5. **Gasto neto** = gasto − ingresos vinculados (mínimo 0). El excedente de los vínculos cuenta como ingreso variable (cobrado).
6. Ingresos del mes = Σ (monto del ingreso − Σ sus links) + Σ excedentes. La parte vinculada **no** suma a Ingresos; se ve pegada al gasto.
7. Invariante: `availableArs` (y `freeArs`) es igual con vínculos que sin vínculos, para gastos pagados. Solo cambia dónde se ve la plata.
8. El neto reemplaza al monto del gasto en todo el resumen: fijos, variables, cuotas de préstamo, presupuesto por categoría, pagado/pendiente/reservado. Un gasto no pagado (fijo/cuota sin tildar) con vínculo: su neto queda pendiente.
9. Tipo `REIMBURSEMENT` (alguien me devuelve) o `BUSINESS` (venta/ingreso del negocio): mismo cálculo, distinta etiqueta ("Reintegro" / "Negocio").
10. Borrar un ingreso o un gasto borra sus vínculos (cascade). Borrar un vínculo no borra movimientos.

**Casos borde de vínculos**
- Editar el monto de un ingreso por debajo de `Σ sus links` -> 400 `"Este ingreso ya tiene $X vinculados. Quitá un vínculo primero."`.
- Cambiar moneda o período de un entry vinculado -> 400 `"Quitá los vínculos antes de cambiar la moneda o el mes."`.
- Vincular duplicado (mismo par) -> 409 `"Ese ingreso ya está vinculado a este gasto."`; para cambiar el monto se edita el vínculo.
- Mover entries a otra finanza (S1 "Mover a finanza"): si el entry tiene vínculos, se mueven todos juntos o se rechaza con `"Mové también los movimientos vinculados."` (ver Riesgos).
- Si algún vínculo llega al resumen inconsistente (otro período, otra moneda, ingreso por cobrar, entry ausente) `buildSummary` lo **ignora** sin romper.

**Aportes (FinanceCoverage)**
1. Regla opcional: de finanza A (origen) a finanza B (destino), `FIXED` (monto) o `PERCENT` (% de los ingresos del mes de A). Puede no existir ninguna.
2. Quien la crea necesita rol ADMIN o EDITOR en A **y** en B (`canAccess(user, A, "write")` y B).
3. A != B. Una regla activa por (A, B, nombre) no se valida; se permiten varias (ej. "Aporte Hogar", "Aporte Vacaciones").
4. Base del `PERCENT`: suma en ARS de los INCOME del período en A, excluyendo `source = COVERAGE`, ingresos por cobrar y la parte vinculada (usa el mismo cálculo "unlinked" de `applyLinks`). Se calcula una vez al generar; el usuario puede editar el monto propuesto antes de confirmar.
5. Al iniciar el mes de A (`POST /api/plan/month`), por cada regla activa confirmada se crean **dos** `PlanEntry` en una transacción con `linkId = "cov:{coverageId}:{period}"` y `source = COVERAGE`:
   - EXPENSE en A: nombre `"Aporte a {nombre de B}"`, cuenta = `fromAccountId`, categoría = `expenseCategoryId`, `isDone = false`.
   - INCOME en B: nombre `"Aporte de {nombre del usuario creador}"`, cuenta = `toAccountId`, categoría = `incomeCategoryId`, `isDone = false`.
   Monto 0 -> no se crea nada. Idempotente por `linkId` (unique `[linkId, householdId]`): reiniciar el mes no duplica.
6. El gasto del aporte cuenta en el presupuesto de A como gasto normal; el ingreso cuenta como ingreso de B. No usan `EntryLink`.
7. Sincronización: marcar `isDone` en cualquiera de los dos pone el otro igual; editar el monto de uno edita el otro; borrar uno borra el otro (con confirmación). Al pasar a pagado, si `fromAccountId != toAccountId` se registra un `PlanAccountTransfer` (S2) por el monto; si es la misma cuenta no hay transferencia. Al desmarcar se elimina esa transferencia.
8. Si al generar el usuario ya no tiene permiso de escritura en B, la regla se omite y se informa en la respuesta (`skipped`), sin abortar el mes.
9. Monedas: `FIXED` en `currency` de la regla; `PERCENT` siempre ARS. Ambos entries van en la misma moneda y monto.

**carryOver de tarjeta**
1. `carryOver` = lo que quedó sin pagar del resumen, congelado en el momento de marcarlo pagado: `round2(max(0, total + usd × dólar del mes − statementToPay))`.
2. Al marcar `isPaid = true` se calcula y guarda; al pasar a `isPaid = false` vuelve a 0.
3. `statementDebt`: si el resumen está pagado devuelve `carryOver`; si no, el total. Se ignora `carryOver` si no está pagado.
4. Con el reparto por finanza de S2, la parte de cada finanza del `carryOver` sigue la misma proporción del reparto del pago (se calcula, no se guarda).
5. El próximo resumen cargado de la tarjeta reemplaza la deuda (comportamiento actual de `cardDebts`); no se suma.

**refCode / source**
- Todo `PlanEntry` nuevo recibe `refCode` (`MOV-` + 4 caracteres de `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, único global) y `source` (`MANUAL` salvo los generados por aportes).

### 3.3 Textos de UI clave (es-AR)

| Lugar | Texto |
|---|---|
| Toggle en ingreso | "Es un reintegro o una venta de algo que gasté" |
| Selector de gasto | "¿Qué gasto cubre?" · vacío: "No hay gastos de este mes para vincular." |
| Tipo | "Reintegro" / "Negocio" |
| Tarjeta de gasto vinculado | "Tu gasto real" · "Pagaste $X" · "Te devolvieron − $Y" · "Ganaste $Z" (si excedente) |
| Acción | "Vincular ingreso" · "Quitar vínculo" |
| Confirmar quitar | "Quitar el vínculo vuelve a contar el gasto completo y el ingreso completo." |
| Aportes (lista) | "Aportes entre finanzas" · vacío: "No definiste aportes. Son opcionales." |
| Formulario aporte | "Desde {A} hacia {B}" · "Monto fijo" / "% de mis ingresos" · "Cuenta de salida" · "Cuenta de entrada" |
| Inicio de mes | "Aportes de este mes" (editable, destildable) |
| Aviso omitido | "No generamos el aporte a {B}: ya no tenés permiso de escritura." |
| Borrar mitad de aporte | "Este movimiento es parte de un aporte. Se borra también el de {finanza}." |
| Deudas tarjeta | "Quedó sin pagar de {tarjeta}: $X" |

---

## 4. Spec técnico

### 4.1 Prisma (migración aditiva `s3_vinculos`)

```prisma
enum EntrySource {
  MANUAL
  COVERAGE
  LOAN_OUT
  GROUP
  GROUP_BACK
}

enum EntryLinkType {
  REIMBURSEMENT
  BUSINESS
}

enum CoverageMode {
  FIXED
  PERCENT
}

// PlanEntry: agregar (el resto igual)
model PlanEntry {
  // ...campos existentes + accountId de S2
  source      EntrySource @default(MANUAL)
  /// Par gasto/ingreso espejo de un aporte: "cov:{coverageId}:{period}". Futuro: otros pares.
  linkId      String?
  /// Código corto para preguntar por un movimiento ajeno: "MOV-7K2Q".
  refCode     String?     @unique

  incomeLinks  EntryLink[] @relation("EntryLinkIncome")
  expenseLinks EntryLink[] @relation("EntryLinkExpense")

  @@unique([linkId, householdId])
}

/// Ingreso que cubre todo o parte de un gasto (misma finanza, mes y moneda).
model EntryLink {
  id              String        @id @default(cuid())
  householdId     String
  incomeEntryId   String
  expenseEntryId  String
  /// Parte del ingreso aplicada a este gasto (moneda de ambos).
  amount          Decimal       @db.Decimal(14, 2)
  type            EntryLinkType
  createdByUserId String
  createdAt       DateTime      @default(now())

  household    Household @relation(fields: [householdId], references: [id])
  incomeEntry  PlanEntry @relation("EntryLinkIncome", fields: [incomeEntryId], references: [id], onDelete: Cascade)
  expenseEntry PlanEntry @relation("EntryLinkExpense", fields: [expenseEntryId], references: [id], onDelete: Cascade)
  createdBy    User      @relation(fields: [createdByUserId], references: [id])

  @@unique([incomeEntryId, expenseEntryId])
  @@index([householdId])
  @@index([expenseEntryId])
}

/// Aporte opcional de una finanza a otra. Genera gasto en `from` e ingreso espejo en `to`.
model FinanceCoverage {
  id                String       @id @default(cuid())
  fromHouseholdId   String
  toHouseholdId     String
  createdByUserId   String
  name              String       @default("Aporte")
  mode              CoverageMode
  /// FIXED: monto por mes. PERCENT: null.
  amount            Decimal?     @db.Decimal(14, 2)
  currency          Currency     @default(ARS)
  /// PERCENT: % de los ingresos del mes de `from` (0-100).
  percent           Decimal?     @db.Decimal(5, 2)
  fromAccountId     String
  toAccountId       String
  expenseCategoryId String?
  incomeCategoryId  String?
  isActive          Boolean      @default(true)
  createdAt         DateTime     @default(now())

  fromHousehold   Household    @relation("CoverageFrom", fields: [fromHouseholdId], references: [id])
  toHousehold     Household    @relation("CoverageTo", fields: [toHouseholdId], references: [id])
  createdBy       User         @relation(fields: [createdByUserId], references: [id])
  fromAccount     PlanAccount  @relation("CoverageFromAccount", fields: [fromAccountId], references: [id])
  toAccount       PlanAccount  @relation("CoverageToAccount", fields: [toAccountId], references: [id])
  expenseCategory PlanCategory? @relation("CoverageExpenseCategory", fields: [expenseCategoryId], references: [id], onDelete: SetNull)
  incomeCategory  PlanCategory? @relation("CoverageIncomeCategory", fields: [incomeCategoryId], references: [id], onDelete: SetNull)

  @@index([fromHouseholdId, isActive])
  @@index([toHouseholdId])
}

// PlanCardStatement: agregar
model PlanCardStatement {
  // ...
  /// Lo que quedó sin pagar al marcar el resumen como pagado (congelado, en ARS).
  carryOver Decimal @default(0) @db.Decimal(14, 2)
}
```

Agregar los campos inversos en `Household` (`entryLinks`, `coveragesFrom`, `coveragesTo`), `User` (`entryLinks`, `coverages`), `PlanAccount` (`coveragesFrom`, `coveragesTo`) y `PlanCategory` (`coverageExpense`, `coverageIncome`). Los nombres de relación de `PlanAccount` asumen el modelo de S2; verificar contra `prisma/schema.prisma` antes de migrar.

**SQL extra en la migración** (Prisma no lo expresa):
```sql
ALTER TABLE "FinanceCoverage" ADD CONSTRAINT "coverage_distinct_finances" CHECK ("fromHouseholdId" <> "toHouseholdId");
ALTER TABLE "FinanceCoverage" ADD CONSTRAINT "coverage_mode_fields"
  CHECK (("mode" = 'FIXED' AND "amount" IS NOT NULL AND "amount" > 0)
      OR ("mode" = 'PERCENT' AND "percent" IS NOT NULL AND "percent" > 0 AND "percent" <= 100));
ALTER TABLE "EntryLink" ADD CONSTRAINT "entrylink_amount_positive" CHECK ("amount" > 0);
```

### 4.2 Backfill (idempotente) — `scripts/backfill-s3.ts`

Se corre después de la migración, con `--dry-run` por defecto y `--apply`.
1. `PlanEntry.source`: ya queda en `MANUAL` por default; no hace falta tocar nada.
2. `PlanEntry.refCode`: para cada entry con `refCode IS NULL` (en lotes de 500) generar código con `generateRefCode`, reintentar ante colisión (máx. 5). Re-ejecutar no cambia los ya asignados.
3. `PlanCardStatement.carryOver`: para cada resumen con `isPaid = true`, `carryOver = computeCarryOver(statement, usdRate de PlanMonth(householdId, period) o 0)`; solo si `carryOver = 0` y el cálculo da > 0 (no pisa valores ya calculados). Resúmenes no pagados quedan en 0.
4. Informar totales: entries actualizados, resúmenes con deuda, entries sin `PlanMonth` (usdRate 0).

### 4.3 Libs (`src/lib/plan/`)

**`core.ts`** (puro, lo consume mobile; sin DB):
```ts
export type EntrySource = "MANUAL" | "COVERAGE" | "LOAN_OUT" | "GROUP" | "GROUP_BACK";
export type EntryLinkType = "REIMBURSEMENT" | "BUSINESS";

export interface EntryLinkDTO {
  id: string;
  incomeEntryId: string;
  expenseEntryId: string;
  amount: number;            // en la moneda de ambos entries
  type: EntryLinkType;
}

// EntryDTO: agregar
//   source: EntrySource; linkId: string | null; refCode: string | null;
// StatementDTO: agregar
//   carryOver: number;
// SummaryInput: agregar
//   links?: EntryLinkDTO[];   // opcional, default []

export interface AppliedLinks {
  /** Monto efectivo en ARS de cada gasto (neto). Clave = entry id. */
  netByExpenseId: Map<string, number>;
  /** Parte NO vinculada de cada ingreso, en ARS. Clave = entry id. */
  unlinkedByIncomeId: Map<string, number>;
  reimbursedArs: number;     // Σ aplicado
  excessArs: number;         // Σ excedente
}
export function applyLinks(entries: EntryDTO[], links: EntryLinkDTO[], usdRate: number): AppliedLinks;

export function computeCarryOver(
  st: Pick<StatementDTO, "totalArs" | "minimumArs" | "usdAmount" | "payMode" | "customAmount">,
  usdRate: number,
): number;
```
`applyLinks` descarta (ignora) vínculos con: entry ausente, kinds incorrectos, períodos distintos, monedas distintas, ingreso `isReceivable`, `amount <= 0`. Los ingresos vinculados se acotan a `Σ links <= monto` (si excede, se escala a 0 la parte no vinculada, nunca negativa).

`Summary` agrega (ver 4.5): `reimbursedArs`, `linkExcessArs`, `grossSpentArs`.

`statementDebt(st, usdRate)` pasa a: `st.isPaid ? round2(st.carryOver) : round2(totalArs + usdAmount × usdRate)`.

**`links.ts`** (nuevo; puro salvo donde se indica):
- `validateLink(input: { income: EntryDTO; expense: EntryDTO; amount: number; existing: EntryLinkDTO[]; ignoreLinkId?: string }): string | null` — devuelve el mensaje de error o null. Reglas de 3.2 (1-3), en este orden: tipos, misma finanza (se valida en el endpoint con `householdId`), mismo período, misma moneda, no `COVERAGE`, no `isReceivable`, `amount > 0`, `amount <= ingreso − Σ otros links del ingreso`, no duplicado.
- `coverageAmount(cov: { mode; amount; percent }, baseIncomeArs: number): number` — `FIXED` -> `amount`; `PERCENT` -> `round2(base × percent / 100)`.
- `coverageBaseIncome(entries, links, usdRate): number` — Σ ingresos de A excluyendo `COVERAGE` y por cobrar, usando `applyLinks`.
- `buildCoverageProposal(coverages, baseIncomeArs, period): { coverageId; name; toName; amount; currency; linkId }[]`.
- `coverageLinkId(coverageId: string, period: string): string` — `"cov:{id}:{period}"`.
- `generateRefCode(rng: () => number = Math.random): string`.

**`links-server.ts`** (nuevo; usa Prisma):
- `createLink`, `updateLink`, `deleteLink` (usan `canAccess` de S1 y `validateLink`).
- `generateCoverageEntries(tx, { fromHouseholdId, period, userId, confirmed: {coverageId, amount}[] })`: crea los pares en la transacción de `POST /api/plan/month`; devuelve `{ created, skipped }`.
- `syncCoveragePair(tx, entryId, patch)`: aplica `isDone` / `amount` / borrado al par por `linkId`; crea/borra `PlanAccountTransfer` (servicio de S2; verificar firma real en `src/lib/plan/` al implementar).
- `assignRefCode(tx)`: genera y reintenta ante colisión (hasta 5 veces, luego 500).
- Cambiar `loadPlan` (`src/lib/plan/server.ts`) para incluir `links` (EntryLink por `householdId`+`period` de los entries) y `coverageProposals` cuando el mes no está iniciado.

**`card-statements`**: en la ruta que hoy marca `isPaid` (`src/app/api/plan/card-statements/[id]/route.ts`, hoy `PATCH`; mantener el verbo vigente tras S1/S2, y si el contrato ya lo migró a `POST /:id`, usar ese) calcular y guardar `carryOver` con `computeCarryOver` y el `usdRate` de `PlanMonth`.

### 4.4 Endpoints

Todos con `withSession` + `canAccess` (S1); finanza activa por `x-finance-id`. Errores `{ error: string }`.

| Método y ruta | Body | Respuesta | Permisos |
|---|---|---|---|
| `POST /api/plan/entry-links` | `{ incomeEntryId, expenseEntryId, amount, type }` | 201 `{ link: EntryLinkDTO }` | write en la finanza de ambos entries |
| `POST /api/plan/entry-links/:id` | `{ amount?, type? }` | 200 `{ link }` | write |
| `DELETE /api/plan/entry-links/:id` | — | 200 `{ ok: true }` | write |
| `POST /api/plan/entries` (existente) | agrega opcional `linkTo: { expenseEntryId, type, amount? }` (solo INCOME; `amount` por defecto = monto del ingreso) | 201 `{ entry, link }` | write; crea ingreso + vínculo en una transacción |
| `POST /api/plan/entries/:id` (existente) | rechaza bajar monto/moneda/período si rompe vínculos (3.2) | 200 | write |
| `GET /api/plan/data` (existente) | — | agrega `links: EntryLinkDTO[]`, `coverageProposals` | read |
| `GET /api/plan/coverages` | — | 200 `{ coverages }` donde la finanza activa es origen o destino | read |
| `POST /api/plan/coverages` | `{ fromHouseholdId, toHouseholdId, name, mode, amount?, percent?, currency?, fromAccountId, toAccountId, expenseCategoryId?, incomeCategoryId? }` | 201 `{ coverage }` | write en origen **y** destino; cuentas deben pertenecer a la finanza (relación `AccountFinance` de S2) |
| `POST /api/plan/coverages/:id` | campos editables (no cambia origen/destino) | 200 `{ coverage }` | write en origen y destino |
| `DELETE /api/plan/coverages/:id` | — | 200 `{ ok: true }`; los entries ya generados quedan | write en origen |
| `POST /api/plan/month` (existente) | agrega `coverages: [{ coverageId, amount }]` | agrega `coverages: { created: number, skipped: { coverageId, reason }[] }` | write en origen; en destino se verifica por regla (8) |
| `POST /api/plan/card-statements/:id` o `PATCH` vigente | marca pagado | devuelve statement con `carryOver` | write |

Códigos: 400 validación, 403 sin permiso, 404 no existe (o no accesible), 409 duplicado. Mensajes de 3.2.

### 4.5 Impacto en `buildSummary`

Pseudo-algoritmo (reemplaza `ars(e)` para gastos por `net(e)` y los ingresos por su parte no vinculada):

```ts
const { netByExpenseId, unlinkedByIncomeId, reimbursedArs, excessArs } =
  applyLinks(entries, input.links ?? [], usdRate);
const netArs = (e: EntryDTO) => netByExpenseId.get(e.id) ?? ars(e);
const incomeShare = (e: EntryDTO) => unlinkedByIncomeId.get(e.id) ?? ars(e);

// gastos: fixedArs, variableArs, loansArs, actualBy, paidBy usan netArs en vez de ars
// ingresos: incomeArs = Σ incomeShare(incomes) + excessArs
//           incomeFixedArs / incomeVariableArs / incomeReceivedArs usan incomeShare;
//           excessArs se suma a incomeVariableArs y a incomeReceivedArs
//           earmarkBy (targetCategoryId) usa incomeShare
// nuevos campos:
//   reimbursedArs, linkExcessArs: excessArs, grossSpentArs: spentArs + reimbursedArs
```

Notas: la fórmula de `availableArs`, `freeArs`, `reservedArs`, `unassignedArs` **no cambia**; cambian sus entradas. `source` no altera el cálculo en S3 (`LOAN_OUT` fuera del presupuesto lo hace S4). Un aporte (`COVERAGE`) es gasto/ingreso normal. `cardsArs` no se ve afectado por vínculos (no vinculables). `BudgetRow.actual` es el neto.

### 4.6 Pantallas y componentes

**Mobile** (`mobile/app`, `mobile/src`)
- `mobile/src/domain/index.ts`: re-exportar explícitamente `applyLinks`, `computeCarryOver`, `EntryLinkDTO`, `EntryLinkType`, `EntrySource` (la lista de exports es manual; ver su cabecera).
- `mobile/src/data/types.ts`, `mobile/src/data/sources/*`: mapear `links`, `source`, `refCode`, `carryOver` del payload de `/api/plan/data`.
- `mobile/src/data/movements.ts` (`movementsView`): cada `MovementItem` de gasto agrega `netArs`, `linkedArs`, `linkCount`; el ingreso vinculado se muestra bajo su gasto, no como movimiento suelto de Ingresos (chip "Reintegro"/"Negocio").
- `mobile/src/features/entry/EntryForm.tsx` y `NewEntryScreen.tsx`: toggle "Es un reintegro o una venta de algo que gasté" (solo INCOME) + selector de gasto del mes (`linkTo`).
- `mobile/src/features/movements/EditMovementScreen.tsx`: sección "Vínculos" (agregar/editar monto/quitar); en gasto: tarjeta nueva `LinkedExpenseCard` (organism en `mobile/src/components/organisms`) con barra mine/back/gain.
- `mobile/src/features/movements/MovementsScreen.tsx`: render del gasto neto + detalle expandible.
- Aportes: `mobile/app/aportes/index.tsx`, `mobile/app/aportes/nuevo.tsx` + `mobile/src/features/coverage/CoverageScreen.tsx`, `NewCoverageScreen.tsx`; entrada desde `mobile/src/features/menu/MenuScreen.tsx`. La generación al iniciar mes ocurre en la web (mobile hoy avisa que el mes no está iniciado), así que mobile solo administra reglas y marca pagados.
- `mobile/src/features/debts/DebtsScreen.tsx` (`CardsDebtRow`): usar `statementDebt` con `carryOver`.
- Textos en `mobile/src/i18n` (claves nuevas `links.*`, `coverage.*`).

**Web** (`src/app/plan`)
- Wizard de inicio de mes en `src/app/plan/page.tsx` (componente de inicio de mes que llama a `/api/plan/month`): sección "Aportes de este mes".
- `src/app/plan/ingresos/page.tsx` y `src/app/plan/gastos/page.tsx`: vincular/quitar, tarjeta de gasto vinculado.
- `src/app/plan/mas/page.tsx`: entrada "Aportes entre finanzas" -> `src/app/plan/aportes/page.tsx` (nueva).
- `src/app/plan/prestamos/page.tsx`: deuda de tarjetas con `carryOver`.
- Componentes web nuevos en `src/components/plan/` (seguir la convención de ese directorio; verificar al implementar).

---

## 5. Plan de tareas

Leyenda: [P] paralelizable con otras [P] del mismo bloque. Dependencias entre corchetes.

**Bloque A — base (secuencial)**
1. Prisma: enums, `EntryLink`, `FinanceCoverage`, columnas de `PlanEntry` y `PlanCardStatement.carryOver`, campos inversos; migración + SQL de constraints. [S1, S2]
2. `core.ts`: tipos (`EntryDTO`, `StatementDTO`, `SummaryInput`, `EntryLinkDTO`), `applyLinks`, `computeCarryOver`, `statementDebt`. [1]
3. `core.ts`: ajustar `buildSummary` y `Summary` (4.5). [2]
4. `core.test.ts`: tabla 6.1 y casos de carryOver (6.2); actualizar fixtures existentes con `source`, `linkId`, `refCode`, `carryOver`. [3]

**Bloque B — servidor [P entre B1, B2, B3 tras A]**
5. B1 `links.ts` + `links.test.ts` (validateLink, coverageAmount, coverageLinkId, generateRefCode). [2]
6. B1 `links-server.ts` (links CRUD) + rutas `entry-links` + `linkTo` en `entries` + guardas en `entries/:id`. [1, 5]
7. B2 `assignRefCode` en todos los puntos de creación de `PlanEntry` (entries, month, loans/createLoanEntry, inbox, voice-server). [1, 5]
8. B3 `card-statements/:id`: guardar `carryOver`. [1, 2]
9. `loadPlan` + `/api/plan/data`: `links`, `coverageProposals`. [6]
10. Rutas `coverages` + `generateCoverageEntries` + `syncCoveragePair` + extensión de `POST /api/plan/month`. [1, 5, 7, S2 transfers]
11. `scripts/backfill-s3.ts` (dry-run/apply). [1, 2, 5]

**Bloque C — clientes [P entre C1, C2, C3, C4 tras B]**
12. C1 mobile data: `domain/index.ts`, `types.ts`, `sources`, `movements.ts`. [3, 9]
13. C1 mobile: `EntryForm`/`NewEntryScreen`/`EditMovementScreen`/`MovementsScreen` + `LinkedExpenseCard`. [12]
14. C2 mobile: pantallas de aportes + menú. [10, 12]
15. C3 mobile: `DebtsScreen` con `carryOver`. [8, 12]
16. C4 web: wizard de inicio de mes, ingresos/gastos vinculados, aportes, deudas. [9, 10]

**Cierre**
17. Correr backfill en staging (dry-run y apply), verificar totales. [11]
18. E2E manual en iPhone (6.4). [13-16]
19. PR a `develop`; no tocar `main`. [18]

---

## 6. Tests

### 6.1 Unitarios — `buildSummary` con vínculos (`src/lib/plan/core.test.ts`, `describe("vínculos de ingreso a gasto")`)

Fixture común: `period = "2026-11"`, `usdRate = 1000`, sin tarjetas ni compras ni préstamos salvo que se indique. Categorías de gasto: `salidas` ("Salidas"), `juguetes` ("Juguetes"), `fijos` ("Fijos"). Entries variables = sin `recurringId` ni `loanId`. `links` con `type` según la fila. Valores en ARS; las cifras no listadas deben ser 0 (los tests usan `toBeCloseTo(x, 2)`). Siempre `incomeArs`, `variableArs`, `reimbursedArs`, `linkExcessArs`, `availableArs`, `freeArs` se verifican; el resto de filas indica su aserción.

**A. Juguete (70 / 100 / 30)**

| # | Entradas | incomeArs | variableArs | reimbursedArs | linkExcessArs | availableArs | freeArs | Otras aserciones |
|---|---|---|---|---|---|---|---|---|
| A0 | Sin vínculo: gasto 70 (juguetes), ingreso 100 | 100 | 70 | 0 | 0 | 30 | 30 | `spentArs 70`, `paidArs 70`, `unassignedArs 100` |
| A1 | Link BUSINESS 70 (ingreso 100 -> gasto 70) | 30 | 0 | 70 | 0 | 30 | 30 | `spentArs 0`, `paidArs 0`, `grossSpentArs 70`, `incomeVariableArs 30`, `incomeReceivedArs 30`, `unassignedArs 30`, `rows` no incluye Juguetes |
| A2 | Link BUSINESS 100 (ingreso 100 -> gasto 70) | 30 | 0 | 70 | 30 | 30 | 30 | igual que A1 salvo `linkExcessArs 30` |

Invariante: `A0.availableArs == A1.availableArs == A2.availableArs == 30`.

**B. Cena de 90.000, pagó Avelino, categoría Salidas, presupuesto Salidas 50.000**

| # | Entradas | incomeArs | variableArs | reimbursedArs | availableArs | freeArs | Otras aserciones |
|---|---|---|---|---|---|---|---|
| B0 | Gasto 90.000, sin ingresos | 0 | 90.000 | 0 | −90.000 | −90.000 | fila Salidas: `actual 90.000`, `status "over"`, `remaining −40.000`; `reservedArs 0`; `unassignedArs −50.000` |
| B1 | + ingreso Lucía 30.000, link REIMBURSEMENT 30.000 | 0 | 60.000 | 30.000 | −60.000 | −60.000 | Salidas: `actual 60.000`, `status "over"`, `remaining −10.000` |
| B2 | + ingreso Juan 30.000, link REIMBURSEMENT 30.000 (dos vínculos) | 0 | 30.000 | 60.000 | −30.000 | −50.000 | Salidas: `actual 30.000`, `status "ok"`, `remaining 20.000`; `reservedArs 20.000`; `budgetLeftArs 20.000`; `paidArs 30.000`; `grossSpentArs 90.000`; `unassignedArs −50.000` |
| B3 | Solo Lucía, pero ingreso de 35.000 con link 30.000 | 5.000 | 60.000 | 30.000 | −55.000 | −55.000 | `incomeVariableArs 5.000`; `unassignedArs −45.000` |

Invariante: `B2.availableArs == (ingresos 60.000 − gasto 90.000)`.

**C. Reintegro mayor al gasto**

| # | Entradas | incomeArs | variableArs | reimbursedArs | linkExcessArs | availableArs | freeArs | Otras aserciones |
|---|---|---|---|---|---|---|---|---|
| C1 | Gasto 50.000 (salidas, sin presupuesto), ingreso 80.000, link 80.000 | 30.000 | 0 | 50.000 | 30.000 | 30.000 | 30.000 | `rows` vacío; `incomeVariableArs 30.000`; `incomeReceivedArs 30.000` |
| C2 | Gasto 50.000, ingreso 80.000, link 50.000 (resto sin vincular) | 30.000 | 0 | 50.000 | 0 | 30.000 | 30.000 | igual a C1 salvo `linkExcessArs 0` |
| C3 | Gasto 90.000, dos ingresos de 60.000, links 60.000 + 60.000 | 30.000 | 0 | 90.000 | 30.000 | 30.000 | 30.000 | un gasto con dos vínculos que superan el gasto |

**D. Fijo no pagado con vínculo**

| # | Entradas | incomeArs | fixedArs | fixedPaidArs | pendingArs | reimbursedArs | availableArs | reservedArs | freeArs |
|---|---|---|---|---|---|---|---|---|---|
| D1 | Alquiler fijo (`recurringId`) 100.000, `isDone false`; ingreso variable 40.000, link 40.000 | 0 | 60.000 | 0 | 60.000 | 40.000 | 0 | 60.000 | −60.000 |

**E. Vínculos que se ignoran (defensivo)**

| # | Entradas | Resultado esperado |
|---|---|---|
| E1 | Gasto 70.000 en 2026-11; ingreso 100.000 en 2026-12; link 70.000. Resumen de 2026-11 | `variableArs 70.000`, `reimbursedArs 0`, `incomeArs 0`, `availableArs −70.000` |
| E2 | Gasto 70.000; ingreso por cobrar (`loanId` seteado, `isDone false`) 100.000; link 70.000 | `variableArs 70.000`, `reimbursedArs 0`, `incomeArs 0`, `receivableArs 100.000` |
| E3 | Gasto ARS 70.000; ingreso USD 70 (= 70.000 ARS); link 70 | `variableArs 70.000`, `incomeArs 70.000`, `reimbursedArs 0` (monedas distintas) |
| E4 | Link con `incomeEntryId` inexistente en `entries` | igual que sin vínculo, sin lanzar |
| E5 | Link con `amount 0` | igual que sin vínculo |

**F. USD**

| # | Entradas | variableArs | reimbursedArs | incomeArs | availableArs |
|---|---|---|---|---|---|
| F1 | Gasto USD 50 (= 50.000), ingreso USD 20 (= 20.000), link 20 | 30.000 | 20.000 | 0 | −30.000 |

**G. Aportes (sin `EntryLink`)**

| # | Entradas | Resultado esperado |
|---|---|---|
| G1 | Finanza A: gasto 350.000 `source COVERAGE`, `linkId "cov:c1:2026-11"` | `variableArs 350.000`, `reimbursedArs 0` |
| G2 | Finanza B: ingreso 350.000 `source COVERAGE`, mismo `linkId` | `incomeArs 350.000`, `incomeVariableArs 350.000` |

**`applyLinks` directo (casos mínimos):** sin links devuelve mapas vacíos y `reimbursedArs 0`; con A1 `netByExpenseId.get(gasto) == 0` y `unlinkedByIncomeId.get(ingreso) == 30`; con C3 `excessArs == 30.000`.

### 6.2 Unitarios — tarjetas y carryOver

| # | Resumen | usdRate | Esperado |
|---|---|---|---|
| K1 | total 100.000, mínimo 20.000, `MINIMUM`, `isPaid true`, `carryOver 80.000` | 1000 | `statementDebt = 80.000` |
| K2 | total 100.000, `TOTAL`, `isPaid true`, `carryOver 0` | 1000 | `0` |
| K3 | total 100.000, `isPaid false`, `carryOver 0` | 1000 | `100.000` |
| K4 | total 100.000, `isPaid false`, `carryOver 80.000` (dato viejo) | 1000 | `100.000` (ignora carryOver si no está pagado) |
| K5 | total 100.000, `usdAmount 10`, `CUSTOM 50.000`, `isPaid true`, `carryOver 60.000` (congelado a dólar 1000) | 1500 | `60.000` (antes daba 65.000) |
| K6 | `computeCarryOver`: total 100.000, `usdAmount 10`, `CUSTOM 50.000` | 1000 | `60.000` |
| K7 | `computeCarryOver`: `MINIMUM` con `minimumArs null`, total 100.000 | 1000 | `0` |
| K8 | `computeCarryOver`: `CUSTOM 150.000`, total 100.000 | 1000 | `0` |
| K9 | `cardDebts` con dos resúmenes de la misma tarjeta (oct pagado, carryOver 30.000; nov no pagado, total 80.000), período 2026-11 | 1000 | una fila con `debtArs 80.000`, `statementPeriod "2026-11"` |

Actualizar los tests existentes de `statementDebt`, `cardDebts` y `cardsBalanceItem` (`describe("deuda de tarjetas en patrimonio")`) con `carryOver` en los fixtures.

### 6.3 Unitarios — `links.test.ts`

- `validateLink`: acepta par válido; rechaza (mensaje no nulo) en cada caso: ingreso es gasto o viceversa, períodos distintos, monedas distintas, `source COVERAGE` en cualquiera de los dos, ingreso por cobrar, `amount <= 0`, `amount` mayor al ingreso, `Σ` de links del ingreso mayor al ingreso (ej. ingreso 100 con link previo 70 y nuevo 40 -> error; nuevo 30 -> ok), duplicado (y no error con `ignoreLinkId`).
- `coverageAmount`: `FIXED 350.000` -> 350.000; `PERCENT 30` sobre base 1.200.000 -> 360.000; `PERCENT 33.33` sobre 1.000 -> 333.30; base 0 -> 0; `PERCENT 100` -> base.
- `coverageBaseIncome`: excluye `COVERAGE`, por cobrar y parte vinculada (ingresos 1.000.000 + 200.000 con 50.000 vinculados + aporte 350.000 -> 1.150.000).
- `coverageLinkId("c1", "2026-11") === "cov:c1:2026-11"`.
- `generateRefCode`: cumple `/^MOV-[A-HJKMNP-Z2-9]{4}$/`; con `rng = () => 0` da `"MOV-AAAA"`; con `rng = () => 0.999999` da `"MOV-9999"`; 1.000 llamadas aleatorias no devuelven caracteres `I`, `L`, `O`, `0`, `1`.

### 6.4 Integración API (handlers con base de pruebas)

- `entry-links`: crear válido (201), duplicado (409), otra finanza (404/403), VIEWER (403), período distinto (400), moneda distinta (400), excede el ingreso (400); borrar entry borra sus links; `POST /entries/:id` bajando monto bajo `Σ links` (400).
- `entries` con `linkTo`: crea ingreso + vínculo atómicamente; si el vínculo es inválido no queda el ingreso.
- `coverages`: crear exige write en origen y destino (EDITOR en origen y VIEWER en destino -> 403); `from == to` (400); cuentas ajenas a la finanza (400).
- `month`: con `coverages` crea 2 entries con mismo `linkId` en finanzas distintas; segundo POST idempotente (no duplica); regla omitida si se perdió el permiso (`skipped`), el resto del mes se crea.
- `syncCoveragePair`: `isDone` se refleja en el par; cuentas distintas crean 1 `PlanAccountTransfer`, misma cuenta ninguna; desmarcar lo elimina; borrar un lado borra el otro.
- `card-statements`: marcar pagado `MINIMUM` guarda `carryOver`; desmarcar lo pone en 0.
- Multi-tenancy: ningún endpoint nuevo devuelve datos de otra finanza.
- Backfill: dos corridas seguidas dejan el mismo estado; ningún `refCode` repetido; `carryOver` no se pisa.

### 6.5 E2E manual en iPhone

1. Cargar gasto "Juguete" 70 y venta 100 vinculada (Negocio): tarjeta muestra 70 / 100 / +30; Inicio muestra Disponible igual que antes de vincular.
2. Cena 90.000 con dos reintegros: gasto real 30.000 en Presupuesto "Salidas"; quitar un vínculo -> 60.000.
3. Reintegro de 80.000 sobre un gasto de 50.000: gasto 0, ingresos +30.000.
4. Definir aporte 350.000 Personal -> Hogar; iniciar mes en la web; ver gasto en Personal e ingreso en Hogar (cambiar de finanza con Omero); marcar pagado en uno y ver el otro; con cuentas distintas ver la transferencia en las cuentas.
5. Aporte por % : cambiar el monto propuesto en el wizard y confirmar.
6. Pagar tarjeta con mínimo: Deudas muestra el saldo; cambiar el dólar y verificar que no varía.
7. Un movimiento con `refCode` visible en detalle (copiable).
8. Datos viejos (pre-migración) siguen mostrándose igual (sin vínculos, `MANUAL`).

---

## 7. Riesgos

- **Acoplamiento con S2:** `PlanAccountTransfer`, relaciones de `PlanAccount` y `AccountFinance` vienen de S2; verificar firmas reales al implementar y ajustar sin cambiar el comportamiento descrito.
- **`refCode`:** global único con 31^4 combinaciones (~923k); con reintento alcanza. Si la ocupación se acerca al 50%, subir a 5 caracteres (la búsqueda acepta 4–6).
- **`EntryLink` sin `currency` propia:** hereda la de los entries; si se habilitan vínculos entre monedas hará falta una columna aditiva.

## 8. Contrato hacia la siguiente semana (S4: Contactos y deudas)

**S3 deja listo**
- `EntryLink` con API y UI; S4 lo reutiliza sin cambios para cobros de préstamo si se quisiera vincular.
- `PlanEntry.source` con los cinco valores ya en el enum, y `refCode` asignado a todo movimiento (nuevo y viejo); S4 genera `source = LOAN_OUT` al prestar y lo muestra en "Otra finanza · monto · MOV-XXXX".
- `applyLinks` y `computeCarryOver` en `core.ts`, re-exportados a mobile.
- `FinanceCoverage` y la generación de pares con `linkId` / `syncCoveragePair` (patrón para movimientos espejo entre finanzas).
- `PlanCardStatement.carryOver` y `statementDebt` actualizado; Deudas ya lee la deuda explícita.
- `buildSummary` acepta `links` y expone `reimbursedArs`, `linkExcessArs`, `grossSpentArs`.

**S4 asume**
- Que `source = LOAN_OUT` ya existe en el enum y que `buildSummary` todavía **no** lo excluye del presupuesto: S4 agrega esa regla (una condición en `buildSummary`, con sus tests).
- Que `generateRefCode` / `assignRefCode` se usan en cualquier alta nueva de `PlanEntry` (incluidas las de préstamos con contraparte).
- Que `PlanLoan.contactId | counterpartyHouseholdId` y `Contact` los define S4; S3 no los toca.
- Que S5-6 usará `EntryLink` tipo `REIMBURSEMENT` y `source = GROUP_BACK` para los reintegros de grupo, con la tabla 6.1-B como comportamiento de referencia.

---

## 9. 💬 Preguntas para charlar

> Cómo usar esta sección: cada pregunta vive en **un solo spec** (el de menor número que la toca) aunque afecte a otros; las demás semanas la referencian por su código (`Q-Sx-n`). Respondé en la línea **Respuesta**. Al ejecutar un spec, todas las respuestas de esta sección y las de los specs anteriores forman parte de su contexto.

**Q-S3-1 · Vínculos entre períodos**
v1 los rechaza (un reintegro suele llegar el mes siguiente). Alternativas: contar el reintegro en el período del gasto (altera meses cerrados) o dejarlo como ingreso normal.
- Recomendación: v1 sin cross-período; revisar tras uso real.
- **Respuesta:** _(pendiente)_

**Q-S3-2 · Vínculos entre monedas (incluye pago de grupo en otra moneda, antes en S5-6)**
v1 los rechaza para no definir un tipo de cambio de vínculo. También impide que en grupos un pago en moneda distinta a la deuda se admita.
- Recomendación: rechazar en v1 en finanzas y grupos; permitir más adelante con la tasa del día.
- **Respuesta:** _(pendiente)_

**Q-S3-3 · Vínculos entre finanzas**
v1 solo misma finanza. S5-6 genera `GROUP_BACK` en la finanza de quien pagó, así que no lo necesita.
- Recomendación: mantener misma finanza.
- **Respuesta:** _(pendiente)_

**Q-S3-4 · Excedente de un ingreso vinculado**
El sobrante (`linkExcessArs`) cuenta como ingreso variable cobrado, sin categoría.
- Recomendación: aceptar lo simple; permitir categorizarlo después.
- **Respuesta:** _(pendiente)_

**Q-S3-5 · Base del `PERCENT` de los aportes**
Hoy: ingresos del mes de la finanza A sin aportes, ni por cobrar, ni la parte vinculada, calculada al generar. Alternativa: sobre el "Disponible".
- Recomendación: ingresos (más predecible).
- **Respuesta:** _(pendiente)_

**Q-S3-6 · Privacidad de nombres entre usuarios (incluye espejo de préstamos de S4 y contactos de S5-6)**
El gasto "Aporte a {B}" y el nombre del usuario en el ingreso de B exponen nombres entre miembros. Mismo tema: el espejo de un préstamo muestra el nombre del dueño (S4) y el teléfono/correo de un contacto solo lo ve su dueño (S5-6).
- Recomendación: una sola regla: se muestra el nombre del usuario cuando comparten una finanza o grupo; el teléfono/correo de un contacto solo lo ve quien lo creó.
- **Respuesta:** _(pendiente)_

**Q-S3-7 · Mover a finanza con vínculos o aportes (afecta a la acción de S1)**
Un entry `COVERAGE` no se puede mover; los que tienen `EntryLink` deberían moverse con su grupo o rechazarse.
- Recomendación: rechazar movimientos con vínculo o aporte y decir por qué; mover el grupo completo queda para después.
- **Respuesta:** _(pendiente)_

**Q-S3-8 · Inicio de mes solo en la web (afecta a la web y a mobile)**
Mobile hoy no inicia meses, así que la generación de aportes depende de iniciarlo en la web. Si B no inicia su mes, el ingreso espejo existe igual y mobile lo ve en la proyección.
- Recomendación: aceptar; evaluar "Iniciar mes" en mobile cuando se priorice.
- **Respuesta:** _(pendiente)_

