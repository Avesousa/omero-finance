# Semana 4 — Contactos y deudas

Spec de la semana 4 del refactor "Hogar → Finanzas". Sigue `00-contrato.md`. Asume S1, S2 y S3 completas (`Household.kind/ownerUserId`, `FinanceMember`, `canAccess`, `PlanAccount`, `PlanEntry.accountId`, `PlanEntry.source` con `LOAN_OUT`, `EntryLink`).

Fuente de diseño: artifact `EKRHHmwFTNEZMeHJq3RU4y`, secciones "Gasto de un préstamo", "Invitar: por teléfono, correo o contactos" y "Toggle de Patrimonio".

---

## 1. Objetivo y "Listo cuando"

**Objetivo.** Que el usuario pueda tener contactos (del celular, o cargados a mano con teléfono o correo), prestarles plata o pedirles prestada, registrar esa salida de cuenta fuera del presupuesto, e invitar a quien todavía no usa la app, sin enviar mensajes. Cuando esa persona se registra con el mismo teléfono o correo, la invitación y los contactos se enlazan solos y el préstamo aparece espejado para ella si corresponde. Además, Patrimonio tiene un toggle "Solo personal / Todas mis finanzas".

**Listo cuando** (criterios observables, probables en iPhone y en la web):

1. Importo "Juan Pérez" desde el celular (teléfono +54 11 5555-1234). Aparece en Contactos con ese teléfono y sin duplicar si lo importo de nuevo.
2. Desde Contactos, toco "Invitar" a Juan. Queda una `Invite` en estado `PENDING`. No sale ningún SMS, correo ni notificación. La pantalla dice "Invitación guardada. Se enlazará cuando se registre con este teléfono".
3. Tengo una cuenta "Banco" con $ 500.000. Presto $ 100.000 a Juan (deuda "me deben", sin cuotas). Resultado:
   - Banco pasa a $ 400.000.
   - Presupuesto de este mes no muestra ningún gasto nuevo (la salida es `LOAN_OUT`).
   - Deudas muestra "Juan · me deben $ 100.000".
   - Patrimonio no cambia en total (baja el activo cuenta y sube "me deben"). Solo cambia la composición.
4. Juan se registra con el mismo teléfono (cargado en su perfil). Al terminar el registro (o al primer login), su invitación pasa a `ACCEPTED`, mi contacto Juan queda con `linkedUserId` y en su app aparece "Lo debo $ 100.000 · de Avelino" (préstamo espejo). Sus cuotas las registra él desde su finanza personal.
5. En Patrimonio (finanza personal) el toggle está en "Solo personal" por defecto. Al cambiar a "Todas mis finanzas" se suman las finanzas donde soy miembro (personal + Hogar). En una finanza compartida no aparece el toggle y se muestra solo esa finanza.
6. Si borro un contacto con préstamos activos, la app lo impide con un mensaje claro.

---

## 2. Alcance / Fuera de alcance

**Dentro**

- Modelo `Contact` (dueño, nombre, teléfono, correo, `linkedUserId`).
- Importar un contacto desde la agenda del celular (una persona por vez, sin sincronización).
- Modelo `Invite` guardado sin envío, con enlace automático al registrarse o al primer login por teléfono o correo.
- `PlanLoan` con contraparte `contactId` o `counterpartyHouseholdId` (finanza). La contraparte "usuario" se resuelve vía `Contact.linkedUserId`.
- Préstamo espejo para usuarios de la app.
- Salida `LOAN_OUT` al prestar (y entrada de cuenta cuando se cobra, que ya existe como cuota de ingreso).
- Excluir `LOAN_OUT` de `buildSummary`.
- Toggle "Solo personal / Todas mis finanzas" en Patrimonio, en API y en mobile y web.
- Pantallas mobile: Contactos (lista, alta, detalle) y ajustes en Deudas/Nuevo préstamo.
- Mínimo en web: lista de Contactos y selector de contraparte en Préstamos (el layout completo de escritorio lo define la spec web).

**Fuera**

- Envío real de invitaciones (correo o SMS). Va en la etapa siguiente del artifact.
- Ver información sin registrarse (links públicos).
- Sincronización continua de la agenda del celular.
- Grupos (S5-6): `Group`, `GroupMember` y `GroupExpense` no se tocan. S4 solo deja `Invite.groupId` pendiente para S5.
- Integración Mercado Pago.
- Confirmación bilateral de cuotas entre espejos (ver decisión abierta D3).
- Cambiar la semántica de `HouseholdInvitation` (queda intacta, ver sección 4.3).

---

## 3. Spec funcional

### 3.1 Historias de usuario

- **H1. Contacto desde el celular.** Como usuario quiero elegir a alguien de mi agenda para no tipear su teléfono.
- **H2. Contacto a mano.** Como usuario quiero cargar un contacto con nombre y teléfono o correo (al menos uno).
- **H3. Invitar sin enviar.** Como usuario quiero dejar guardada la invitación a alguien que no usa la app, sin que se le mande nada, para que al registrarse quede conectado con mis préstamos.
- **H4. Prestar a un contacto.** Como usuario quiero registrar un préstamo a un contacto y que la plata salga de mi cuenta sin contar como gasto del mes.
- **H5. Pedir prestado.** Como usuario quiero registrar una deuda con un contacto (lo debo) con cuotas, como hoy, pero con contraparte elegida de mis contactos.
- **H6. Préstamo espejo.** Como usuario que ya usa la app quiero ver las deudas que alguien tiene conmigo (o yo con alguien), sin cargarlas dos veces.
- **H7. Patrimonio por alcance.** Como usuario quiero ver mi patrimonio solo personal o con todas mis finanzas.

