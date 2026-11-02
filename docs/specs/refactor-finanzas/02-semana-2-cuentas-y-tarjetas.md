# Semana 2 — Cuentas y tarjetas

Rama: `feat/finanzas-s2-cuentas-tarjetas` (PR hacia `develop`). Sigue `00-contrato.md`. Asume S1 completa: `Household.kind/ownerUserId/color`, `FinanceMember(userId, householdId, role)`, `canAccess(user, recurso, accion)` en `src/lib/plan/access.ts` y finanza activa por `x-finance-id` (en `withSession`, `ctx.householdId` = finanza activa y `ctx.userId` = usuario).

---

## 1. Objetivo y "Listo cuando"

**Objetivo.** Que toda plata se mueva por una **cuenta** del usuario y que las **tarjetas** pasen a ser del usuario (no del hogar), con cada compra asignada a una finanza y el pago del resumen repartido por finanza (opción A del artifact: la app reparte según la finanza de cada compra y cada parte sale de una cuenta de esa finanza).

**Listo cuando** (observable en el iPhone y en la web):

1. Cada gasto, ingreso, cuota de préstamo, fijo pagado y pago de resumen muestra **cuenta y finanza**.
2. Crear un gasto/ingreso sin elegir cuenta no es posible: el formulario sugiere la última cuenta usada en esa finanza.
3. Existe la pantalla **Cuentas** con saldo por cuenta; el saldo = saldo inicial + ingresos hechos − gastos hechos ± transferencias − pagos de resumen, y **cierra al centavo** con la suma de movimientos (test de integración).
4. Se puede **transferir** entre cuentas propias, **sacar efectivo** (cuenta → cuenta Efectivo) y **comprar dólares** (ARS → USD con tipo de cambio guardado).
5. Una tarjeta pertenece a un usuario y está relacionada con N finanzas. Al cargar una compra se elige finanza (default: la activa).
6. Al pagar un resumen de una tarjeta con compras de dos finanzas, la app propone el reparto, cada parte sale de una cuenta de su finanza, y el saldo de cada cuenta baja por su parte.
7. Tras el backfill, los datos existentes de Avelino y María siguen iguales: cada uno con su cuenta por defecto, todos los movimientos viejos con cuenta y las 6 tarjetas asignadas a su dueño.

## 2. Alcance / Fuera de alcance

**Dentro:** `PlanAccount`, `AccountFinance`, `PlanAccountTransfer`, `PlanEntry.accountId`, `Card.ownerUserId`, `CardFinance`, `PlanCardPurchase.householdId` (ya existe: pasa a ser la finanza elegida por compra, validada contra `CardFinance`), reparto del pago de resumen, backfill idempotente, cuenta en el flujo de Por confirmar (Apple Pay), cuenta en cuotas de préstamos, UI mobile y web de Cuentas y Tarjetas.

**Fuera (semanas siguientes):** `EntryLink` y ajuste de `buildSummary` (S3); `carryOver` / deuda explícita de tarjeta, aportes `FinanceCoverage`, `PlanEntry.source/linkId/refCode` (S3); contactos, `LOAN_OUT` y contraparte de préstamos (S4); grupos (S5-6); integración Mercado Pago; conciliación bancaria; layout de escritorio nuevo (spec Web, aquí solo se adaptan las pantallas web existentes).

## 3. Spec funcional

### 3.1 Historias de usuario

- Como usuario quiero crear mis cuentas (Banco, Mercado Pago, Efectivo, Dólares) y decir en qué finanzas se usan.
- Como usuario quiero que cada gasto/ingreso diga de qué cuenta salió/entró, sin pedirme esfuerzo extra (sugerencia de la última usada).
- Como usuario quiero transferir entre mis cuentas, sacar efectivo y comprar dólares y ver los saldos cerrar.
- Como usuario quiero ver en una cuenta compartida entre finanzas los movimientos de las otras finanzas (enmascarados si no soy miembro de esa finanza).
- Como usuario quiero que mi tarjeta sea mía y poder usarla para el Hogar o para lo personal, eligiendo la finanza en cada compra.
- Como usuario quiero pagar el resumen y que la app reparta el pago por finanza según las compras, y elegir de qué cuenta sale cada parte.
- Como María/Avelino quiero que al actualizar la app todo lo mío siga donde estaba.

### 3.2 Reglas de negocio

**Cuentas**

1. Una cuenta tiene **un dueño** (`ownerUserId`), una **moneda** (ARS | USD) y un **tipo** (`BANK | WALLET | CASH | OTHER`). La moneda no se cambia si la cuenta ya tiene movimientos.
2. Una cuenta se relaciona con 1..N finanzas vía `AccountFinance`. Debe tener al menos una. Solo el dueño administra la cuenta (editar, archivar, vincular finanzas); vincular exige además ser miembro con rol ADMIN o EDITOR de esa finanza.
3. Un movimiento (`PlanEntry`) en la finanza F con cuenta A exige: (a) el usuario tiene rol EDITOR o ADMIN en F; (b) existe `AccountFinance(A, F)`; (c) `entry.currency == account.currency`. El formulario solo ofrece cuentas que cumplen (b) y (c).
4. Quién puede **usar** una cuenta en una finanza compartida: cualquier EDITOR/ADMIN de esa finanza que vea la cuenta (la cuenta de María vinculada al Hogar la puede usar Avelino para cargar un gasto del Hogar). Quién puede **editar/archivar/transferir desde** la cuenta: solo el dueño.
5. **Saldo** de una cuenta (en su moneda) = `openingBalance` + Σ ingresos `isDone` − Σ gastos `isDone` (todas las finanzas) + transferencias entrantes (`amountTo`) − transferencias salientes (`amountFrom`) − pagos de resumen (`PlanCardPayment.amount`). Movimientos no hechos (`isDone=false`, fijos pendientes) no afectan el saldo. Compras con tarjeta **no** mueven plata (solo el pago del resumen).
6. `accountId` es obligatorio al crear un movimiento hecho y al pasar `isDone` a `true`. Los fijos/cuotas pendientes pueden tener `accountId = null` hasta pagarse (si el fijo tiene cuenta habitual, se hereda; ver 4.5).
7. Archivar una cuenta con saldo ≠ 0 pide confirmación; no se borra una cuenta con movimientos (409 "La cuenta tiene movimientos, archivala").
8. **Visibilidad cruzada:** el detalle de una cuenta muestra los movimientos de todas las finanzas vinculadas. Los de finanzas donde el usuario NO es miembro se devuelven enmascarados: `{ masked: true, amount, currency, date }` (en S3 se agrega `refCode` y se muestra "Otra finanza · monto · MOV-XXXX"; en S2 se muestra "Otra finanza · monto").

