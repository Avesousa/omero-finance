# Semanas 5 y 6 — Grupos de gastos

Contrato: `docs/specs/refactor-finanzas/00-contrato.md`. Diseño: artifact `EKRHHmwFTNEZMeHJq3RU4y` (secciones "Grupo: la cena de 90.000" e "Ingreso vinculado a gasto").
Ramas: `feat/finanzas-s5-grupos-modelo` (Semana 5) y `feat/finanzas-s6-grupos-pagos` (Semana 6), PR hacia `develop`.

## Supuestos sobre S1-S4 (ya completas)

No existen aún los specs 01-04 en el repo; este documento se apoya solo en las entidades fijadas por el contrato. Nombres de helpers marcados con (*) son suposiciones a validar contra el código real de S1-S4 antes de empezar.

- S1: `canAccess(user, recurso, accion)` en `src/lib/plan/access.ts`; `withSession` (`src/lib/plan/server.ts`) entrega `ctx` con `financeId` (finanza activa, header `x-finance-id`), `userId` y rol.
- S2: `PlanAccount(ownerUserId)`, `AccountFinance`, `PlanEntry.accountId` obligatorio; helper para validar que una cuenta es del usuario y está vinculada a la finanza (*`assertAccountUsable`).
- S3: `EntryLink` con al menos `incomeEntryId`, `expenseEntryId`, `amount`, `type (REIMBURSEMENT|BUSINESS)` (*nombres de campos); `PlanEntry.source` ya incluye `GROUP` y `GROUP_BACK`; `PlanEntry.refCode` con generador (*`generateRefCode`); `buildSummary` ya resta ingresos vinculados del gasto (neto = gasto − vinculados, mínimo 0, excedente = ingreso).
- S4: `Contact(ownerUserId, name, phone, email, linkedUserId)` e `Invite` (estado, guardada sin enviar); al registrarse un usuario, el hook de registro enlaza `Contact.linkedUserId` por teléfono/correo (*`src/lib/plan/contacts.ts`).

Si alguno de estos supuestos no se cumple, se registra como desvío en el PR, no se inventa una entidad nueva.

---

## 1. Objetivo y "Listo cuando"

**Objetivo.** Gastos compartidos entre 2 o más personas (usuarios o contactos sin registrar), con reparto, saldos "quién le debe a quién", pagos entre miembros y reintegros que se reflejan en la finanza de cada uno sin inflar ingresos.

**Semana 5 — Listo cuando:** en el iPhone creás el grupo "Viaje" con Lucía (usuaria) y Juan (contacto sin registrar), cargás la cena de 90.000 pagada desde tu cuenta Banco con reparto 30.000 / 30.000 / 30.000 (o en %), y el grupo muestra "Lucía te debe 30.000" y "Juan te debe 30.000". En tu finanza activa aparece un gasto de 90.000 (source `GROUP`) en la cuenta Banco, y el saldo de la cuenta baja 90.000. Editar el reparto recalcula saldos; un reparto que no suma el total es rechazado.

**Semana 6 — Listo cuando:** Lucía registra "Pagué 30.000" desde su cuenta, vos confirmás a qué cuenta entró, y Juan queda "pagado a mano" por vos. Tu gasto de la cena queda en **30.000 netos** en el presupuesto (90.000 − 2 reintegros vinculados), el grupo muestra saldos en 0, Lucía tiene su gasto de 30.000 en su finanza, y tus Ingresos del mes no subieron. Si Juan se registra después, al entrar encuentra el grupo, su parte y su pago ya hecho.

## 2. Alcance / Fuera de alcance

**Alcance**
- Grupos, miembros (usuario o contacto), roles ADMIN/EDITOR/VIEWER.
- Gasto de grupo pagado desde una cuenta, reparto IGUAL, en % o en montos que suman el total.
- Saldos por par de miembros y por moneda.
- Pagos entre miembros (desde la app, con confirmación del receptor) y "marcar pagado a mano".
- Reintegro vinculado vía `EntryLink` (tipo `REIMBURSEMENT`), gasto en la finanza de quien pagó.
- Enlace automático de Juan al registrarse.
- Pantallas mobile completas; web mínima de lectura.

**Fuera de alcance**
- Envío de invitaciones por correo/SMS (etapa siguiente; solo se guarda `Invite`, como en S4).
- Ver el grupo sin registrarse por link.
- Simplificación de deudas entre 3+ personas (A→B→C); los saldos son por par. Ver decisión abierta 1.
- Conversión entre monedas dentro de un grupo; saldos separados por moneda.
- Retroactivo de entries para Juan (su parte "pagada a mano" no genera gasto en su finanza al registrarse). Ver decisión abierta 2.
- Layout de escritorio completo (spec Web).
- Mercado Pago.

## 3. Spec funcional

### 3.1 Historias de usuario