### 3.2 Reglas de negocio

**Contactos**

- R1. Un contacto pertenece a un único dueño (`ownerUserId`). Nadie más lo ve, salvo a través de un préstamo espejo que muestra el nombre del dueño (`User.name`), nunca el nombre con el que el dueño guardó el contacto.
- R2. Debe tener al menos `phone` o `email`. Nombre obligatorio, máximo 80 caracteres.
- R3. Teléfono normalizado a E.164. Si no tiene código de país, se asume `+54` (ver D2). Se guardan solo dígitos y `+`.
- R4. Correo en minúsculas y sin espacios.
- R5. No puede haber dos contactos del mismo dueño con el mismo teléfono o el mismo correo. Al importar un duplicado, la app devuelve el existente y no crea otro.
- R6. Un contacto se enlaza (`linkedUserId`) cuando existe un `User` con ese teléfono (campo nuevo `User.phone`, ver 4.1) o ese correo. El enlace se busca en todos los contactos de todos los dueños con ese teléfono o correo (son la misma persona para el sistema).
- R7. Borrar un contacto con préstamos no cerrados (`isClosed = false`) está prohibido (409). Borrar un contacto cancela sus invitaciones `PENDING`.

**Invitaciones**

- R8. `Invite` se crea desde un contacto con `phone` o `email`. No dispara ningún envío. Estado inicial `PENDING`.
- R9. Solo se puede invitar a una finanza (`householdId`) si el invitador es `ADMIN` o `EDITOR` de esa finanza (`canAccess`). Si no se indica finanza, la invitación es solo para enlazar contactos y préstamos.
- R10. Al enlazar (sección 4.4), la `Invite` pasa a `ACCEPTED`, se guarda `acceptedUserId` y `acceptedAt`. Si tenía finanza, se crea `FinanceMember` con el rol de la invitación (por defecto `VIEWER`).
- R11. Cancelar una invitación la pasa a `CANCELLED` (no se borra).

**Préstamos y contraparte**

- R12. Cada `PlanLoan` tiene a lo sumo una contraparte estructurada: `contactId` (persona de mis contactos, puede estar enlazada a un usuario) o `counterpartyHouseholdId` (otra finanza, p. ej. "Hogar"). Si ninguna está, se usa `counterpart` (texto libre, legado) y el préstamo se trata como hoy.
- R13. La contraparte "usuario" no tiene campo propio: se resuelve por `Contact.linkedUserId`.
- R14. `direction`: `OWED` = me deben, `OWE` = lo debo (sin cambios).
- R15. **Salida al prestar (`LOAN_OUT`).** Al crear un préstamo `OWED` con "Salió de mi cuenta" activado, se crea en la misma transacción un `PlanEntry` con `kind = EXPENSE`, `source = LOAN_OUT`, `accountId` (cuenta elegida), `amount = principal`, `currency`, `period` = mes de `startPeriod`, `name = "Préstamo a {contacto}"`. Ese entry se guarda en `PlanLoan.outEntryId`.
- R16. Un `LOAN_OUT` no entra en Presupuesto, ni en gastos por categoría, ni en "Salidas" del mes. Sí baja el saldo de la cuenta.
- R17. Al crear un `OWE` (pedir prestado) no hay salida. Si la plata entró a una cuenta, el usuario lo registra como ingreso (flujo existente) o marca "Entró a mi cuenta" (crea `PlanEntry` `INCOME` con `source = MANUAL` y `loanId` nulo, fuera de Ingresos porque es ingreso de préstamo; ver caso borde CB6).
- R18. Cuotas: sin cambios respecto de hoy (`PlanEntry.loanId`, `@@unique([loanId, period])`).
- R19. Editar un préstamo espejo: el dueño del préstamo original puede cambiar `principal`, tasa y cuotas, y esos cambios se copian al espejo (sección 4.5). El espejo no permite editar términos desde su lado. Sí puede registrar sus propias cuotas.
- R20. Borrar un préstamo con `outEntryId` borra también el `LOAN_OUT` (mismo transacción). Se avisa antes: "También se borra la salida de $ X de Banco".

**Patrimonio (toggle)**

- R21. Parámetro `alcance`: `personal` (default) o `todas`.
- R22. `personal` = balance de mi finanza personal.
- R23. `todas` = suma de los balances de todas las finanzas donde tengo `FinanceMember` (personal + compartidas). Cada finanza usa el mismo tipo de cambio del período (`usdRateFor`). Sin doble conteo: cada `PlanBalanceItem` y cada `PlanLoan` pertenece a una sola finanza.
- R24. En una finanza compartida no se muestra el toggle y el alcance es esa finanza.
- R25. El alcance se recuerda por usuario en el cliente (mobile: estado local o AsyncStorage; web: localStorage). No hace falta persistirlo en servidor.

### 3.3 Casos borde