**Transferencias**

9. Transferir, sacar efectivo y comprar dólares son el mismo registro `PlanAccountTransfer`, con `kind`:
   - `TRANSFER`: misma moneda, `amountFrom == amountTo`.
   - `CASH_WITHDRAWAL`: cuenta origen → una cuenta `CASH` del usuario, misma moneda. Si el usuario no tiene cuenta CASH en esa moneda, se crea "Efectivo" (vinculada a las mismas finanzas que el origen) en la misma operación.
   - `BUY_USD`: origen ARS → destino USD; se informan `amountFrom` (ARS) y `amountTo` (USD) y se guarda `rate = amountFrom / amountTo` como `dollar_rate_snapshot` **inmutable**. Vender dólares (USD → ARS) usa el mismo `kind` con sentido inverso (`rate` = ARS por USD).
10. Ambas cuentas deben ser del usuario que transfiere. Transferir a cuenta de otro usuario no existe en S2 (los aportes entre finanzas llegan en S3). Origen ≠ destino.
11. Una transferencia no es ingreso ni gasto: no entra a `buildSummary`. Se puede borrar (deshace saldos); no se edita (borrar y crear).
12. Permitir saldo negativo: no se bloquea, se avisa ("La cuenta queda en negativo").

**Tarjetas**

13. `Card.ownerUserId` = usuario dueño. Solo el dueño edita/borra la tarjeta y vincula finanzas (`CardFinance`).
14. Una compra con tarjeta (`PlanCardPurchase`) lleva `householdId` = finanza elegida. Regla: existe `CardFinance(card, household)` y el usuario es EDITOR/ADMIN de esa finanza. Cualquier miembro EDITOR de la finanza puede **cargar** compras con tarjetas que el dueño vinculó a esa finanza (María carga una compra del Hogar con la Visa de Avelino).
15. Un resumen (`PlanCardStatement`, único por `cardId, period`) pertenece a la tarjeta y se carga por el dueño. Su `householdId` queda como la "finanza principal" del resumen (la finanza donde se creó); el reparto no depende de él salvo para el excedente (regla 17).
16. **Reparto por finanza (opción A).** `splitStatement(statement, purchases, usdRate)` calcula, por finanza, la suma de las cuotas (`installmentFor`) de las compras del período en ARS (USD convertido con `usdRate`). Se escala proporcionalmente al total a pagar del resumen (`statementToPay`: total / mínimo / custom) con redondeo de resto mayor (la suma de partes == monto a pagar, al centavo).
17. Si hay diferencia entre el total del resumen y la suma de cuotas cargadas (intereses, compras no cargadas), esa diferencia **proporcional** se reparte igual (regla 16). Si no hay ninguna compra cargada para el período, todo va a la finanza principal del resumen.
18. El usuario puede **editar** el reparto antes de confirmar (montos por finanza, suma obligatoria == monto a pagar) y elige, por parte, la **cuenta de pago**: debe estar vinculada a esa finanza (`AccountFinance`), tener la moneda ARS y no necesariamente ser del dueño de la tarjeta (el que paga es quien confirma; ver 3.3).
19. Confirmar el pago crea una fila `PlanCardPayment` por parte y pone `isPaid = true`, `paidAt = now`. Pago de USD (`usdAmount`): se paga desde una cuenta USD con una parte aparte (`currency = USD`) a la finanza principal; no se reparte (decisión D3).
20. Desmarcar el pago (`isPaid=false`) borra los `PlanCardPayment` del resumen y devuelve los saldos.
21. Las categorías de los movimientos de tarjeta no cambian: el gasto del mes de cada finanza sigue entrando por la categoría `TDC` con `toPayArs` calculado **solo con las compras de esa finanza** (cambio en `cardLines`, ver 4.7).

### 3.3 Casos borde

- **Moneda cruzada:** gasto en USD con cuenta ARS → 400 "La cuenta es en pesos".
- **Cuenta desvinculada de una finanza con movimientos:** no se puede quitar `AccountFinance(A, F)` si hay `PlanEntry` o `PlanCardPayment` de F en A (409). Se muestra la lista de qué lo impide.
- **Miembro removido de la finanza (S1):** los movimientos que cargó quedan; la cuenta sigue siendo de su dueño.
- **Reparto con una finanza sin cuenta vinculada usable:** el botón Confirmar queda deshabilitado y se muestra "Elegí una cuenta para {Finanza}".
- **Compra editada de finanza después de pagado el resumen:** 409 "El resumen ya está pagado, desmarcalo primero".
- **Tarjeta desvinculada de una finanza con compras:** 409 igual que cuentas.
- **Resumen con compras de finanzas donde el pagador no es miembro:** el pagador solo puede pagar las partes de finanzas donde es EDITOR/ADMIN; las demás las ve como "Otra finanza · monto" y las paga su dueño (queda el resumen "parcialmente pagado"; `isPaid` pasa a true recién cuando todas las partes están pagadas). Ver D2.
- **Cuenta archivada:** no aparece en selectores; los movimientos viejos la siguen mostrando.
- **Movimiento con `accountId` y mes no iniciado:** mantiene la regla actual `requireStartedMonth`.
- **Apple Pay / Por confirmar:** al confirmar se elige finanza y cuenta (default: finanza activa y última cuenta usada); si es compra con tarjeta, se elige finanza y no cuenta.

### 3.4 Textos de UI clave (es-AR)