1. Como usuario creo un grupo, agrego miembros desde mis contactos (S4), por teléfono/correo, o usuarios existentes.
2. Como miembro con rol EDITOR+ cargo un gasto que pagué: monto, moneda, cuenta de la que salió, finanza donde se registra mi gasto, categoría, fecha y reparto.
3. Veo en el grupo quién le debe a quién, y cuánto me deben / debo en total.
4. Como deudor registro "Pagué" a un miembro, eligiendo mi cuenta y mi finanza; mi gasto real se crea en mi finanza.
5. Como acreedor confirmo el pago eligiendo la cuenta donde entró; se crea el ingreso vinculado a mi gasto.
6. Como acreedor marco a un miembro (típicamente un contacto sin registrar) como pagado a mano, eligiendo la cuenta donde recibí la plata.
7. Como Juan sin registrar, al registrarme encuentro el grupo, mi parte y lo que ya figura pagado.
8. Como miembro de otra finanza, el gasto de grupo de otro no me revela detalle fuera del grupo (regla 5 del contrato).

### 3.2 Reglas de negocio

**Miembros**
- Un `GroupMember` es un usuario **o** un contacto (nunca ambos nulos). Un contacto vinculado (`Contact.linkedUserId` no nulo) se resuelve como usuario al leer y la migración de enlace lo convierte en `userId`.
- El creador es ADMIN. ADMIN invita/saca miembros y cambia roles; EDITOR carga gastos y pagos; VIEWER solo ve.
- No se puede quitar un miembro con saldo distinto de 0 ni con participación en gastos con deuda viva (409). Sí se puede si todo está saldado (queda histórico, `leftAt`).
- Un grupo requiere mínimo 2 miembros activos para cargar el primer gasto.

**Gasto**
- Pagador: el propio usuario, o un contacto sin registrar (solo si quien carga es ADMIN). **Nunca** otro usuario registrado: crearía un movimiento en su finanza sin su consentimiento.
- Si el pagador es usuario: `accountId` obligatorio (cuenta suya, vinculada a la `financeId` elegida, validada con `canAccess`) y se crea un `PlanEntry` EXPENSE `source=GROUP` por el **total** en esa finanza. Si el pagador es un contacto: no se crea entry (la plata no pasó por nadie de la app).
- Modos de reparto (`splitMode`):
  - `EQUAL`: total / participantes, centavos al azar determinista (mayor resto, orden por id de miembro).
  - `PERCENT`: porcentajes con 2 decimales, suman exactamente 100.00; montos por mayor resto.
  - `AMOUNT`: montos explícitos que suman **exactamente** el total (2 decimales). Si no suma: 400 "El reparto debe sumar el total".
- Siempre se guarda una fila de share por participante, incluido el pagador (si participa). La parte del pagador nace saldada (`settledAmount = amount`).
- Moneda por gasto (ARS/USD) con `dollarRateSnapshot` inmutable (regla 6).
- El gasto cae en el período de su fecha: si el mes de esa finanza no está iniciado, 409 "El mes no está iniciado" (mismo aviso que ya usa mobile, ver `requireStartedMonth` en `src/lib/plan/server.ts`).
- Editar un gasto (monto, reparto, cuenta): permitido a quien lo cargó o ADMIN **solo si ninguno de sus shares tiene `settledAmount > 0` por pagos de otros**; si no, 409 "Ya hay pagos registrados sobre este gasto. Cancelá los pagos primero". Eliminar sigue la misma regla (soft delete `deletedAt`, borra el entry).
- El `PlanEntry` generado no se edita ni se borra desde `/api/plan/entries`: monto, cuenta, finanza y borrado devuelven 409 "Este movimiento pertenece a un grupo"; categoría, nota y nombre sí se pueden cambiar.

**Saldos**
- `pendiente(share) = share.amount − share.settledAmount`.
- Deuda bruta de X hacia Y = suma de `pendiente` de los shares de X en gastos pagados por Y.
- Deuda neta del par = bruta(X→Y) − bruta(Y→X). Se muestra solo la dirección positiva: "X le debe a Y".
- Por moneda; nunca se mezclan ARS y USD.
- Los pagos PENDING no afectan saldos; se muestran aparte como "En revisión".

**Pagos (GroupSettlement)**
- Monto > 0, moneda igual a la del saldo, **no mayor a la deuda neta del par** en esa moneda (si excede: 400 "El pago supera lo que se debe").
- `APP`: lo crea el deudor. Estado `PENDING`. Crea ya el gasto real del deudor en su finanza (`source=GROUP`, cuenta suya) — esa plata salió. El receptor lo ve en su bandeja del grupo y lo confirma eligiendo cuenta y finanza → `CONFIRMED`: crea ingreso `source=GROUP_BACK` y los `EntryLink`.
- `MANUAL` ("marcar pagado a mano"): lo crea el acreedor para cualquier deudor (registrado o contacto). Nace `CONFIRMED` con la cuenta de recepción elegida; no crea entry del deudor.
- Si el receptor es un contacto sin registrar (pagó él el gasto) no hay confirmación posible: solo un ADMIN puede registrar `MANUAL` con `toAccountId` nulo y sin entries (ninguna cuenta de la app recibió plata); solo suma `settledAmount`.
- Rechazo: el receptor puede rechazar un `APP` → `REJECTED`; se elimina el gasto del deudor y no cambian saldos.
- Cancelar un pago `CONFIRMED` (ADMIN o quien lo creó): revierte `settledAmount`, borra ingreso, links y gasto del deudor generados, y queda `CANCELLED`.
- **Asignación a gastos**: al confirmar, el monto se reparte FIFO por fecha sobre los shares del deudor en gastos pagados por el receptor con `pendiente > 0`. Cada asignación = un `EntryLink(REIMBURSEMENT)` desde el ingreso hacia el `PlanEntry` de ese gasto y suma a `share.settledAmount`. Si el gasto fue pagado por un contacto no hay entry, solo se suma `settledAmount`.
- Efecto en presupuesto: el ingreso `GROUP_BACK` no suma a Ingresos; resta del gasto vinculado (S3). Resultado de la cena: 90.000 − 30.000 − 30.000 = 30.000 neto.