- CB1. **Teléfono ya registrado al importar.** Si el teléfono coincide con un `User` existente, el contacto se crea y queda enlazado al instante (`linkedUserId`). Se crean los espejos pendientes (4.4).
- CB2. **Correo con mayúsculas o espacios.** Se normaliza antes de comparar.
- CB3. **Dos invitaciones para el mismo teléfono.** Al registrarse, todas las `PENDING` con ese teléfono pasan a `ACCEPTED`. Si apuntan a finanzas distintas, se crea un `FinanceMember` por cada una.
- CB4. **Contacto sin enlazar que ya tiene préstamos.** Préstamos quedan con `contactId`. Cuando el contacto se enlaza, se crean espejos para los préstamos no cerrados (4.4, paso 3).
- CB5. **Persona que se registra con correo distinto al de la invitación.** No se enlaza por correo. Sí puede enlazarse por teléfono si coincide. Se documenta en la pantalla de invitación ("se enlaza por teléfono o correo exactos").
- CB6. **Entrada de plata de un préstamo tomado** (OWE): ver R17. Se registra como `INCOME` con `source = MANUAL`. No infla Ingresos del mes si se marca "Préstamo" (`loanId`), igual que hoy con préstamos OWE.
- CB7. **Cuenta eliminada o archivada después de prestar.** El `LOAN_OUT` queda en esa cuenta (S2 no permite borrar cuentas con movimientos). Se bloquea el borrado.
- CB8. **Préstamo en USD.** `LOAN_OUT` usa la moneda del préstamo. La cuenta debe tener esa moneda o se rechaza (400). Ver S2 (`PlanAccount.currency`).
- CB9. **Mismo contacto usado como persona y como finanza.** No aplica: `contactId` y `counterpartyHouseholdId` son excluyentes (R12). Se valida en API (400).
- CB10. **Usuario enlazado borra su cuenta.** `Contact.linkedUserId` queda en null (SetNull). Los espejos siguen existiendo con su contenido (ya copiado), sin nombre de contraparte vivo; el nombre se guarda en `PlanLoan.name`. No hay espejo nuevo.

### 3.4 Textos de UI clave (es-AR)

- Contactos: "Contactos" · botón "Importar del celular" · "Nuevo contacto".
- Alta: "Nombre", "Teléfono", "Correo", ayuda "Teléfono o correo, al menos uno".
- Invitar: botón "Invitar a la app" · confirmación "Invitación guardada. No le mandamos nada: se va a enlazar cuando se registre con {teléfono/correo}." · estado "Invitación pendiente".
- Enlazado: badge "Usa Omero".
- Nuevo préstamo: "¿Me deben o debo?" con opciones "Me deben" / "Debo". Contraparte: "Contacto" (picker) o "Finanza" (si hay más de una). Checkbox "Salió plata de mi cuenta" (solo en "Me deben") con selector "Cuenta" y aviso: "Esta salida no cuenta como gasto del mes."
- Patrimonio: toggle "Solo personal" / "Todas mis finanzas".
- Espejo: "Lo debo · de {nombre}" / "Me deben · a {nombre}" con badge "Espejo".
- Borrar contacto con préstamos: "No se puede borrar: tenés préstamos abiertos con {nombre}. Cerralos primero."

---

## 4. Spec técnico

### 4.1 Cambios Prisma

Migración aditiva. Las enums `EntrySource` (con `LOAN_OUT`), `FinanceRole` (`ADMIN | EDITOR | VIEWER`) y las relaciones de `Household` (`kind`, `ownerUserId`) vienen de S1 y S3. Los nombres de enum se asumen de S1/S3; si S1 usó otro, se alinea antes de implementar.

**Nuevo: `Contact`**

```prisma
model Contact {
  id           String   @id @default(cuid())
  ownerUserId  String
  name         String
  /// E.164, ej. +5491155551234. Null si solo tiene correo.
  phone        String?
  /// Minúsculas. Null si solo tiene teléfono.
  email        String?
  /// Usuario de la app si el teléfono o correo coincide con un User registrado.
  linkedUserId String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  owner      User       @relation("ContactOwner", fields: [ownerUserId], references: [id], onDelete: Cascade)
  linkedUser User?      @relation("ContactLinked", fields: [linkedUserId], references: [id], onDelete: SetNull)
  invites    Invite[]
  loans      PlanLoan[]

  @@unique([ownerUserId, phone])
  @@unique([ownerUserId, email])
  @@index([phone])
  @@index([email])
  @@index([linkedUserId])
}
```

Nota: en Postgres los `NULL` no chocan con `@@unique`, así que varios contactos sin teléfono son válidos.

**Nuevo: `Invite`** (distinto de `HouseholdInvitation`, ver 4.3)

```prisma
enum InviteStatus {
  PENDING
  ACCEPTED
  CANCELLED
}

model Invite {
  id              String       @id @default(cuid())
  invitedByUserId String
  contactId       String?
  /// Copiados del contacto al invitar; así la invitación sigue viva aunque el contacto cambie.
  phone           String?
  email           String?
  /// Finanza a la que se invita (opcional). Groups se agrega en S5.
  householdId     String?
  role            FinanceRole?
  status          InviteStatus @default(PENDING)
  acceptedUserId  String?
  createdAt       DateTime     @default(now())
  acceptedAt      DateTime?

  invitedBy User       @relation("InviteSender", fields: [invitedByUserId], references: [id], onDelete: Cascade)
  contact   Contact?   @relation(fields: [contactId], references: [id], onDelete: SetNull)
  household Household? @relation(fields: [householdId], references: [id], onDelete: SetNull)

  @@index([phone, status])
  @@index([email, status])
  @@index([invitedByUserId])
}
```

**Cambio: `User`** (agregar campo y relaciones inversas)

```prisma
model User {
  // ...campos existentes sin cambios...
  /// NUEVO S4. E.164. Se carga en /api/auth/profile. Nullable: usuarios viejos no lo tienen.
  phone         String?  @unique

  ownedContacts  Contact[] @relation("ContactOwner")
  linkedContacts Contact[] @relation("ContactLinked")
  invitesSent    Invite[]  @relation("InviteSender")
}
```