- Menú: "Cuentas". Pantalla: "Mis cuentas", "Saldo total en pesos", "Saldo total en dólares".
- Formulario cuenta: "Nombre", "Tipo" (Banco, Billetera, Efectivo, Otra), "Moneda", "Saldo inicial", "¿Dónde la usás?" (chips de finanzas con su color).
- Gasto/ingreso: campo "Cuenta" ("Sale de" para gasto, "Entra a" para ingreso).
- Acciones: "Transferir", "Sacar efectivo", "Comprar dólares". Comprar dólares: "Pagás $ {x}", "Recibís US$ {y}", "Tipo de cambio $ {rate}".
- Aviso saldo: "Esta cuenta queda en negativo."
- Tarjeta: "¿Para qué finanza es esta compra?"; "Esta tarjeta la usás en: {chips}".
- Pago de resumen: "Pagar resumen", "Repartido por finanza", "{Finanza} · $ {monto}" con selector "Pagar desde", "Editar reparto", "Confirmar pago". Error: "El reparto tiene que sumar $ {total}."
- Movimiento enmascarado: "Otra finanza · $ {monto}".
- Bloqueos: "La cuenta tiene movimientos, archivala." / "Esta cuenta ya se usa en {Finanza}; no se puede desvincular."

## 4. Spec técnico

### 4.1 Cambios Prisma (`prisma/schema.prisma`)

```prisma
enum PlanAccountType {
  BANK
  WALLET
  CASH
  OTHER
}

enum PlanTransferKind {
  TRANSFER
  CASH_WITHDRAWAL
  BUY_USD
}

/// Cuenta del usuario (banco, billetera, efectivo). Se relaciona con N finanzas.
model PlanAccount {
  id             String          @id @default(cuid())
  ownerUserId    String
  name           String
  type           PlanAccountType @default(BANK)
  currency       Currency        @default(ARS)
  openingBalance Decimal         @default(0) @db.Decimal(14, 2)
  isArchived     Boolean         @default(false)
  sortOrder      Int             @default(0)
  createdAt      DateTime        @default(now())

  owner         User                 @relation("AccountOwner", fields: [ownerUserId], references: [id])
  finances      AccountFinance[]
  entries       PlanEntry[]
  transfersOut  PlanAccountTransfer[] @relation("TransferFrom")
  transfersIn   PlanAccountTransfer[] @relation("TransferTo")
  cardPayments  PlanCardPayment[]

  @@index([ownerUserId, isArchived])
}

/// Qué finanzas usan una cuenta.
model AccountFinance {
  id          String   @id @default(cuid())
  accountId   String
  householdId String
  createdAt   DateTime @default(now())

  account   PlanAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  household Household   @relation(fields: [householdId], references: [id], onDelete: Cascade)

  @@unique([accountId, householdId])
  @@index([householdId])
}

/// Movimiento de plata entre dos cuentas del mismo usuario. No es ingreso ni gasto.
model PlanAccountTransfer {
  id              String           @id @default(cuid())
  createdByUserId String
  kind            PlanTransferKind @default(TRANSFER)
  fromAccountId   String
  toAccountId     String
  /// Sale de la cuenta origen (moneda del origen).
  amountFrom      Decimal          @db.Decimal(14, 2)
  /// Entra a la cuenta destino (moneda del destino). Igual a amountFrom salvo BUY_USD.
  amountTo        Decimal          @db.Decimal(14, 2)
  /// dollar_rate_snapshot (ARS por USD). Solo en BUY_USD. Inmutable.
  rate            Decimal?         @db.Decimal(14, 4)
  date            DateTime         @db.Date
  note            String?
  createdAt       DateTime         @default(now())

  createdBy User        @relation("TransferCreator", fields: [createdByUserId], references: [id])
  from      PlanAccount @relation("TransferFrom", fields: [fromAccountId], references: [id])
  to        PlanAccount @relation("TransferTo", fields: [toAccountId], references: [id])

  @@index([fromAccountId, date])
  @@index([toAccountId, date])
}

/// Qué finanzas usan una tarjeta.
model CardFinance {
  id          String   @id @default(cuid())
  cardId      String
  householdId String
  createdAt   DateTime @default(now())

  card      Card      @relation(fields: [cardId], references: [id], onDelete: Cascade)
  household Household @relation(fields: [householdId], references: [id], onDelete: Cascade)

  @@unique([cardId, householdId])
  @@index([householdId])
}

/// Una parte del pago de un resumen: cuánto de una finanza sale de qué cuenta.
/// ENTIDAD PROPUESTA (no está en el contrato): ver D1.
model PlanCardPayment {
  id          String   @id @default(cuid())
  statementId String
  householdId String
  accountId   String
  currency    Currency @default(ARS)
  amount      Decimal  @db.Decimal(14, 2)
  paidByUserId String
  paidAt      DateTime @default(now())

  statement PlanCardStatement @relation(fields: [statementId], references: [id], onDelete: Cascade)
  household Household         @relation(fields: [householdId], references: [id])
  account   PlanAccount       @relation(fields: [accountId], references: [id])
  paidBy    User              @relation("CardPaymentUser", fields: [paidByUserId], references: [id])

  @@index([statementId])
  @@index([accountId])
}
```

Modificaciones a modelos existentes (todas aditivas):

```prisma
model PlanEntry {
  // ...campos actuales
  /// Cuenta por la que pasó la plata. Obligatoria en la API para movimientos hechos;
  /// null solo en pendientes (fijos/cuotas sin pagar).
  accountId String?
  account   PlanAccount? @relation(fields: [accountId], references: [id], onDelete: Restrict)
  @@index([accountId])
}

model Card {
  // ...campos actuales (householdId queda como finanza de origen, deprecado para accesos)
  ownerUserId String?          // nullable en DB; la API lo exige; el backfill lo completa
  owner       User?            @relation("CardOwner", fields: [ownerUserId], references: [id])
  finances    CardFinance[]
  @@index([ownerUserId])
}

model PlanCardStatement {
  // ...campos actuales (householdId = finanza principal del resumen)
  payments PlanCardPayment[]
}

model User {
  // ...campos actuales
  planAccounts      PlanAccount[]         @relation("AccountOwner")
  accountTransfers  PlanAccountTransfer[] @relation("TransferCreator")
  ownedCards        Card[]                @relation("CardOwner")
  cardPayments      PlanCardPayment[]     @relation("CardPaymentUser")
}

model Household {
  // ...campos actuales
  accountFinances AccountFinance[]
  cardFinances    CardFinance[]
  cardPayments    PlanCardPayment[]
}
```