**Juan sin registrar**
- Es un `Contact` del creador del grupo + `GroupMember.contactId`. Todos los miembros ven su nombre (no su teléfono/correo, que solo ve el dueño del contacto).
- Cuando Juan se registra, el hook de S4 completa `Contact.linkedUserId`; este spec agrega `linkGroupMembersForContact(contactIds, userId)` que setea `GroupMember.userId`. Shares y settlements referencian `GroupMember.id`, así que no se reescribe ningún dato histórico.
- Si Juan ya era miembro como usuario (doble alta): se fusiona, los shares/settlements del miembro-contacto pasan al miembro-usuario (`mergeMembers`), en transacción.

### 3.3 Casos borde

| Caso | Comportamiento |
|---|---|
| Reparto con centavos (100,00 / 3) | 33,34 / 33,33 / 33,33 por mayor resto; suma exacta |
| Participante único (solo el pagador) | 400 "Elegí al menos otra persona" |
| Pagador no participa del reparto | Permitido (le deben todo); su share no existe |
| Gasto en USD, miembro cobra en ARS | Fuera de alcance: el pago es en USD; la cuenta receptora debe ser USD (o se valida moneda) |
| Pago mayor a la deuda | 400 |
| Dos pagos PENDING simultáneos sobre la misma deuda | Cada uno valida contra deuda neta menos PENDING del mismo par; el segundo falla si excede |
| Mes no iniciado en finanza del pagador/receptor | 409 con el aviso existente |
| Miembro con rol VIEWER intenta cargar | 403 |
| Quitar miembro con deuda | 409 |
| Cuenta no vinculada a la finanza elegida | 400 (regla S2) |
| Usuario sale de una finanza que contiene entries GROUP | Los entries quedan; el grupo sigue funcionando (GroupExpense.entryId no cambia) |
| Grupo archivado | Solo lectura; saldos visibles |

### 3.4 Textos de UI clave

- Lista: "Grupos", vacío "Todavía no tenés grupos. Creá uno para dividir gastos".
- Saldo: "Lucía te debe $ 30.000", "Le debés $ 30.000 a Avelino", "Todo saldado".
- Carga: "¿Quién pagó?", "¿De qué cuenta salió?", "¿Cómo se reparte?" (Partes iguales / Porcentajes / Montos), error "El reparto debe sumar $ 90.000 (faltan $ 5.000)".
- Pago: "Pagué", "Confirmar pago", "Te pagaron $ 30.000. ¿A qué cuenta entró?", estado "En revisión".
- Manual: "Marcar pagado a mano", confirmación "Juan no usa Omero. Vas a registrar que te pagó $ 30.000 en [cuenta]".
- Aviso en el gasto: "Tu gasto real: $ 30.000 · Pagaste $ 90.000, te devolvieron $ 60.000".
- Juan: chip "Sin registrar" junto al nombre.
- Movimiento GROUP en la finanza: chip "Grupo · Viaje".

## 4. Spec técnico

### 4.1 Prisma

Se agregan en `prisma/schema.prisma` (después de los modelos Plan). Solo aditivo.