**Cambio: `Household`** (solo relaciones inversas)

```prisma
model Household {
  // ...campos existentes sin cambios...
  invites Invite[]
  counterpartyLoans PlanLoan[] @relation("LoanCounterpartyHousehold")
}
```

**Cambio: `PlanLoan`**

```prisma
model PlanLoan {
  // ...campos existentes sin cambios (counterpart: String? queda como legado y fallback)...

  /// NUEVO S4. Contraparte persona (puede estar enlazada a un usuario vía Contact.linkedUserId).
  contactId               String?
  /// NUEVO S4. Contraparte finanza (otra Household del mismo sistema). Excluyente con contactId.
  counterpartyHouseholdId String?
  /// NUEVO S4. Salida de cuenta asociada al prestar (PlanEntry source LOAN_OUT). Único.
  outEntryId              String?             @unique
  /// NUEVO S4. Préstamo espejo: el PlanLoan del otro lado (usuario de la app). Simétrico, único.
  mirrorLoanId            String?             @unique

  contact               Contact?    @relation(fields: [contactId], references: [id], onDelete: SetNull)
  counterpartyHousehold Household?  @relation("LoanCounterpartyHousehold", fields: [counterpartyHouseholdId], references: [id], onDelete: SetNull)
  outEntry              PlanEntry?  @relation("LoanOutEntry", fields: [outEntryId], references: [id], onDelete: SetNull)
  mirrorLoan            PlanLoan?   @relation("LoanMirror", fields: [mirrorLoanId], references: [id], onDelete: SetNull)
  mirroredBy            PlanLoan?   @relation("LoanMirror")

  @@index([contactId])
  @@index([counterpartyHouseholdId])
}
```

Notas:
- `mirrorLoanId` es `@unique` y la relación `LoanMirror` es 1-1 simétrica. Con eso, `mirrorLoan` apunta al otro lado y `mirroredBy` lo recibe en el lado que no tiene `mirrorLoanId`. Como las dos filas tienen `mirrorLoanId` apuntando una a la otra, ambas lo tienen seteado y `mirroredBy` queda como inversa que Prisma resuelve sin problema; si al migrar Prisma se queja de ambigüedad, se usa un único campo y se resuelve en código (decisión técnica menor, se verifica con `node_modules/@prisma/client`, ver CLAUDE.md).
- `outEntryId` apunta al `PlanEntry` de la salida. La relación inversa va en `PlanEntry` (abajo).

**Cambio: `PlanEntry`** (solo relación inversa)

```prisma
model PlanEntry {
  // ...campos existentes, incluidos accountId/source de S2/S3...
  /// Si este entry es la salida de un préstamo (source LOAN_OUT).
  loanOut PlanLoan? @relation("LoanOutEntry")
}
```

**Cambio: `EntrySource`** (S3 lo crea; S4 solo empieza a usar `LOAN_OUT`). No hay cambio de schema.

### 4.2 Migración y backfill

**Migración** `s4_contacts_debts` (aditiva):

1. `CREATE TYPE "InviteStatus"`.
2. `ALTER TABLE "User" ADD COLUMN "phone" TEXT` + índice único.
3. `CREATE TABLE "Contact"` con índices y uniques indicados.
4. `CREATE TABLE "Invite"` con índices.
5. `ALTER TABLE "PlanLoan" ADD COLUMN "contactId" TEXT, "counterpartyHouseholdId" TEXT, "outEntryId" TEXT, "mirrorLoanId" TEXT` + uniques e índices + FKs con `ON DELETE SET NULL`.

Ninguna columna existente cambia de tipo ni se borra.

**Backfill** `scripts/backfill-s4-contacts.ts` (idempotente, se puede correr dos veces sin efectos):

- Para cada `PlanLoan` con `contactId IS NULL`, `counterpartyHouseholdId IS NULL` y `counterpart` no vacío:
  1. Buscar `Contact` del dueño de la finanza (`Household.ownerUserId`, de S1) con `name = counterpart` y sin `phone` ni `email`. Si existe, usarlo.
  2. Si no existe, crearlo con `name = counterpart`.
  3. Setear `PlanLoan.contactId`. No se toca `counterpart`.
- No se crean `LOAN_OUT` para préstamos viejos. Los movimientos de plata históricos no se inventan.
- No se crean `Invite` ni espejos para préstamos viejos.
- Los `HouseholdInvitation` existentes quedan intactos.
- El script imprime conteos (`creados`, `enlazados`, `ya-estaban`) y no escribe si corre con `--dry-run`.

### 4.3 Relación con `HouseholdInvitation` (decisión tomada)

`HouseholdInvitation` (en `prisma/schema.prisma`) ya existe: tiene `email`, `code` y `status` con `InvitationStatus`, y el CLAUDE.md la marca como "schema ok, UI sin terminar". No tiene teléfono ni contacto, y no hay rutas en `src/app/api` que la usen.

Decisión: S4 **no la reutiliza**. `Invite` es un concepto distinto (contacto + teléfono o correo + enlace automático). `HouseholdInvitation` queda sin tocar y sin uso. Se depreca formalmente en S6 o en la spec web si nadie la retoma. El riesgo de dos conceptos es documentado en la sección 7.

### 4.4 Enlace al registrarse o al primer login

Helper nuevo `src/lib/plan/contacts.ts` → `linkPendingInvites(tx, user)`. Se ejecuta en una transacción y es idempotente:

1. Si `user.phone` o `user.email` coinciden con algún `Contact` (de cualquier dueño) sin `linkedUserId`, setear `linkedUserId = user.id`.
2. Buscar `Invite` con `status = PENDING` y `phone = user.phone` o `email = user.email`:
   - Marcar `ACCEPTED`, `acceptedUserId = user.id`, `acceptedAt = now()`.
   - Si tiene `householdId`, `upsert` de `FinanceMember(userId, householdId, role ?? VIEWER)`.
3. Para cada `PlanLoan` cuyo `contactId` apunta a un contacto recién enlazado y que no tiene `mirrorLoanId` y `isClosed = false`, crear el espejo (4.5).

**Dónde se llama:**

- En el flujo de alta de usuario (seed `prisma/seed.ts` hoy; sign-up cuando exista).
- En `POST /api/auth/login` después de validar la contraseña (cubre usuarios creados antes de este cambio o cuyo teléfono se cargó después).
- En `POST /api/auth/profile` cuando se cambia `phone` o `email` (archivo existente `src/app/api/auth/profile/route.ts`).

No hay sign-up UI hoy (CLAUDE.md, "Pendiente"). Por eso el hook va en el helper, no en una pantalla.

### 4.5 Préstamo espejo

Al enlazar un contacto (o al crear un préstamo con contacto ya enlazado):

- Crear `PlanLoan` en la **finanza personal** del usuario enlazado (`Household.kind = PERSONAL`, `ownerUserId = user.id`).
- Campos copiados: `name`, `mode`, `currency`, `principal`, `installments`, `installmentAmount`, `interestRate`, `interestFrequency`, `interestAnnual`, `interestTaxPct`, `startPeriod`, `dueDay`, `endDate`, `note`, y la programación (`PlanLoanScheduleItem`).
- `direction` invertida (`OWED` ↔ `OWE`).
- `counterpartyHouseholdId = ` finanza personal del dueño original. `contactId = null` del lado del espejo.
- `mirrorLoanId` seteado en ambos lados.
- `name` del espejo: "Préstamo de {owner.name}" (no el nombre del contacto).
- Las cuotas de cada lado se generan por el flujo existente (`fillStartedMonths`), en la finanza de cada uno. Lo que cobra uno y paga el otro se registra por separado (ver D3).

Al editar términos del original (`POST /api/plan/loans/:id`), se propagan los campos de la lista anterior al espejo, con la misma transacción. Al borrar el original, el espejo se borra también (mismo borrado de cuotas que hoy).

### 4.6 Endpoints

Convenciones: `POST /:id` para actualizar, `DELETE /:id` para borrar, `{ error: string }` en errores. Todos los endpoints usan `withSession` (`src/lib/plan/server.ts`), que en S1 pasa a devolver `{ user, financeId }` y en S4 valida con `canAccess`.

| Método y ruta | Body | Respuesta | Permisos (`canAccess`) |
|---|---|---|---|
| `GET /api/plan/contacts` | — | `{ contacts: ContactDTO[] }` | `contact.read`: solo `ownerUserId` = sesión |
| `POST /api/plan/contacts` | `{ name, phone?, email?, source?: "DEVICE" \| "MANUAL" }` | `201 { id }`. Si ya existe: `409 { error }` | `contact.write` |
| `POST /api/plan/contacts/:id` | `{ name?, phone?, email? }` | `200 { ok: true }` | `contact.write`, dueño |
| `DELETE /api/plan/contacts/:id` | — | `200 { ok: true }`, `409 { error }` si tiene préstamos abiertos | `contact.write`, dueño |
| `POST /api/plan/contacts/:id/invite` | `{ householdId?, role? }` | `201 { id, status: "PENDING" }` | `contact.write`; si `householdId`, `invite` sobre esa finanza (ADMIN/EDITOR) |
| `GET /api/plan/invites` | — | `{ invites: InviteDTO[] }` (solo las que yo invité) | dueño |
| `DELETE /api/plan/invites/:id` | — | `200 { ok: true }`; marca `CANCELLED` | dueño |
| `POST /api/plan/loans` (extiende S0) | agrega `contactId?`, `counterpartyHouseholdId?`, `outAccountId?`, `outDate?` | `201 { id, outEntryId? }` | `loan.write` en la finanza; `account.use` en `outAccountId` |
| `POST /api/plan/loans/:id` (existe en `src/app/api/plan/loans/[id]/route.ts`) | mismos campos que crear, parciales | `200 { ok: true }` | `loan.write`; si tiene espejo, propaga (4.5) |
| `GET /api/plan/balance?alcance=personal\|todas` (extiende `src/app/api/plan/balance/route.ts`) | — | Igual que hoy + `{ scope, financeIds: string[] }` | `finance.read` por cada finanza incluida |
| `POST /api/auth/profile` (existe) | agrega `phone?` | `200 { ok: true }`; dispara `linkPendingInvites` | sesión |

**Errores específicos S4:**

- 400 `"Un préstamo tiene una sola contraparte: persona o finanza"` (CB9).
- 400 `"La cuenta no es de moneda {X}"` (CB8).
- 400 `"El contacto necesita teléfono o correo"` (R2).
- 404 si el contacto no es del usuario (no revelar que existe).
- 409 `"Ya tenés un contacto con ese teléfono"` (R5).
- 409 `"Tenés préstamos abiertos con este contacto"` (R7).

### 4.7 Helpers y libs

Archivos nuevos o cambiados en `src/lib/plan/`:

- **`contacts.ts` (nuevo).**
  - `normalizePhone(raw: string): string | null` (E.164, default `+54`).
  - `normalizeEmail(raw: string): string | null`.
  - `createContact(tx, ownerUserId, input)` con validaciones R2, R3, R4 y R5.
  - `inviteContact(tx, ownerUserId, contactId, opts)` (R8, R9).
  - `linkPendingInvites(tx, user)` (4.4).
  - `ensureMirrorLoans(tx, userId)` (4.5, paso 3).
- **`loans.ts` (cambio).**
  - `loanFields(householdId, body)` acepta `contactId`, `counterpartyHouseholdId`, `outAccountId`, `outDate`, y valida R12 y CB9.
  - `createLoanOutEntry(tx, loan, accountId)` (R15): crea el `PlanEntry` `LOAN_OUT` y setea `outEntryId`.
  - `propagateToMirror(tx, loan)` (R19, 4.5).
  - `deleteLoanCascade(tx, loanId)` (R20): borra cuotas, espejo y `LOAN_OUT`.
- **`core.ts` (cambio en `buildSummary`).** Ver 4.8.
- **`core.ts` (cambio en `netWorth` / balance).** Nuevo helper `scopeBalance(items, scope)` o se reutiliza `netWorth` por finanza y se suma (sin cambiar `netWorth`).
- **`server.ts` (cambio).** `loadLoans` y `loanToDto` (líneas ~252 y ~287) incluyen `contactId`, `counterpartyHouseholdId`, `mirrorLoanId`, `outEntryId`, y el nombre de contraparte resuelto (`contact.name` o `Household.name`, o `counterpart` legado).
- **`access.ts` (de S1).** Se agregan los recursos `contact`, `invite`, `loan` (si no existen) con sus acciones.

### 4.8 Impacto en `buildSummary`

Archivo: `src/lib/plan/core.ts`, función `buildSummary` (línea ~873).

Cambios concretos (sin tocar la fórmula de Disponible):

- Excluir `LOAN_OUT` de todos los agregados de gasto:
  ```ts
  const isLoanOut = (e: EntryDTO) => e.source === "LOAN_OUT";
  const expenses = entries.filter((e) => e.kind === "EXPENSE" && !isLoanOut(e));
  ```
  `LOAN_OUT` no entra en `fixedExpenses`, `loanExpenses`, `variableExpenses`, `spentArs`, `paidArs`, ni en `budgets`/categorías.
- `incomes` no cambia: un préstamo cobrado sigue siendo `INCOME` con `loanId` y se trata por `isReceivable` (ya existe, línea ~858).
- La salida de cuenta sí afecta **saldo de la cuenta** (S2), no el resumen de gasto. Eso lo maneja S2.
- Patrimonio: `loanBalanceItem` (línea ~738) ya suma el saldo pendiente como activo. No se toca.

Caso de prueba (Jest, `core.test.ts`): entradas `[LOAN_OUT 100.000 EXPENSE, INCOME 500.000]` → `spentArs = 0`, `variableArs = 0`, `incomeArs = 500.000`.

### 4.9 Patrimonio (toggle)

- **API.** `GET /api/plan/balance?alcance=todas` resuelve `financeIds` con `FinanceMember` del usuario, carga `loadBalance(financeId)` para cada una, convierte con `usdRateFor(financeId, period)` y suma con `netWorth`. El caso `personal` queda igual que hoy.
- **Mobile.** `mobile/app/(tabs)/patrimonio.tsx` renderiza `WealthScreen` (`mobile/src/features/wealth/WealthScreen.tsx`). Agregar el toggle encima del total. Sin toggle si la finanza activa es compartida.
- **Web.** `src/app/plan/patrimonio/page.tsx`: mismo toggle. Estado en localStorage con try/catch.

### 4.10 Pantallas y componentes

**Mobile** (`mobile/app`, `mobile/src`):

- **Nuevo:** `mobile/app/contactos/index.tsx` (lista con búsqueda, badge "Usa Omero", botón "Importar del celular").
- **Nuevo:** `mobile/app/contactos/nuevo.tsx` (alta a mano y desde agenda).
- **Nuevo:** `mobile/app/contactos/[id].tsx` (detalle: teléfono, correo, préstamos abiertos, "Invitar a la app", "Borrar").
- **Nuevo:** `mobile/src/features/contacts/ContactsScreen.tsx`, `ContactFormScreen.tsx`, `ContactDetailScreen.tsx`. Datos en `mobile/src/data/contacts.ts`.
- **Cambio:** `mobile/app/deudas/nueva.tsx` → `mobile/src/features/debts/NewDebtScreen.tsx`. El campo de texto "Con quién" pasa a picker de contacto (y finanza si hay más de una). Agregar checkbox "Salió plata de mi cuenta" + selector de cuenta (S2).
- **Cambio:** `mobile/src/data/plan.ts` (cliente de API para contactos, invitaciones, y los campos nuevos de préstamo).
- **Cambio:** `mobile/src/features/debts/DebtsScreen.tsx` y `mobile/src/components/organisms/LoanCard.tsx`. Badge "Espejo" y "Usa Omero". Nombre de contraparte resuelto.
- **Cambio:** `mobile/app/(tabs)/menu.tsx` agrega "Contactos" (ruta `/contactos`).
- **Cambio:** `mobile/src/features/wealth/WealthScreen.tsx` (toggle, 4.9).
- **Dependencia nueva:** `expo-contacts` (no está hoy en `mobile/package.json`). Ver D1 y `app.json` (ya modificado en git status, coordinar antes de tocarlo).