`PlanCardPurchase.householdId` ya existe: no cambia el schema; cambia la semántica (finanza elegida) y la validación. Se agrega `@@index([householdId, period...])` no necesario.

### 4.2 Migración y backfill

- Migración única `prisma/migrations/2026110X120000_s2_accounts_and_cards/migration.sql`: crea enums y tablas nuevas, agrega columnas nullable `PlanEntry.accountId` y `Card.ownerUserId` con índices. **Aditiva, sin tocar datos.**
- Backfill idempotente en `prisma/backfill/s2-accounts-cards.ts` (ejecutable con `npx tsx prisma/backfill/s2-accounts-cards.ts`, `--dry-run` imprime conteos). Todo en una transacción por finanza, usando `upsert`/`where not exists` para poder correrlo N veces. Pasos:
  1. **Cuenta por defecto por usuario.** Para cada `User` sin ninguna `PlanAccount`: crear `"Cuenta principal"` (`type=BANK`, `currency=ARS`, `openingBalance=0`). Clave de idempotencia: `ownerUserId + name`.
  2. **Cuenta USD.** Para cada finanza (`Household`) que tenga algún `PlanEntry` en `USD` hecho: crear `"Dólares"` (`currency=USD`) para su dueño (`Household.ownerUserId`, definido en S1) si no existe.
  3. **Vínculo `AccountFinance`.** Cada cuenta por defecto se vincula con todas las finanzas donde su dueño es miembro (`FinanceMember`), en particular con su finanza PERSONAL y con las finanzas COMPARTIDAS donde aparece (Hogar, si S1 ya lo creó).
  4. **`PlanEntry.accountId`.** Para cada `PlanEntry` con `accountId IS NULL` y `isDone = true`: asignar la cuenta por defecto (ARS o USD según `currency`) del **dueño de la finanza** (`Household.ownerUserId`). Los pendientes (`isDone=false`) quedan en `null`. Razón: `PlanEntry` no registra quién lo cargó, el dueño de la finanza es la mejor aproximación y es reversible con "Mover a cuenta".
  5. **`Card.ownerUserId`.** Para cada `Card` con `ownerUserId IS NULL`: elegir dueño por este orden: (a) `ownerName` coincide (sin acentos, case-insensitive) con `User.name` o con su primer nombre dentro de la finanza de la tarjeta; (b) el nombre de la tarjeta contiene el primer nombre de un usuario ("VISA MARIA BBVA" → María; "MC AVELINO MP" → Avelino); (c) `Household.ownerUserId`. Se loguea qué regla aplicó cada tarjeta para revisión.
  6. **`CardFinance`.** Para cada tarjeta: vincular con `Card.householdId` (su finanza de origen) y con cualquier otra finanza que ya tenga compras de esa tarjeta (hoy ninguna; defensivo).
  7. **Verificación final** (aborta con exit code 1 si falla): `PlanEntry` hechos sin cuenta = 0; `Card` sin dueño = 0; toda `PlanAccount` con ≥1 `AccountFinance`; toda `Card` con ≥1 `CardFinance`.
- **Saldos iniciales:** `openingBalance = 0` en la cuenta por defecto (saldos reales los carga el usuario desde la pantalla Cuentas; la app muestra aviso "Cargá tu saldo inicial" mientras sea 0 y haya movimientos).
- **Pagos de resumen históricos:** los resúmenes con `isPaid=true` anteriores a S2 **no** generan `PlanCardPayment` (el backfill no inventa movimientos de plata); se tratan como "pagado antes de usar cuentas" y no afectan saldos (`payments` vacío con `isPaid=true` es válido).
- Orden de despliegue: migración → deploy backend (acepta `accountId` opcional durante la transición, flag `ACCOUNT_REQUIRED=false`) → backfill → activar `ACCOUNT_REQUIRED=true` → publicar app móvil (EAS). Así una app vieja no se rompe.

### 4.3 Helpers / libs (`src/lib/plan/*`)

- `access.ts` (de S1): se extiende `canAccess` con recursos `account` y `card`:
  - `canAccess(user, {type:"account", id}, "read")`: dueño o miembro de alguna finanza vinculada.
  - `"use"`: miembro EDITOR/ADMIN de una finanza vinculada (para cargar movimientos).
  - `"manage"`: dueño.
  - Ídem `card`: `read` (dueño o miembro de finanza vinculada), `use` (EDITOR/ADMIN de finanza vinculada), `manage` (dueño).
- `accounts.ts` (nuevo):
  - `accountBalance(account, entries, transfersIn, transfersOut, payments): number` — pura, testeable; usa `round2`.
  - `accountsForFinance(userId, householdId, currency?)` — cuentas usables en una finanza.
  - `requireAccountForEntry(ctx, accountId, entry:{householdId, currency})` — valida reglas 3.2.3 y lanza `ApiError` (400 `Elegí una cuenta`, 400 `La cuenta es en {moneda}`, 403 sin acceso).
  - `lastUsedAccountId(userId, householdId)` — para sugerir en UI (última `PlanEntry` hecha en esa finanza por el usuario; si no hay, la primera cuenta vinculada).
  - `maskEntryForNonMember(entry)` — devuelve `{ masked: true, amount, currency, date }`.
  - `buildTransfer(input)` — valida y normaliza por `kind` (`TRANSFER`, `CASH_WITHDRAWAL`, `BUY_USD`), calcula `rate`.