```prisma
enum GroupRole {
  ADMIN
  EDITOR
  VIEWER
}

enum GroupSplitMode {
  EQUAL
  PERCENT
  AMOUNT
}

enum GroupSettlementMethod {
  APP
  MANUAL
}

enum GroupSettlementStatus {
  PENDING
  CONFIRMED
  REJECTED
  CANCELLED
}

model Group {
  id          String    @id @default(cuid())
  name        String
  ownerUserId String
  /// Moneda sugerida; cada gasto guarda la suya.
  currency    Currency  @default(ARS)
  archivedAt  DateTime?
  createdAt   DateTime  @default(now())

  owner       User              @relation("GroupOwner", fields: [ownerUserId], references: [id])
  members     GroupMember[]
  expenses    GroupExpense[]
  settlements GroupSettlement[]

  @@index([ownerUserId])
}

model GroupMember {
  id        String    @id @default(cuid())
  groupId   String
  /// Usuario registrado. Se completa al enlazar el contacto (Juan se registra).
  userId    String?
  /// Contacto del creador (sin registrar). Se conserva tras el enlace por trazabilidad.
  contactId String?
  role      GroupRole @default(EDITOR)
  joinedAt  DateTime  @default(now())
  leftAt    DateTime?

  group      Group                 @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user       User?                 @relation("GroupMemberUser", fields: [userId], references: [id])
  contact    Contact?              @relation(fields: [contactId], references: [id])
  paid       GroupExpense[]        @relation("GroupExpensePayer")
  shares     GroupExpenseShare[]
  sent       GroupSettlement[]     @relation("SettlementFrom")
  received   GroupSettlement[]     @relation("SettlementTo")

  @@unique([groupId, userId])
  @@unique([groupId, contactId])
  @@index([userId])
  @@index([contactId])
}

model GroupExpense {
  id                 String         @id @default(cuid())
  groupId            String
  paidByMemberId     String
  createdByUserId    String
  description        String
  currency           Currency       @default(ARS)
  total              Decimal        @db.Decimal(14, 2)
  dollarRateSnapshot Decimal?       @db.Decimal(14, 4)
  splitMode          GroupSplitMode
  date               DateTime       @db.Date
  /// Solo si pagó un usuario: cuenta de origen y finanza donde se registró su gasto.
  accountId          String?
  householdId        String?
  categoryId         String?
  /// PlanEntry EXPENSE source GROUP del pagador (null si pagó un contacto).
  entryId            String?        @unique
  deletedAt          DateTime?
  createdAt          DateTime       @default(now())

  group     Group               @relation(fields: [groupId], references: [id], onDelete: Cascade)
  paidBy    GroupMember         @relation("GroupExpensePayer", fields: [paidByMemberId], references: [id])
  account   PlanAccount?        @relation(fields: [accountId], references: [id], onDelete: SetNull)
  household Household?          @relation(fields: [householdId], references: [id], onDelete: SetNull)
  entry     PlanEntry?          @relation("GroupExpenseEntry", fields: [entryId], references: [id], onDelete: SetNull)
  shares    GroupExpenseShare[]

  @@index([groupId, date])
}

model GroupExpenseShare {
  id             String   @id @default(cuid())
  expenseId      String
  memberId       String
  /// Solo en splitMode PERCENT.
  percent        Decimal? @db.Decimal(5, 2)
  amount         Decimal  @db.Decimal(14, 2)
  /// Lo ya saldado por pagos confirmados (la parte del pagador nace igual a `amount`).
  settledAmount  Decimal  @default(0) @db.Decimal(14, 2)

  expense GroupExpense @relation(fields: [expenseId], references: [id], onDelete: Cascade)
  member  GroupMember  @relation(fields: [memberId], references: [id])

  @@unique([expenseId, memberId])
  @@index([memberId])
}

model GroupSettlement {
  id               String                @id @default(cuid())
  groupId          String
  fromMemberId     String
  toMemberId       String
  currency         Currency              @default(ARS)
  amount           Decimal               @db.Decimal(14, 2)
  dollarRateSnapshot Decimal?            @db.Decimal(14, 4)
  method           GroupSettlementMethod
  status           GroupSettlementStatus @default(PENDING)
  date             DateTime              @db.Date
  createdByUserId  String
  /// Cuenta/finanza del deudor (solo APP con deudor usuario).
  fromAccountId    String?
  fromHouseholdId  String?
  /// Cuenta/finanza del receptor al confirmar o marcar a mano.
  toAccountId      String?
  toHouseholdId    String?
  /// Gasto real del deudor (source GROUP) e ingreso del receptor (source GROUP_BACK).
  payerEntryId     String?   @unique
  receiverEntryId  String?   @unique
  note             String?
  confirmedAt      DateTime?
  createdAt        DateTime  @default(now())

  group      Group       @relation(fields: [groupId], references: [id], onDelete: Cascade)
  from       GroupMember @relation("SettlementFrom", fields: [fromMemberId], references: [id])
  to         GroupMember @relation("SettlementTo", fields: [toMemberId], references: [id])
  payerEntry    PlanEntry? @relation("SettlementPayerEntry", fields: [payerEntryId], references: [id], onDelete: SetNull)
  receiverEntry PlanEntry? @relation("SettlementReceiverEntry", fields: [receiverEntryId], references: [id], onDelete: SetNull)

  @@index([groupId, status])
}
```

Back-relations a agregar (solo líneas de relación, sin columnas nuevas): `User` (`groupsOwned Group[] @relation("GroupOwner")`, `groupMemberships GroupMember[] @relation("GroupMemberUser")`), `Contact.groupMemberships`, `PlanAccount.groupExpenses`, `Household.groupExpenses`, `PlanEntry` (`groupExpense GroupExpense? @relation("GroupExpenseEntry")`, `settlementAsPayer`, `settlementAsReceiver`). Las relaciones en `PlanEntry` no agregan columnas, por lo que la tabla de movimientos no cambia.

Constraint no expresable en Prisma, agregado en el SQL de la migración: `CHECK ("userId" IS NOT NULL OR "contactId" IS NOT NULL)` sobre `GroupMember`, y `CHECK ("fromMemberId" <> "toMemberId")` sobre `GroupSettlement`.

### 4.2 Migraciones y backfill

