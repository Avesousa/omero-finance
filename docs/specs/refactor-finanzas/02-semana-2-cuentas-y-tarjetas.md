# S2 — Cuentas y tarjetas en una sola finanza

Rama: `feat/finanzas-s2-finanza-unica`, desde `main`. El usuario reemplazó el diseño original de cuentas/tarjetas compartidas. La referencia histórica está en `reference/02-diseno-multifinanza.md`; no es el contrato de implementación.

## 1. Objetivo y listo cuando

Cada movimiento realizado registra por qué cuenta pasó el dinero. Cada cuenta y tarjeta pertenece a un usuario y está asignada a una sola finanza. Personal permite ver todos los recursos propios, con su finanza actual, sin volver a sumar los ingresos/gastos de otras finanzas.

- Crear cuentas ARS/USD con saldo inicial y fecha de corte; ver saldo e historial.
- Elegir cuenta al cargar gastos/ingresos, confirmar sueldos, pagar fijos, cuotas y resúmenes, y confirmar débitos de Apple Pay.
- Transferir entre cuentas propias de una misma finanza, sacar efectivo y comprar/vender dólares con tipo de cambio guardado.
- Mover un gasto/ingreso completo con cuenta de destino. Mover una cuenta o tarjeta con su historial. Mostrar «Origen: {finanza}».
- Respetar permisos y mantener saldos correctos al pagar/deshacer o reclasificar recursos.

## 2. Alcance

Dentro: backend, migración, backfill idempotente, mobile y web, cuentas y transferencias, pagos de resúmenes por moneda, catálogo de recursos propios y traslados con historial. Se conserva S1.1: Todas / Ingresos / Gastos, movimientos realizados y aviso de vencidos únicamente en Gastos.

Fuera: cuentas/tarjetas asignadas simultáneamente a varias finanzas, reparto de resúmenes por finanza, transferencias nuevas entre usuarios o finanzas, integración bancaria/Mercado Pago, vínculos, aportes, contactos, grupos y nuevo layout de escritorio.

## 3. Reglas funcionales

### Cuentas, saldos y visibilidad

- `ownerUserId` identifica al dueño; `householdId` identifica su única finanza actual. Personal lista los recursos propios de todas las finanzas más los asignados a la activa. Los selectores operativos muestran exclusivamente cuentas activas de la finanza de la operación y de su moneda.
- Los editores/administradores pueden registrar operaciones en las cuentas de su finanza. Solo el dueño administra o transfiere desde su cuenta y administra su tarjeta. El dueño conserva la vista de sus recursos desde Personal aunque pierda la membresía; el detalle de movimientos de una finanza inaccesible se enmascara, sin nombre, categoría o nombre de finanza.
- Saldo = saldo inicial + ingresos cobrados − gastos pagados + transferencias entrantes − salientes − pagos de resumen. Todos los cálculos de suma se hacen en PostgreSQL numeric; pendientes y compras de tarjeta no modifican saldos.
- `openingDate` representa el saldo al comienzo de ese día: solo se suman operaciones desde esa fecha. Sin fecha de corte, se considera todo el historial. Los movimientos anteriores siguen siendo visibles. No presentar un saldo actual como saldo inicial anterior a todo el historial.
- Para gastos/cuotas se guarda `PlanEntry.paidAt`; para ingresos se mantiene `collectedAt` de S1.1. Ambas son independientes de la fecha/vencimiento original. Los históricos sin fecha real conservan sus datos: no se completan fechas automáticamente. Para el corte, una entrada histórica sin fecha usa su fecha de creación si coincide el mes o, en importaciones de otro mes, el inicio del período conocido. Revisar estos casos al ajustar el saldo inicial.
- Se puede quedar en negativo; se informa en la cuenta y en la respuesta de transferencias. Archivar con saldo exige confirmación explícita. No se elimina una cuenta con historial y su moneda no se cambia: se crea otra.

### Transferencias

- `TRANSFER`: misma moneda, mismos importes de salida y entrada.
- `CASH_WITHDRAWAL`: mismo usuario, finanza y moneda; crea Efectivo si falta.
- `BUY_USD`: ARS→USD o USD→ARS, con importes de ambas monedas y cotización ARS por USD inmutable.
- No son ingresos/gastos del presupuesto. No se editan; se pueden deshacer mediante DELETE, con autorización de ambas cuentas.

### Tarjetas y pagos