- `cards.ts` (existente, 14 líneas, hoy `cardFields`): se agregan
  - `requireOwnedCard(userId, cardId)` / `requireCardForFinance(userId, cardId, householdId)` (reemplaza a `requireCard(householdId, value)` en `server.ts`).
  - `splitStatement(statement, purchases, usdRate): StatementSplit[]` — `{ householdId, amountArs }[]` con redondeo de resto mayor (pura, en `core.ts` o en `cards.ts`; testeable).
  - `validateSplit(parts, toPay)` — suma exacta al centavo.
- `core.ts`: `cardLines(cards, statements, purchases, period, usdRate)` agrega parámetro opcional `householdId` para calcular `projectedArs`/`toPayArs` de una finanza usando solo las compras con `householdId` correspondiente y la parte proporcional del resumen (usa `splitStatement`). Tipos DTO nuevos: `AccountDTO`, `TransferDTO`, `StatementPaymentDTO`. `EntryDTO` suma `accountId: string | null`. `CardDTO` suma `ownerUserId: string | null`, `financeIds: string[]`. `PurchaseDTO` suma `householdId: string`.
- `server.ts`:
  - `loadPlan(householdId, period)` sigue por finanza activa; agrega `accounts` (usables en esa finanza, con saldo) y `cards` ahora por `CardFinance` (no `Card.householdId`), y `purchases` por `householdId` de la compra; `statements` de las tarjetas vinculadas a la finanza.
  - `loadCardStatements`: ídem por `CardFinance`.
  - Se elimina el uso de `requireCard(householdId, …)`.
- `loans.ts`: `createLoanEntry(tx, …)` y `addPastPayments(...)` reciben `accountId` (opcional en cuotas pendientes; obligatorio al pagar o al registrar pagos pasados).

### 4.4 Endpoints

Convención: `GET` lista, `POST` crea, `POST /:id` actualiza, `DELETE` borra, errores `{ error }`. Los endpoints existentes usan `PATCH /:id`; se **mantienen** (compatibilidad con la app publicada) y se **agrega alias `POST /:id`** en los que tocamos (`entries`, `card-statements`, `cards`). Todos pasan por `withSession` + `canAccess`; no se filtra a mano por `householdId`.

| Método y ruta | Body | Respuesta | Permisos |
|---|---|---|---|
| `GET /api/plan/accounts` | `?householdId=` opcional (default activa), `?includeArchived=1` | `{ accounts: AccountDTO[] }` con `balance`, `financeIds`, `isOwner` | `account:read` por cuenta |
| `POST /api/plan/accounts` | `{ name, type, currency, openingBalance, financeIds[] }` | `201 { id }` | usuario; EDITOR/ADMIN en cada `financeIds` |
| `POST /api/plan/accounts/[id]` | `{ name?, type?, openingBalance?, isArchived?, financeIds? }` | `{ ok: true }` / 409 si desvincula con movimientos | `account:manage` |
| `DELETE /api/plan/accounts/[id]` | — | `{ ok: true }` / 409 con movimientos | `account:manage` |
| `GET /api/plan/accounts/[id]/movements` | `?period=YYYY-MM` | `{ account, items: (EntryDTO + financeId | MaskedEntryDTO | TransferDTO | StatementPaymentDTO)[] }` | `account:read`; enmascara finanzas ajenas |
| `GET /api/plan/account-transfers` | `?accountId=` | `{ transfers: TransferDTO[] }` | `account:read` |
| `POST /api/plan/account-transfers` | `{ kind, fromAccountId, toAccountId, amountFrom, amountTo?, date, note? }` (`CASH_WITHDRAWAL` acepta `toAccountId` omitido: usa/crea Efectivo) | `201 { id, toAccountId }` | `account:manage` en ambas |
| `DELETE /api/plan/account-transfers/[id]` | — | `{ ok: true }` | `createdBy` o dueño de ambas |
| `POST /api/plan/entries` (modifica) | + `accountId` (obligatorio si `isDone`) | `201 { id }` | `finance:EDITOR` + `account:use` |
| `PATCH` y `POST /api/plan/entries/[id]` (modifica) | + `accountId`; `isDone=true` exige cuenta | `{ ok: true }` | ídem |
| `POST /api/plan/month` (modifica) | `entries[].accountId?` y `loans[].accountId?` opcionales | igual | ídem |
| `POST /api/plan/loans` y `/loans/[id]/past-payments` (modifica) | + `accountId` en pagos | igual | ídem |
| `GET /api/plan/cards` (nuevo GET) | — | `{ cards: CardDTO[] }` (propias + vinculadas a finanza activa) | `card:read` |
| `POST /api/plan/cards` (modifica) | `{ entity, cardType, ownerName, financeIds? }` (default: finanza activa) | `201 { id }`; `ownerUserId = ctx.userId`; crea `CardFinance` | EDITOR en cada finanza |
| `PATCH` y `POST /api/plan/cards/[id]` (modifica) | + `financeIds?` | `{ ok: true }` / 409 si desvincula finanza con compras | `card:manage` |
| `POST /api/plan/card-purchases` (modifica) | + `householdId?` (default activa) | `201 { id }` | `card:use` en esa finanza |
| `POST /api/plan/card-purchases/[id]` + `PATCH` (modifica) | `householdId?` re-asignar finanza | `{ ok: true }`; 409 si el resumen del período está pagado | `card:use` |
| `GET /api/plan/card-statements/[id]/split` (nuevo) | — | `{ toPay, currency, parts: [{ householdId, financeName, amount, suggestedAccountId, masked }] }` | `card:read` |
| `POST /api/plan/card-statements/[id]/pay` (nuevo) | `{ parts: [{ householdId, accountId, amount }], usdAccountId? }` | `{ ok: true, isPaid }` | EDITOR en cada finanza pagada + `account:use` |
| `POST /api/plan/card-statements/[id]/unpay` (nuevo) | — | `{ ok: true }` | `card:manage` o quien pagó |
| `PATCH` y `POST /api/plan/card-statements/[id]` (modifica) | `isPaid` directo deja de aceptarse con `ACCOUNT_REQUIRED=true` (400 "Pagá el resumen desde Pagar resumen") | — | — |
| `POST /api/plan/inbox/[id]/confirm` (modifica) | + `householdId?`, `accountId` (si no es tarjeta) | igual | EDITOR + `account:use` |