- **Semana 5**: `prisma/migrations/<fecha>_groups_model/` — enums `GroupRole`, `GroupSplitMode`, tablas `Group`, `GroupMember`, `GroupExpense`, `GroupExpenseShare` y el CHECK de miembros.
- **Semana 6**: `prisma/migrations/<fecha>_groups_settlements/` — enums de settlement, tabla `GroupSettlement` y su CHECK. (Una migración por semana, principio 8.)
- Sin cambios de datos viejos. Backfill idempotente `scripts/backfill-group-members.ts` (S6): para cada `GroupMember` con `contactId` cuyo `Contact.linkedUserId` no es nulo y `userId` nulo, ejecuta `linkGroupMembersForContact`. Correr varias veces no cambia nada. Se ejecuta una vez tras desplegar S6 (cubre contactos que se vincularon durante S5).

### 4.3 Libs (`src/lib/plan`)

| Archivo | Contenido | Semana |
|---|---|---|
| `group-split.ts` | Puro: `computeShares({mode, total, participants, percents?, amounts?}) → {memberId, percent?, amount}[]`; mayor resto; valida suma exacta; trabaja en centavos enteros | S5 |
| `group-balance.ts` | Puro: `pairBalances(expenses, shares) → {fromMemberId, toMemberId, currency, amount}[]`; `memberNet(memberId, balances)` | S5 |
| `groups.ts` | Acceso y CRUD: `loadGroupFor(user, groupId)`, `assertGroupRole(...)`, `createGroup`, `addMember` (resuelve userId/contactId/nuevo contacto), `removeMember`, `loadGroupDetail` | S5 |
| `group-expenses.ts` | `createGroupExpense`, `updateGroupExpense`, `deleteGroupExpense`; crea/actualiza el `PlanEntry` `source=GROUP` en transacción con `refCode` | S5 |
| `group-settle.ts` | Puro: `allocateSettlement(shares, amount) → {shareId, amount}[]` FIFO por fecha. Con efectos: `createSettlement`, `confirmSettlement`, `rejectSettlement`, `cancelSettlement`, `markPaidManual` | S6 |
| `group-link.ts` | `linkGroupMembersForContact(contactIds, userId)`, `mergeMembers(from, to)`; llamado desde el hook de registro de S4 | S6 |
| `core.ts` (tipos) | Se agregan `GroupDTO`, `GroupMemberDTO`, `GroupExpenseDTO`, `GroupBalanceDTO`, `GroupSettlementDTO` | S5 |

`canAccess` (`src/lib/plan/access.ts`): se extiende con el recurso `group` y acciones `read | write | admin`. `read` = miembro activo; `write` = EDITOR/ADMIN; `admin` = ADMIN. Ningún endpoint de grupos consulta `GroupMember` a mano.

Regla de entries: toda creación de entry reutiliza los helpers de S2/S3 (`accountId`, `refCode`, snapshot de dólar vía `usdRateFor`, `requireStartedMonth` en `src/lib/plan/server.ts`).

### 4.4 Endpoints

Todos bajo `src/app/api/plan/groups/…`, con `withSession` (`src/lib/plan/server.ts`) y `canAccess`. Errores `{ error }`. Actualizar = `POST /:id`.

| Método y ruta | Body | Respuesta | Permiso | Sem. |
|---|---|---|---|---|
| `GET /api/plan/groups` | — | `{ groups: [{id, name, membersCount, myNet: [{currency, amount}], archived}] }` | usuario (sus grupos) | S5 |
| `POST /api/plan/groups` | `{ name, currency?, members: [{userId} \| {contactId} \| {name, phone?, email?}] }` | 201 `{ id }` | usuario | S5 |
| `GET /api/plan/groups/[id]` | — | `{ group, members[], balances[], expenses[], settlements[] }` | group:read | S5 |
| `POST /api/plan/groups/[id]` | `{ name?, archived? }` | `{ ok: true }` | group:admin | S5 |
| `DELETE /api/plan/groups/[id]` | — | 204; 409 si hay gastos con deuda o pagos confirmados (sugerir archivar) | group:admin | S5 |
| `POST /api/plan/groups/[id]/members` | `{ userId \| contactId \| {name, phone?, email?}, role? }` | 201 `{ memberId }` | group:admin | S5 |
| `POST /api/plan/groups/[id]/members/[memberId]` | `{ role }` | `{ ok }` | group:admin | S5 |
| `DELETE /api/plan/groups/[id]/members/[memberId]` | — | 204; 409 si hay saldo | group:admin (o uno mismo) | S5 |
| `GET /api/plan/groups/[id]/expenses` | `?cursor` | `{ expenses[] }` | group:read | S5 |
| `POST /api/plan/groups/[id]/expenses` | `{ description, total, currency, date, paidByMemberId, accountId?, financeId?, categoryId?, splitMode, participants: [{memberId, percent? \| amount?}] }` | 201 `{ id, entryId, shares[] }`; 400 reparto inválido; 409 mes no iniciado | group:write (+ `canAccess` de la cuenta y finanza) | S5 |
| `POST /api/plan/groups/[id]/expenses/[eid]` | mismos campos, parciales | `{ ok, shares[] }`; 409 con pagos | creador o group:admin | S5 |
| `DELETE /api/plan/groups/[id]/expenses/[eid]` | — | 204; 409 con pagos | creador o group:admin | S5 |
| `GET /api/plan/groups/[id]/balances` | — | `{ pairs: [{from, to, currency, amount}], me: [{currency, owed, owing}], pending: [...] }` | group:read | S5 |
| `GET /api/plan/groups/[id]/settlements` | — | `{ settlements[] }` | group:read | S6 |
| `POST /api/plan/groups/[id]/settlements` | `{ method: "APP", toMemberId, amount, currency, date, fromAccountId, financeId, categoryId? }` o `{ method: "MANUAL", fromMemberId, amount, currency, date, toAccountId, financeId }` | 201 `{ id, status }`; 400 excede deuda | APP: group:write y soy el deudor; MANUAL: group:write y soy el acreedor | S6 |
| `POST /api/plan/groups/[id]/settlements/[sid]` | `{ action: "confirm", toAccountId, financeId }` o `{ action: "reject" }` | `{ ok, links[] }` | solo el receptor | S6 |
| `DELETE /api/plan/groups/[id]/settlements/[sid]` | — | 204 (cancela y revierte) | creador, receptor o group:admin | S6 |