- La tarjeta pertenece a un usuario y a una finanza; compras y resúmenes se registran en esa finanza.
- Pagar un resumen crea `PlanCardPayment`, sin crear otro gasto `PlanEntry`. Se registra la cuenta y el importe efectivo por moneda. TOTAL admite pago USD separado o conversión a pesos con el tipo de cambio del mes. MINIMUM/CUSTOM conservan la decisión de pago existente.
- Deshacer el pago elimina los registros de pago y devuelve los saldos. No se modifica/reemplaza/elimina un resumen con pagos hasta deshacerlos. La confirmación concurrente no puede duplicar pagos.
- Movimientos muestra los pagos efectivos en su mes de pago y moneda, una sola vez. Los resúmenes históricos sin pago registrado conservan el fallback de S1.1 hasta completar el backfill.
- La fórmula de `buildSummary` no cambia: transferencias y pagos de resumen no se suman como nuevos gastos. Las líneas TDC siguen saliendo de los resúmenes/compras de la finanza activa.

### Traslados y origen

- Gasto/ingreso individual: se mueve el registro completo, con categoría equivalente y cuenta de destino de la misma moneda; sale de origen y aparece en destino. Se conservan los bloqueos de S1 para mover individualmente fijos/cuotas.
- Cuenta: mueve todas sus entradas y los pendientes de reglas/préstamos asociados. Las reglas/préstamos pasan a destino. Si una misma regla/préstamo usa otras cuentas, se rechaza toda la operación con 409 para no arrastrar recursos no elegidos ni perder integridad: primero hay que unificar esas entradas.
- Tarjeta: mueve compras, cuotas y resúmenes completos, con su historial de pagos.
- En ambos traslados se conservan los ids, importes, fechas, dueño y saldo. Los pagos y transferencias históricos conservan sus cuentas reales, aunque una contraparte permanezca en otra finanza; son referencias históricas, no permiso para operar entre finanzas. Cada movimiento efectivo queda clasificado una sola vez. Si posteriormente se traslada otro recurso asociado, ese traslado reclasifica su historial correspondiente.
- La marca `originFinanceName` guarda el nombre de la primera finanza desde la cual se trasladó el registro y se conserva en traslados sucesivos. No se confunde con `PlanEntry.source` de S3.
- Los traslados se ejecutan en una transacción y crean meses de destino faltantes con el tipo de cambio de origen. Se validan propiedad y permisos de escritura en origen y destino: la vista global de un recurso propio no concede permiso para reclasificar datos privados de una finanza donde se perdió el acceso.

## 4. Implementación técnica

### Prisma

Migración aditiva: `prisma/migrations/20261104220000_s2_single_finance/migration.sql`.