DTOs (en `core.ts`): `AccountDTO { id, name, type, currency, openingBalance, balance, financeIds, isOwner, isArchived }`, `TransferDTO { id, kind, fromAccountId, toAccountId, amountFrom, amountTo, rate, date, note }`, `StatementPaymentDTO { id, householdId, accountId, amount, currency, paidAt }`, `MaskedEntryDTO { masked: true, amount, currency, date }`.

### 4.5 Impacto en `buildSummary` y en el cálculo del mes

- `buildSummary` (en `mobile/src/data/budget.ts` y su par en `core.ts`/`budget-client.tsx`): **la fórmula no cambia** en S2 (los ajustes de `EntryLink`/`LOAN_OUT` son S3). Las transferencias y los pagos de resumen **no** son movimientos del mes: no suman ni restan.
- Único cambio: la línea de tarjetas del mes (`cardLines` → categoría `TDC`) se calcula con las compras y la parte del resumen **de la finanza activa** (4.3). Resultado esperado: si la Visa de Avelino tiene 80.000 del Hogar y 50.000 personales, Hogar ve TDC 80.000 y Personal ve 50.000.
- `cardDebts`/`cardsBalanceItem` (Patrimonio): la deuda de tarjeta se muestra por finanza con la misma proporción; sumada en todas las finanzas del dueño == deuda total del resumen.
- Fijos con cuenta habitual: `PlanRecurring` **no** cambia en S2 (no se agrega `accountId`); el sugerido sale de `lastUsedAccountId`. Decisión D4.

### 4.6 Pantallas y componentes

**Mobile (`mobile/app`, `mobile/src`)**

- Nueva ruta `mobile/app/cuentas/index.tsx` (lista, saldo total por moneda), `mobile/app/cuentas/nueva.tsx`, `mobile/app/cuentas/[id].tsx` (detalle + movimientos + acciones Transferir / Sacar efectivo / Comprar dólares), `mobile/app/cuentas/transferir.tsx`. Feature `mobile/src/features/accounts/` (`AccountsScreen`, `AccountDetailScreen`, `AccountForm`, `TransferScreen`, `AccountPicker`). Acceso desde `mobile/app/(tabs)/menu.tsx` → `mobile/src/features/menu/MenuScreen.tsx` ("Cuentas").
- `mobile/src/features/entry/EntryForm.tsx` y `NewEntryScreen.tsx` (rutas `mobile/app/gastos/nuevo.tsx`, `mobile/app/ingresos/nuevo.tsx`): agregan `AccountPicker` ("Sale de"/"Entra a"), con sugerencia `lastUsedAccountId` y chip de la finanza activa. Lo mismo en `mobile/src/features/movements/EditMovementScreen.tsx` (cambiar cuenta), `mobile/src/features/fixed/*` (al marcar pagado), `mobile/src/features/debts/*` (pagar cuota), `mobile/src/features/notifications/NotificationsScreen.tsx` (Por confirmar: finanza + cuenta).
- `mobile/src/features/cards/CardsScreen.tsx` (190 líneas): lista tarjetas propias y vinculadas; chips "usada en {finanzas}"; botón Pagar resumen abre hoja con reparto por finanza (partes editables, selector de cuenta por parte, total validado). Form de compra: selector de finanza.
- Capa de datos: `mobile/src/data/sources/api.ts` (hoy marca pagado con `PATCH …/card-statements/{id} { isPaid:true }` en línea 233 y entradas `isDone` en 240) → pasa a `POST …/pay`; `apiMappers.ts` y `types.ts` suman `Account`, `Transfer`, `accountId`, `householdId` en compra; `mock.ts` suma cuentas de ejemplo; `mobile/src/data/movements.ts` muestra "Cuenta · Finanza" por movimiento.
- Colores: chips de finanza usan `Household.color` (S1).

**Web (`src/app/plan`, `src/components/plan`)**

- `src/app/plan/mas/page.tsx`: nuevo ítem "Cuentas" → nueva `src/app/plan/cuentas/page.tsx` + `src/components/plan/accounts-client.tsx` (misma funcionalidad que mobile).
- `src/components/plan/entry-sheet.tsx` y `entries-client.tsx`: selector de cuenta.
- `src/components/plan/cards-client.tsx` (+ `src/app/plan/tarjetas/page.tsx`): dueño, finanzas, compra con finanza, hoja de pago repartido.
- `src/components/plan/inbox-client.tsx`: finanza + cuenta al confirmar.
- `src/components/plan/loans-client.tsx`: cuenta al pagar cuota.
- `src/lib/plan/export.ts`: columnas "Cuenta" y "Finanza" en la exportación.

### 4.7 Compatibilidad

- Datos: ningún valor existente se modifica salvo completar `accountId`/`ownerUserId`.
- API: `accountId` ausente se tolera mientras `ACCOUNT_REQUIRED=false`; con `true` responde 400 "Elegí una cuenta".

## 5. Plan de tareas

Leyenda: `[P]` = paralelizable con otras del mismo bloque.

**Bloque A — Base de datos (secuencial)**
1. Agregar enums y modelos Prisma (4.1) + migración SQL. *(sin deps)*
2. Script de backfill `prisma/backfill/s2-accounts-cards.ts` con `--dry-run` y verificación final. *(dep: 1)*
3. Correr migración y backfill sobre una copia de Neon; revisar el log de asignación de tarjetas. *(dep: 2)*

**Bloque B — Núcleo backend (tras 1)**
4. `access.ts`: recursos `account` y `card` en `canAccess` (+ tests). *(dep: S1)* [P]
5. `core.ts`: DTOs (`AccountDTO`, `TransferDTO`, `StatementPaymentDTO`, `MaskedEntryDTO`), `accountId` en `EntryDTO`, `ownerUserId/financeIds` en `CardDTO`, `householdId` en `PurchaseDTO`; `splitStatement`, `validateSplit`, `cardLines` con finanza. [P]
6. `accounts.ts`: `accountBalance`, `requireAccountForEntry`, `lastUsedAccountId`, `maskEntryForNonMember`, `buildTransfer`. *(dep: 4)*
7. `cards.ts`/`server.ts`: `requireCardForFinance`, `loadPlan` y `loadCardStatements` por `CardFinance`. *(dep: 4, 5)*