Detalle de transacciones (Prisma `$transaction`):
- `createGroupExpense`: valida → `computeShares` → crea `PlanEntry` (si hay entry) → crea `GroupExpense` + shares (share del pagador con `settledAmount = amount`).
- `confirmSettlement`: relee shares con bloqueo (`SELECT … FOR UPDATE` vía `$queryRaw` sobre los shares del par) para evitar doble asignación → `allocateSettlement` → crea ingreso `GROUP_BACK` → crea un `EntryLink(REIMBURSEMENT)` por asignación → suma `settledAmount` → `status=CONFIRMED`.
- `cancelSettlement`: inverso exacto de lo anterior.

### 4.5 Impacto en `buildSummary`

Ninguno en la fórmula. La Semana 5 solo agrega entries `source=GROUP` (gasto normal, categoría elegida, cuenta y finanza del pagador). La Semana 6 agrega ingresos `source=GROUP_BACK` que **siempre** llevan `EntryLink`, por lo que la regla de S3 los resta del gasto vinculado y no suman a Ingresos. Se agrega solo un test de regresión en `core.test.ts` (ver §6) y se verifica que un ingreso `GROUP_BACK` sin link (dato corrupto) no se pierda: cae en el camino normal y suma a Ingresos (comportamiento seguro, se loguea).

### 4.6 Pantallas

**Mobile (`mobile/`)**
- Rutas Expo Router nuevas: `mobile/app/grupos/index.tsx` (lista), `mobile/app/grupos/nuevo.tsx`, `mobile/app/grupos/[id]/index.tsx` (detalle: saldos, gastos, pagos), `mobile/app/grupos/[id]/gasto.tsx` (cargar/editar), `mobile/app/grupos/[id]/pagar.tsx` (Pagué / marcar a mano / confirmar).
- Features: `mobile/src/features/groups/` (`GroupsScreen`, `NewGroupScreen`, `GroupDetailScreen`, `GroupExpenseForm`, `SplitEditor`, `BalancesCard`, `SettlementSheet`, `MemberPicker`). Siguen el patrón de `mobile/src/features/debts/` (`DebtsScreen.tsx`, `NewDebtScreen.tsx`).
- Datos: `mobile/src/data/groups.ts` (cliente de los endpoints; tipos en `mobile/src/data/types.ts`); selectores en `mobile/src/data/selectors.ts`.
- Dominio: `mobile/src/domain/groupSplit.ts`, copia de `computeShares` solo para previsualizar el reparto y validar la suma al escribir; el servidor es la autoridad.
- Entrada de menú en `mobile/src/features/menu/MenuScreen.tsx` ("Grupos"). El selector de cuenta/finanza reutiliza los componentes de S2 y respeta el tema por finanza (S1).
- Pantalla de la finanza: los movimientos `GROUP`/`GROUP_BACK` muestran chip "Grupo · nombre" en `mobile/src/features/movements/`.
- Bandeja: pagos `PENDING` hacia mí aparecen en `mobile/src/features/notifications/` ("Lucía te pagó $ 30.000. Confirmá").

**Web (`src/app/plan`)**
- `src/app/plan/grupos/page.tsx` y `src/app/plan/grupos/[id]/page.tsx`: lectura de lista, saldos y gastos con acciones mínimas (confirmar / marcar a mano). Entrada desde `src/app/plan/mas/page.tsx`. El diseño de escritorio completo queda en el spec Web.

---

## 5. Plan de tareas

Leyenda: `‖` = paralelizable con la tarea indicada. `Dep:` dependencias.

### Semana 5 — Modelo, reparto y saldos