**Web** (`src/app/plan`):

- **Nuevo:** `src/app/plan/contactos/page.tsx` (lista y alta mínima; la spec web define el layout final).
- **Cambio:** `src/app/plan/prestamos/page.tsx` (picker de contacto y checkbox LOAN_OUT).
- **Cambio:** `src/app/plan/patrimonio/page.tsx` (toggle).

**Tests de UI:** no hay Playwright escrito (CLAUDE.md). Ver sección 6.

---

## 5. Plan de tareas

Cada tarea es atómica. `[P]` = paralelizable con las marcadas con el mismo número de bloque.

**Bloque A: base de datos**

1. Agregar `User.phone` + relaciones inversas, `Contact`, `Invite`, `InviteStatus`, y campos de `PlanLoan` en `prisma/schema.prisma`. Correr `prisma migrate dev` con nombre `s4_contacts_debts`. Depende de: S3 mergeada.
2. Script de backfill `scripts/backfill-s4-contacts.ts` con `--dry-run`. Depende de 1.

**Bloque B: libs (después de 1)**

3. `src/lib/plan/contacts.ts`: `normalizePhone`, `normalizeEmail`, `createContact`, `inviteContact`. Depende de 1. **[P con 4, 5]**
4. `src/lib/plan/contacts.ts`: `linkPendingInvites`, `ensureMirrorLoans`. Depende de 3.
5. `src/lib/plan/loans.ts`: `loanFields` con contraparte, `createLoanOutEntry`, `propagateToMirror`, `deleteLoanCascade`. Depende de 1. **[P con 3]**
6. `src/lib/plan/core.ts`: exclusión de `LOAN_OUT` en `buildSummary` y `scopeBalance`. Depende de S3 (`PlanEntry.source`). **[P con 3, 5]**

**Bloque C: API (después de B)**

7. `src/app/api/plan/contacts/route.ts` (GET, POST) y `contacts/[id]/route.ts` (POST, DELETE). Depende de 3.
8. `src/app/api/plan/contacts/[id]/invite/route.ts` y `src/app/api/plan/invites/route.ts`, `invites/[id]/route.ts`. Depende de 3. **[P con 7]**
9. Extender `src/app/api/plan/loans/route.ts` y `loans/[id]/route.ts`, con `loanToDto` en `src/lib/plan/server.ts`. Depende de 5. **[P con 7, 8]**
10. Extender `src/app/api/auth/profile/route.ts` (campo `phone`) y `src/app/api/auth/login/route.ts` para llamar `linkPendingInvites`. Depende de 4. **[P con 7, 8, 9]**
11. Extender `src/app/api/plan/balance/route.ts` con `alcance`. Depende de 6. **[P con 7–10]**

**Bloque D: UI (después de C)**

12. Mobile: `mobile/src/data/contacts.ts` y `mobile/src/data/plan.ts` (cliente). Depende de 7–9. **[P con 13, 14]**
13. Mobile: pantallas `mobile/app/contactos/*` y `mobile/src/features/contacts/*`. Depende de 12.
14. Mobile: `NewDebtScreen`, `DebtsScreen`, `LoanCard`, toggle en `WealthScreen`, entrada en `menu.tsx`. Depende de 12. **[P con 13]**
15. Web: `src/app/plan/contactos/page.tsx`, cambios en `prestamos` y `patrimonio`. Depende de 7–11. **[P con 12–14]**

**Bloque E: verificación**

16. Tests unitarios (sección 6.1). Depende de 3–6. Se escriben junto con cada tarea, no al final.
17. Smoke de API con script (sección 6.2). Depende de 7–11.
18. Checklist E2E en iPhone (sección 6.3). Depende de 13 y 14.

Paralelizables: 3/5/6; 7/8/9/10/11; 12/13/14/15 (con cuidado en 13 y 14 al compartir `mobile/src/data`).

---

## 6. Tests

### 6.1 Unitarios (Jest, `src/lib/plan/`)

- `contacts.test.ts` (nuevo):
  - `normalizePhone`: `"11 5555-1234"` → `+5411 5555 1234` (con `+54`), `"+1 555 0100"` → `+15550100`, texto inválido → null.
  - `normalizeEmail`: `"  Juan@Mail.COM "` → `juan@mail.com`.
  - `linkPendingInvites`: dado un usuario con teléfono X y una invitación PENDING con X, devuelve `ACCEPTED`. Segunda llamada no cambia nada (idempotencia). Con finanza, crea `FinanceMember` con rol de la invitación o `VIEWER`.
  - `ensureMirrorLoans`: préstamo `OWED` a contacto enlazado → espejo `OWE` con `mirrorLoanId` en ambos lados; no duplica en segunda corrida.
- `loans.test.ts` (ampliar):
  - `loanFields` rechaza `contactId` + `counterpartyHouseholdId` a la vez (CB9).
  - `createLoanOutEntry` produce `EXPENSE` con `source = LOAN_OUT` y `loanId = null`.
  - `propagateToMirror` invierte `direction` y copia términos.
  - `deleteLoanCascade` borra `LOAN_OUT` y espejo.
- `core.test.ts` (ampliar):
  - `buildSummary` con `LOAN_OUT` (4.8).
  - `scopeBalance` con dos finanzas en USD y ARS suma correctamente y no duplica items.

### 6.2 Integración API