**Bloque C — Endpoints (tras B; entre sí [P])**
8. `accounts` (GET/POST/POST id/DELETE) + `accounts/[id]/movements`. *(dep: 6)* [P]
9. `account-transfers` (GET/POST/DELETE). *(dep: 6)* [P]
10. `entries` (POST, PATCH/POST id), `month`, `loans`, `inbox confirm`: `accountId` y `ACCOUNT_REQUIRED`. *(dep: 6)* [P]
11. `cards` (GET/POST/id) con dueño y `financeIds`; `card-purchases` con `householdId`. *(dep: 7)* [P]
12. `card-statements/[id]/split|pay|unpay` y bloqueo de `isPaid` directo. *(dep: 5, 6, 7)*

**Bloque D — Mobile y web (tras C; entre sí [P])**
13. Capa de datos mobile (`api.ts`, `apiMappers.ts`, `types.ts`, `mock.ts`). *(dep: 8-12)*
14. Pantallas Cuentas mobile (lista, detalle, nueva, transferir). *(dep: 13)* [P]
15. `AccountPicker` en gasto/ingreso/edición/fijo/deuda/Por confirmar. *(dep: 13)* [P]
16. `CardsScreen` con finanzas, compra con finanza y pago repartido. *(dep: 13)* [P]
17. Web: `accounts-client`, selector en `entry-sheet`, `cards-client`, `inbox-client`, `loans-client`, `export.ts`. *(dep: 8-12)* [P]

**Bloque E — Cierre**
18. Tests unitarios/integración (sección 6). *(en paralelo con C/D según cada pieza)* [P]
19. Despliegue escalonado: migración → backend con `ACCOUNT_REQUIRED=false` → backfill → `true` → build EAS. *(dep: 3, 17, 15)*
20. E2E manual en iPhone (sección 6.3). *(dep: 19)*

## 6. Tests

### 6.1 Unitarios (Jest, `src/lib/plan/`)

- `accounts.test.ts`: `accountBalance` (ingresos/gastos hechos, pendientes ignorados, transferencias, pagos de resumen, USD, redondeo); `buildTransfer` (los tres `kind`, `rate = amountFrom/amountTo`, rechazo misma cuenta, rechazo moneda distinta en `TRANSFER`); `requireAccountForEntry` (moneda, vínculo, rol); `maskEntryForNonMember` no filtra `name/note/categoryId`.
- `core.test.ts` (ampliar): `splitStatement` — suma exacta al centavo con 2 y 3 finanzas, tope con resto mayor, resumen sin compras cargadas (todo a la principal), pago MINIMUM/CUSTOM escala proporcional, USD convertido; `cardLines` por finanza (80.000 Hogar / 50.000 Personal).
- `access.test.ts`: `canAccess` para `account`/`card` (dueño, miembro de finanza vinculada, VIEWER no puede `use`, ajeno no lee).
- `backfill` (extraer lógica a función pura `assignCardOwner(card, users)`): "VISA MARIA BBVA"→María, "MC AVELINO MP"→Avelino, `ownerName` con acentos, empate→dueño de la finanza.
- Mobile (`mobile/src/data/__tests__/`): `apiMappers.test.ts` con `accountId`; nuevo `accounts.test.ts` para selectores de saldo total y sugerencia de cuenta.

### 6.2 Integración API

- Crear cuenta ARS vinculada a Personal y Hogar; cargar gasto Hogar con esa cuenta → saldo baja; cargar gasto USD → 400.
- Cuenta de María vinculada a Hogar: Avelino (EDITOR del Hogar) puede cargar un gasto con ella; VIEWER → 403; no miembro → 403.
- `GET accounts/[id]/movements` como no miembro de una de las finanzas: ese ítem viene `masked`, sin `name`.
- Transferencia, sacar efectivo (crea Efectivo si falta), comprar dólares (`rate` guardado y no cambia al editar el tipo de cambio del mes).
- Invariante de saldo: tras una secuencia aleatoria de operaciones, `balance == opening + Σ movimientos` consultando por la API de movimientos.
- Tarjeta: crear con `ownerUserId` correcto; compra con finanza no vinculada → 400; desvincular finanza con compras → 409.
- Pago de resumen: `split` devuelve partes que suman `toPay`; `pay` crea `PlanCardPayment`, baja saldos, `isPaid=true`; `unpay` los devuelve; partes que no suman → 400; cuenta no vinculada a la finanza → 400.
- Multi-tenancy: ningún endpoint devuelve cuentas/tarjetas de un usuario sin relación.
- Backfill: correrlo dos veces deja los mismos conteos (idempotente); verificación final en verde.

### 6.3 E2E manual en iPhone

1. Actualizar la app con la base ya migrada: Avelino y María ven sus datos intactos; cada uno tiene "Cuenta principal".
2. Cargar saldo inicial; cargar un gasto y un ingreso (la cuenta aparece sugerida); verificar saldo.
3. Crear cuenta "Mercado Pago" y "Efectivo"; sacar efectivo 20.000; comprar US$ 100 con un dólar de $1.200; revisar saldos y que el gasto del mes no cambió.
4. Vincular "Cuenta principal" al Hogar; con la sesión de María cargar un gasto del Hogar con esa cuenta; en Avelino ver el movimiento y, con una cuenta de María no vinculada a su finanza, ver "Otra finanza · monto".
5. Abrir Tarjetas: las 6 tarjetas están con su dueño correcto. Cargar una compra de 80.000 para el Hogar y otra de 50.000 personal con la Visa de Avelino.
6. Cargar el resumen (130.000), Pagar resumen: ver reparto 80.000/50.000, elegir cuentas, confirmar; revisar los dos saldos y Patrimonio. Desmarcar el pago y comprobar que los saldos vuelven.
7. Confirmar un pago de Apple Pay eligiendo finanza y cuenta.