1. Migración `groups_model` + modelos Prisma + back-relations + CHECK; `prisma generate`. Dep: —
2. Tipos DTO en `src/lib/plan/core.ts`. Dep: 1
3. `group-split.ts` + tests (centavos, suma exacta, modos). Dep: — ‖ 1
4. `group-balance.ts` + tests (par, neto, multi-moneda). Dep: — ‖ 1, 3
5. Extender `access.ts`: recurso `group` (`read|write|admin`) + tests. Dep: 1
6. `groups.ts`: crear grupo, miembros (userId / contactId / contacto nuevo), quitar con regla de saldo. Dep: 1, 2, 5
7. Endpoints de grupo y miembros (`src/app/api/plan/groups/**`). Dep: 6
8. `group-expenses.ts`: crear/editar/borrar gasto con `PlanEntry` `source=GROUP`, `refCode`, snapshot de dólar. Dep: 3, 5, 6
9. Bloqueo en `/api/plan/entries` para entries `GROUP`/`GROUP_BACK` (409 en monto/cuenta/finanza/borrado). Dep: 8 ‖ 10
10. Endpoints de gastos y `GET balances`. Dep: 4, 8
11. Cliente `mobile/src/data/groups.ts` + `mobile/src/domain/groupSplit.ts`. Dep: 10 ‖ 12
12. Pantallas mobile: lista, nuevo grupo, detalle con saldos. Dep: 7, 10, 11
13. Pantalla mobile: cargar/editar gasto con `SplitEditor`. Dep: 11, 12
14. Entrada en `MenuScreen` y chip "Grupo · nombre" en Movimientos. Dep: 12 ‖ 13
15. Pase de integración API (§6) y E2E del escenario de la cena sin pagos. Dep: 7, 10, 13

**Listo cuando (Semana 5):** cargás la cena de 90.000 desde Banco, con reparto IGUAL y luego editado a 40/30/30 %, el grupo muestra los saldos correctos con Lucía y Juan; tu cuenta Banco baja 90.000 y el gasto figura en la finanza elegida; un reparto que no suma el total no se puede guardar; un VIEWER no puede cargar; todos los tests de `group-split` y `group-balance` pasan.

### Semana 6 — Pagos, reintegros, UI y pulido

16. Migración `groups_settlements` + modelo `GroupSettlement`. Dep: S5 mergeada
17. `group-settle.ts` puro: `allocateSettlement` FIFO + tests. Dep: — ‖ 16
18. `group-settle.ts` con efectos: `createSettlement` (APP) con gasto del deudor, validación de tope. Dep: 16, 17
19. `confirmSettlement` / `rejectSettlement`: ingreso `GROUP_BACK`, `EntryLink(REIMBURSEMENT)`, `settledAmount`. Dep: 18
20. `markPaidManual` (MANUAL, nace CONFIRMED) y `cancelSettlement` (reversa total). Dep: 19
21. Endpoints de settlements y bloqueo de edición/borrado de gastos con pagos. Dep: 18, 19, 20
22. Test de regresión de `buildSummary` con `GROUP`/`GROUP_BACK` + links. Dep: 19
23. `group-link.ts` (`linkGroupMembersForContact`, `mergeMembers`) y enganche al hook de registro de S4; script `scripts/backfill-group-members.ts`. Dep: 16 ‖ 17-21
24. Mobile: `SettlementSheet` (Pagué / confirmar / marcar a mano), sección "En revisión", notificación de pago pendiente. Dep: 21
25. Mobile: detalle de gasto con "Tu gasto real: $ 30.000" y lista de reintegros. Dep: 21, 24
26. Web mínima `src/app/plan/grupos/**` + entrada en `mas/page.tsx`. Dep: 21 ‖ 24, 25
27. Pulido: estados vacíos/errores/cargando, texto "Sin registrar", archivar grupo, copia de textos, accesibilidad. Dep: 24, 25
28. Integración (§6), E2E manual completo en iPhone y verificación de la secuencia Juan. Dep: 23, 24, 25, 26, 27

**Listo cuando (Semana 6):** el escenario completo de la cena cierra: Lucía paga 30.000 desde la app y vos confirmás, Juan queda pagado a mano, tu gasto neto es 30.000 y tus Ingresos no cambian, Lucía tiene su gasto de 30.000, los saldos del grupo quedan en 0, cancelar un pago revierte todo, y Juan, al registrarse, ve el grupo y su pago.

## 6. Tests

**Unitarios (Jest, `src/lib/plan`)**
- `group-split.test.ts`: EQUAL con centavos (100/3), PERCENT que suma 100, PERCENT que no suma, AMOUNT que suma, AMOUNT que no suma, participante único, pagador fuera del reparto, determinismo del mayor resto, montos grandes (14,2).
- `group-balance.test.ts`: dos miembros, tres miembros, pagos cruzados con neto, pares con saldo 0, multi-moneda separada, share del pagador ignorado.
- `group-settle.test.ts`: FIFO por fecha, asignación parcial, monto exacto, monto > pendiente (error), asignaciones sin gasto con entry (pagador contacto).
- `core.test.ts`: caso cena → gasto neto 30.000, Ingresos sin cambio, cuenta correcta; GROUP_BACK sin link no se pierde.
- `access.test.ts` (S1) ampliado: matriz rol × acción del recurso `group`.