No hay harness de integración confirmado en el repo (Jest unitario en `src/lib/plan`, Playwright configurado sin tests escritos según CLAUDE.md). Propuesta: script `scripts/smoke-s4.ts` que, contra una base de test (branch de Neon), crea usuarios, contactos, invitación, préstamo con `LOAN_OUT`, registra alta con teléfono, y verifica los estados. Corre con `pnpm tsx scripts/smoke-s4.ts`. Si el equipo prefiere Jest con Prisma de test, es decisión abierta (D4).

Casos mínimos:

- Contacto duplicado devuelve 409.
- Contacto con préstamo abierto no se puede borrar (409).
- Préstamo `OWED` con `outAccountId` crea `outEntryId`; `GET /api/plan/month` no lo lista como gasto.
- Usuario de otra finanza recibe 404 al pedir un contacto ajeno.
- `balance?alcance=todas` no incluye finanzas donde el usuario no es miembro.
- `POST /api/auth/profile` con teléfono enlaza invitaciones PENDING.

### 6.3 E2E manual en iPhone

1. Importar contacto desde la agenda. Repetir importación: no se duplica.
2. Invitar al contacto. Confirmar que no sale ninguna notificación ni SMS.
3. Prestar $ 100.000 desde "Banco". Ver saldo de Banco −100.000. Presupuesto sin gasto nuevo. Deudas muestra "me deben".
4. Patrimonio: total igual antes y después de prestar.
5. Desde un segundo usuario (o cuenta de prueba) cargar el mismo teléfono en el perfil. Hacer login. Ver el espejo "Lo debo" y la invitación en Contactos del invitador como "Usa Omero".
6. Cambiar Patrimonio a "Todas mis finanzas" y volver a "Solo personal". Persiste al reabrir la app.
7. Intentar borrar contacto con préstamo abierto. Ver el mensaje.

---

## 7. Riesgos

- **R-c. No hay sign-up.** El enlace depende de `linkPendingInvites` en seed, login y profile; un usuario creado por otra vía se enlaza en su primer login.
- **R-e. Desync de espejos.** Cada lado registra sus cuotas; si uno marca pagada y el otro no, los saldos no coinciden. Se muestra, no se resuelve automáticamente.
- **R-g. Normalización de teléfonos.** Asumir `+54` puede enlazar mal números de otros países; pedir código de país si empieza con `+` o tiene más de 11 dígitos.
- **R-h. Borrar un préstamo con `LOAN_OUT` ya conciliado** altera saldos históricos; se avisa y se pide confirmación.
- Los harness de pruebas siguen la decisión de S1 (R8): suite de integración completa.

## 8. Contrato hacia la siguiente semana

**S4 deja listo:**

- `Contact` (con `linkedUserId`) y `Invite` (estado y enlace automático), usables desde S5-6 para `GroupMember(contactId)`.
- `User.phone` para el enlace por teléfono.
- `PlanLoan` con contraparte estructurada (`contactId`, `counterpartyHouseholdId`) y espejo (`mirrorLoanId`).
- `LOAN_OUT` activo: el resumen de gasto lo excluye, la cuenta lo descuenta.
- `GET /api/plan/balance?alcance=` con `financeIds`, base para la pantalla de Patrimonio de la web.
- `linkPendingInvites(tx, user)` como único punto de enlace.

**S4 asume de S5-6:**

- Grupos: S5 agrega `Invite.groupId` (migración propia) y `GroupMember` con `contactId`. S4 no crea grupos.
- La regla `canAccess` ya cubre `group` (S5 lo registra en `access.ts`).

**S4 no entrega a web todavía:** el layout de escritorio de Contactos y Préstamos lo define la spec web. S4 entrega las rutas mínimas (`src/app/plan/contactos/page.tsx`).

---

## 9. 💬 Preguntas para charlar

> Cómo usar esta sección: cada pregunta vive en **un solo spec** (el de menor número que la toca) aunque afecte a otros; las demás semanas la referencian por su código (`Q-Sx-n`). Respondé en la línea **Respuesta**. Al ejecutar un spec, todas las respuestas de esta sección y las de los specs anteriores forman parte de su contexto.

**Q-S4-1 · `User.phone` y `expo-contacts`**
`User.phone` es la única columna nueva fuera del contrato (sin ella no hay enlace por teléfono). `expo-contacts` es dependencia nueva y requiere permiso en `app.json` (que está modificado en el working tree).
- Recomendación: aprobar ambos; coordinar el cambio de `app.json`.
- **Respuesta:** _(pendiente)_

**Q-S4-2 · Código de país por defecto**
Para teléfonos sin `+`.
- Recomendación: `+54` y pedir código si hay ambigüedad.
- **Respuesta:** _(pendiente)_

**Q-S4-3 · Confirmación bilateral de cuotas entre espejos**
Que el otro lado confirme "pagué".
- Recomendación: no en S4; etapa siguiente.
- **Respuesta:** _(pendiente)_

**Q-S4-4 · Preferencia del toggle de Patrimonio**
Local al dispositivo o guardada en el servidor por usuario.
- Recomendación: local en S4.
- **Respuesta:** _(pendiente)_

**Q-S4-5 · Qué puede invitar `Invite` (incluye grupos de S5-6)**
¿Invitar a una finanza (`householdId`, equivale a un `FinanceMember`) y a un grupo (`groupId`, lo agrega S5 con migración propia)? Además `HouseholdInvitation` (existente, sin uso) convive con `Invite`.
- Recomendación: incluir `householdId` en S4, dejar `groupId` para S5, y marcar `HouseholdInvitation` como deprecada sin borrarla.
- **Respuesta:** _(pendiente)_