Nuevos modelos/enums:

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
model PlanAccount {
  id String @id @default(cuid())
  ownerUserId String
  householdId String
  name String
  type PlanAccountType @default(BANK)
  currency Currency @default(ARS)
  openingBalance Decimal @default(0) @db.Decimal(14, 2)
  openingDate DateTime? @db.Date
  isArchived Boolean @default(false)
  originFinanceName String?
  createdAt DateTime @default(now())
  owner User @relation(fields: [ownerUserId], references: [id])
  household Household @relation(fields: [householdId], references: [id])
  entries PlanEntry[]
  transfersOut PlanAccountTransfer[] @relation("TransferFrom")
  transfersIn PlanAccountTransfer[] @relation("TransferTo")
  payments PlanCardPayment[]
  @@index([householdId, currency, isArchived])
  @@index([ownerUserId])
}
model PlanAccountTransfer {
  originFinanceName String?
  id String @id @default(cuid())
  householdId String
  createdByUserId String
  kind PlanTransferKind
  fromAccountId String
  toAccountId String
  amountFrom Decimal @db.Decimal(14, 2)
  amountTo Decimal @db.Decimal(14, 2)
  rate Decimal? @db.Decimal(14, 4)
  date DateTime @db.Date
  note String?
  createdAt DateTime @default(now())
  household Household @relation(fields: [householdId], references: [id])
  from PlanAccount @relation("TransferFrom", fields: [fromAccountId], references: [id])
  to PlanAccount @relation("TransferTo", fields: [toAccountId], references: [id])
  @@index([fromAccountId, date])
  @@index([toAccountId, date])
}
model PlanCardPayment {
  id String @id @default(cuid())
  statementId String
  householdId String
  accountId String
  currency Currency
  amount Decimal @db.Decimal(14, 2)
  paidByUserId String
  paidAt DateTime @default(now())
  originFinanceName String?
  statement PlanCardStatement @relation(fields: [statementId], references: [id], onDelete: Cascade)
  household Household @relation(fields: [householdId], references: [id])
  account PlanAccount @relation(fields: [accountId], references: [id], onDelete: Restrict)
  @@unique([statementId, currency])
  @@index([accountId])
}
```

Adiciones a modelos existentes:

- `Card.ownerUserId` (nullable durante compatibilidad), relación con User, `originFinanceName`.
- `PlanEntry.accountId`, relación con PlanAccount, índice `(accountId, isDone)`, `paidAt` DATE nullable y `originFinanceName`.
- `PlanCardPurchase.originFinanceName` y `PlanCardStatement.originFinanceName`; este último tiene relación `payments`.
- Relaciones inversas en User/Household. No se agregan `AccountFinance` ni `CardFinance`.

### Backend y endpoints

Permisos centralizados en `src/lib/plan/access.ts`. Helpers: `accounts.ts`, `resource-moves.ts`, `statement-payments.ts` y DTOs en `account-types.ts`/`core.ts`.

| Método y ruta | Función |
|---|---|
| GET /api/plan/accounts | Catálogo; `activeOnly=1` limita a la activa; `financeId` exige acceso al destino |
| POST /api/plan/accounts | Crear `{name,type,currency,openingBalance,openingDate}` en la activa, con dueño de sesión |
| GET /api/plan/accounts/[id] | Cuenta, saldo e historial con enmascarado si corresponde |
| PATCH /api/plan/accounts/[id] | Editar nombre/tipo/saldo inicial/fecha; archivar o reactivar |
| DELETE /api/plan/accounts/[id] | Eliminar solo sin historial |
| POST /api/plan/accounts/[id]/move | `{toFinanceId}` con traslado completo |
| GET/POST /api/plan/account-transfers | Listar propias de la finanza / crear `{kind,fromAccountId,toAccountId?,amountFrom,amountTo?,date,note?}` |
| DELETE /api/plan/account-transfers/[id] | Deshacer transferencia |
| GET /api/plan/cards | Catálogo con saldos de resúmenes impagos; en Personal incluye las tarjetas propias de otras finanzas |
| POST/PATCH/DELETE /api/plan/cards[/id] | Crear y administrar tarjeta con dueño |
| POST /api/plan/cards/[id]/move | `{toFinanceId}` con historial |
| POST /api/plan/card-statements/[id]/pay | `{accountId,usdAccountId?}` |
| POST /api/plan/card-statements/[id]/unpay | Deshacer pagos |
| POST /api/plan/entries/move | Conserva S1 y agrega `accountId` o `accountIds: {ARS?,USD?}` para destino |

Entradas, cuotas históricas e inbox validan cuenta/finanza/moneda al confirmar. `ACCOUNT_REQUIRED=false` permite una transición para clientes anteriores; con `true`, un movimiento realizado sin cuenta se rechaza. La UI nueva solicita cuenta para operaciones realizadas. La API expone fecha real, cuenta, origen y pagos efectivos sin cambiar las sumas del presupuesto.

### Mobile y web

- Mobile: `mobile/src/features/accounts/` y rutas `/cuentas`, `/cuentas/[id]`, `/cuentas/transferir`, `/tarjetas-gestion`. Accesos desde Menú y Tarjetas.
- `AccountPicker` integrado con ingresos/gastos, edición, fijos y confirmación de cobros. Si no hay cuentas abre directamente `/cuentas/nueva`, conserva moneda/finanza y vuelve al formulario tras guardar. Un error al consultar cuentas no se presenta como una lista vacía. `AccountPaymentSheet` en fijos, deudas, tarjetas y notificaciones. El chat abre el formulario para revisar la cuenta antes de guardar.
- «Mover a finanza» permite elegir cuentas destino por moneda. Movimientos muestra cuenta y origen.
- Web: `/plan/cuentas`, `/plan/recursos-tarjetas` y `/plan/movimientos`; selectores en formularios, préstamos, inbox y pagos de tarjeta. Exportación incluye Cuenta, Finanza y Origen.
- Las pantallas nuevas de recursos operan contra la API; el modo mock conserva las pruebas de datos existentes, pero no persiste administración de recursos.

### Migración de históricos y despliegue

1. Aplicar la migración antes del backend que consulta las columnas/tablas nuevas. La app local que apunta a producción no puede crear cuentas hasta publicar S2 allí: `GET /api/plan/accounts` sin sesión debe responder 401; un 404 indica que el endpoint todavía no está publicado.
2. Publicar backend con `ACCOUNT_REQUIRED=false` durante la compatibilidad.
3. Simular `npx tsx prisma/backfill/s2-single-finance.ts` (por defecto no aplica; transacción con rollback). Revisar dueño asignado por tarjeta, cuentas, movimientos y pagos históricos. Si el dueño de una tarjeta histórica no pertenece a su finanza actual, revisar su asignación inicial antes de usar traslados: la vista propia no sustituye el permiso de origen.
4. Con la revisión y autorización de producción correspondientes, ejecutar con `--apply`. No se ha ejecutado contra producción durante este desarrollo.
5. El backfill crea/reutiliza cuentas por dueño, finanza y moneda; completa entradas hechas y dueños de tarjetas. Reconstruye pagos históricos usando el monto decidido y el tipo de cambio del mes, sin modificar los registros originales. Si falta fecha de pago o cotización necesaria, aborta para revisión; no inventa el dato.
6. Verificar saldos, ajustar saldos iniciales/fecha de corte y repetir simulación: cero cambios pendientes.
7. Publicar mobile con cuentas, probar y recién entonces activar `ACCOUNT_REQUIRED=true`; repetir backfill para movimientos de clientes anteriores.

Los borradores locales del diseño anterior se conservaron en `prisma/archive/s2-multifinance/` como `.reference`, fuera de migraciones ejecutables y de TypeScript. No se despliegan ni se ejecutan.

## 5. Tareas

1. Modelo y migración aditiva.
2. Backend de cuentas y cálculo de saldos.
3. Transferencias, efectivo y cambio de moneda.
4. Cuenta en operaciones existentes y fechas reales de pago/cobro.
5. Propiedad de tarjetas y pago/deshacer resumen.
6. Traslados con historial y marca de origen.
7. Pantallas mobile/web, selectores, catálogos y Movimientos.
8. Backfill idempotente y prueba en PostgreSQL temporal.
9. Regresión de permisos, tests, tipos, lint y build.
10. Validación funcional en iPhone y despliegue escalonado: pendientes al cierre local.

## 6. Verificación

Tests en `src/lib/plan/__int__/s2-single-finance.int.test.ts`: moneda/finanza/rol, saldos, transferencias, efectivo, cotización inmutable, pago/deshacer resumen, concurrencia, traslados de cuenta/tarjeta/movimiento, origen persistido, visibilidad propia/enmascarada, fecha de corte, fecha de pago real e idempotencia del backfill.

Se amplía la matriz de rutas de `finanzas.int.test.ts` y los tests de permisos/movimientos. La integración admite `TEST_DATABASE_URL` solo local, para evitar cambiar el destino de desarrollo. La prueba manual en iPhone debe recorrer crear cuenta → ingreso/gasto → pago de fijo/cuota/resumen → deshacer → traslado con origen → cambio de finanza.

## 7. Límites y decisiones de implementación

- No se atribuye automáticamente autoría a entradas históricas sin autor: se asigna la cuenta del dueño de la finanza y se revisa antes de aplicar.
- Los pagos de resúmenes históricos no revelan el nombre de una cuenta que quedó en otra finanza: muestran «Cuenta de origen».
- Trasladar una cuenta con un préstamo/regla repartido entre otras cuentas requiere unificar sus entradas primero; no se mueven recursos adicionales en silencio.
- La fecha real desconocida de operaciones antiguas no puede recuperarse del estado pagado. El saldo inicial/corte requiere revisión de esos históricos.
- Producción, backfill real, release mobile y prueba manual en iPhone no forman parte de la verificación local realizada.

## 8. Contrato para S3

S3 recibe pertenencia exclusiva por recurso, cuentas y saldos, fechas reales de cobro/pago, transferencias propias dentro de la finanza, pagos de tarjeta por moneda y procedencia en traslados. `EntryLink`, `FinanceCoverage` y `carryOver` deberán adaptarse a este modelo; no asumir cuentas compartidas ni un reparto de resúmenes por finanza. `originFinanceName` no reemplaza `source/refCode`.