**Integración API** (Jest con Prisma de prueba o rutas invocadas directamente)
- Crear grupo con usuario + contacto nuevo + contacto existente.
- Gasto: 201 y entry creado con `source=GROUP`, `accountId` y `refCode`; 400 si reparto no suma; 403 VIEWER; 400 cuenta ajena; 409 mes no iniciado; 400 pagador = otro usuario.
- Balances tras gasto, tras pago APP confirmado, tras MANUAL, tras cancelación.
- Settlement: 400 si excede deuda; doble confirmación concurrente no duplica (segunda 409); reject elimina gasto del deudor.
- Editar/borrar gasto con pagos → 409.
- `/api/plan/entries/[id]`: 409 al intentar borrar un entry `GROUP`.
- Aislamiento: usuario ajeno recibe 404 en `/groups/[id]`.
- Enlace: crear contacto, miembro, registrar usuario con ese teléfono → `GroupMember.userId` seteado y `GET /groups` lo lista; correr backfill dos veces no cambia nada.

**E2E manual en iPhone**
1. Crear "Viaje" con Lucía y Juan (sin registrar). Cargar la cena 90.000 desde Banco, partes iguales.
2. Cambiar a reparto en % y a montos; confirmar el error cuando no suma.
3. Ver saldos "Lucía te debe 30.000", "Juan te debe 30.000"; verificar saldo de Banco y gasto en Presupuesto (90.000).
4. Con la cuenta de Lucía: "Pagué 30.000"; con la tuya: confirmar a Mercado Pago. Verificar gasto de Lucía en su finanza y reintegro bajo tu gasto.
5. Marcar a Juan pagado a mano. Gasto neto 30.000, Ingresos sin cambios, saldos en 0.
6. Cancelar el pago de Lucía y verificar reversa; reconfirmar.
7. Registrar a Juan (mismo teléfono) y verificar que ve el grupo y su pago.
8. Cambiar de finanza activa (Personal ↔ Hogar) y verificar color, chip "Grupo · Viaje" y que otro usuario no miembro ve solo "Otra finanza · monto · MOV-XXXX".

## 7. Riesgos

- Concurrencia en confirmaciones y ediciones: transacciones y bloqueo de shares; probar doble tap en mobile (clave de idempotencia por request en una iteración posterior).
- Redondeo mobile (previsualización) vs servidor: el servidor es la autoridad y devuelve los shares finales.
- Coherencia entry ↔ grupo si alguien edita el entry por otra vía: bloqueo 409 en `/api/plan/entries` y excluir `source GROUP/GROUP_BACK` en Mover a finanza (S1), voz y bandeja Apple Pay.
- Dependencia de nombres de S1-S4 (*): validar antes de la tarea 1.
- Mes no iniciado en la finanza del receptor al confirmar: el flujo falla con aviso; documentarlo en la UI.

## 8. Contrato hacia la siguiente semana

**Deja listo (fin de Semana 6)**
- Grupos con miembros usuario/contacto, gastos con reparto, saldos por par y por moneda.
- Pagos APP (con confirmación), MANUAL y cancelación con reversa completa.
- Entries `GROUP` y `GROUP_BACK` con `EntryLink(REIMBURSEMENT)`, integrados al resumen sin tocar la fórmula.
- Enlace automático de contactos sin registrar a usuarios al registrarse.
- Endpoints bajo `/api/plan/groups/**` documentados en §4.4 y pantallas mobile en `mobile/app/grupos/**`, más web mínima.

**Asume la siguiente etapa (Web y fuera de ciclo)**
- La Web construye el layout de escritorio de Grupos sobre estos endpoints, sin cambios de contrato.
- Envío de invitaciones, vista por link y Mercado Pago consumen `Contact`/`Invite`/`GroupSettlement` tal como quedan; no se reescribe ningún modelo.
- Si se decide simplificar deudas o el retroactivo de Juan (decisiones 1 y 2), se implementan como lógica sobre estos mismos datos, sin migración destructiva.

---

## 9. 💬 Preguntas para charlar

> Cómo usar esta sección: cada pregunta vive en **un solo spec** (el de menor número que la toca) aunque afecte a otros; las demás semanas la referencian por su código (`Q-Sx-n`). Respondé en la línea **Respuesta**. Al ejecutar un spec, todas las respuestas de esta sección y las de los specs anteriores forman parte de su contexto.

**Q-S5-1 · Simplificación de deudas**
A debe a B y B debe a C: v1 muestra saldos por par de personas.
- Recomendación: dejarlo así; sumar sugerencia "Simplificar" opcional después.
- **Respuesta:** _(pendiente)_

**Q-S5-2 · Gasto retroactivo para Juan al registrarse**
v1 no crea en su finanza el gasto de su parte pagada a mano. Alternativa: acción "Agregar mi parte a mi finanza" (pediría fecha y cuenta).
- Recomendación: etapa siguiente.
- **Respuesta:** _(pendiente)_

**Q-S5-3 · Pagador distinto de quien carga el gasto**
Se bloquea en v1; permitirlo requiere un flujo de aprobación (`PENDING`).
- Recomendación: mantener el bloqueo.
- **Respuesta:** _(pendiente)_