## 7. Riesgos

- **R1 — Atribución de movimientos antiguos.** `PlanEntry` no tiene autor; el backfill asigna al dueño de la finanza. Con la regla de S1 (una personal tiene un solo usuario) los movimientos pasados del hogar actual quedan en la cuenta de Avelino; ver Q-S2-6.
- **R2 — Dependencia de S1.** Se asume `FinanceMember` poblado y `Household.ownerUserId` no nulo; el backfill falla (con mensaje) si no.
- **R3 — Ventana de compatibilidad.** App publicada vieja vs backend nuevo: cubierta con `ACCOUNT_REQUIRED` y los verbos vigentes de cada ruta (S1: se mantienen PATCH/PUT; lo nuevo POST/PATCH/DELETE). Ver Q-S2-7.
- **R4 — Rendimiento de saldos.** El saldo se calcula con agregados SQL (`groupBy` por `accountId`). Índice `PlanEntry(accountId)`; revisar `(accountId, isDone)`.

## 8. Contrato hacia la siguiente semana (S3)

**S2 deja listo:**
- `PlanAccount` + `AccountFinance`, `PlanEntry.accountId` obligatorio en la API para movimientos hechos, saldos correctos y backfill completo.
- `PlanAccountTransfer` operativo (transferir, efectivo, comprar dólares); S3 puede generar con él la transferencia de un **aporte entre finanzas** (cuenta A → cuenta B) o ninguna si es la misma cuenta.
- `Card.ownerUserId`, `CardFinance`, `PlanCardPurchase.householdId` con validación, `cardLines` por finanza, `PlanCardPayment` y `splitStatement`.
- `canAccess` con recursos `account` y `card`; `maskEntryForNonMember` listo para sumar `refCode`.
- Los resúmenes parcialmente pagados registran qué quedó sin pagar, base del `carryOver`.

**S3 asume:**
- Puede agregar `PlanEntry.source/linkId/refCode` (nullable, con default `MANUAL`) y completar el enmascarado "Otra finanza · monto · MOV-XXXX" usando `maskEntryForNonMember`.
- `EntryLink` se apoya en `PlanEntry.accountId` (el ingreso vinculado "entra a una cuenta") y en `AccountFinance` para validar.
- `PlanCardStatement.carryOver` se calcula a partir de `statementToPay` vs total y de `PlanCardPayment` (suma pagada por finanza); la deuda se reparte con la misma proporción de `splitStatement`.
- `buildSummary` hoy no considera transferencias ni pagos de resumen; S3 solo agrega las reglas de `EntryLink` (y `LOAN_OUT` en S4).
- Las transferencias entre cuentas de distintos usuarios (necesarias para aportes entre usuarios) **no** están permitidas en S2; S3 decide si las habilita para `FinanceCoverage` o si usa el mismo `PlanAccountTransfer` con ambas cuentas vinculadas a ambas finanzas.

---

## 9. 💬 Preguntas para charlar

> Cómo usar esta sección: cada pregunta vive en **un solo spec** (el de menor número que la toca) aunque afecte a otros; las demás semanas la referencian por su código (`Q-Sx-n`). Respondé en la línea **Respuesta**. Al ejecutar un spec, todas las respuestas de esta sección y las de los specs anteriores forman parte de su contexto.

**Q-S2-1 · Entidad fuera del contrato: `PlanCardPayment`**
Para repartir el pago del resumen por finanza y bajar el saldo de la cuenta correcta hace falta persistir cada parte (finanza, cuenta, monto). Descartado: un `PlanEntry` por parte (duplicaría el gasto TDC que ya sale de `cardLines`) o JSON en el resumen (no consultable).
- Recomendación: aprobar; si se rechaza cambia el cálculo de saldo y la tabla de 4.1.
- **Respuesta:** _(pendiente)_

**Q-S2-2 · Pago parcial por un no miembro**
Si quien paga no es miembro de todas las finanzas del resumen, queda "parcialmente pagado".
- Recomendación: `isPaid` recién cuando todas las partes tienen pago; la vista muestra el faltante.
- **Respuesta:** _(pendiente)_

**Q-S2-3 · Resumen en USD (`usdAmount`)**
No se reparte por finanza: se paga desde una cuenta USD y se asigna a la finanza principal del resumen.
- Recomendación: aceptar para v1.
- **Respuesta:** _(pendiente)_

**Q-S2-4 · Cuenta habitual por gasto fijo**
No se agrega `PlanRecurring.accountId` en S2 (no está en el contrato); se usa la última cuenta usada. Afecta también la generación de aportes y fijos al iniciar el mes (S3).
- Recomendación: mantener "última usada" en S2 y reevaluar en S3.
- **Respuesta:** _(pendiente)_

**Q-S2-5 · Cuentas compartidas: alcance de quien las usa sin ser dueño**
Regla ya definida en S1: si un usuario tiene acceso a alguna de las finanzas de la cuenta, puede registrar gasto o ingreso sobre ella. Falta: ¿puede ver el saldo total? ¿puede transferir desde ella a otra cuenta? ¿quién relaciona una cuenta con una finanza (`AccountFinance`)?
- Recomendación: ver saldo sí; transferir saliendo solo el dueño de la cuenta; relacionar solo el dueño y solo con finanzas donde es EDITOR+.
- **Respuesta:** _(pendiente)_

**Q-S2-6 · Movimientos antiguos del hogar actual**
Con S1 el hogar actual queda como personal de Avelino y Maria arranca con una personal vacía. Los movimientos que cargó Maria no tienen autor y quedan en la cuenta de Avelino.
- Recomendación: mover con "Mover a finanza" al Hogar y usar "Cambiar cuenta" masivo; no inferir autoría.
- **Respuesta:** _(pendiente)_

**Q-S2-7 · Cuándo se activa `ACCOUNT_REQUIRED`**
Con la bandera apagada, una app vieja puede crear movimientos sin cuenta; prendida, los rechaza.
- Recomendación: prenderla cuando la versión mobile con cuentas esté publicada y el backfill se repita una vez.
- **Respuesta:** _(pendiente)_

