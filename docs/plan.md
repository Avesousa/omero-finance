# Plan de ejecución — omero-finance

> Generado a partir de `functional-analysis.md` + anotaciones en `functional-analysis-change.md`.
>
> Estado: `[ ]` pendiente · `[~]` en progreso · `[x]` completado
>
> Prioridad: **P0** bug/seguridad · **P1** corrección core · **P2** feature · **P3** módulo nuevo

---

## Índice de specs

| ID | Título | Fase | Prioridad | Estado | Depende de |
|---|---|---|---|---|---|
| [SPEC-001](#spec-001) | Loans auth — requireSession + householdId desde sesión | 0 | P0 | `[x]` | — |
| [SPEC-002](#spec-002) | TDC customAmount no debe forzar payMinimum | 0 | P0 | `[x]` | — |
| [SPEC-003](#spec-003) | TDC alerta a 3 días (no 7) | 0 | P0 | `[x]` | — |
| [SPEC-004](#spec-004) | Budget config heredada — indicador en UI | 0 | P1 | `[x]` | — |
| [SPEC-005](#spec-005) | Income model — USD nativo + amountArsSnapshot | 1 | P0 | `[ ]` | — |
| [SPEC-006](#spec-006) | Balance API — fórmula ARS/USD separados + comprometido vs pagado | 1 | P1 | `[ ]` | SPEC-005 |
| [SPEC-007](#spec-007) | Tipos de ingreso — CRUD dinámico | 1 | P2 | `[ ]` | — |
| [SPEC-008](#spec-008) | Modal de cambio de moneda (ARS↔USD) | 1 | P2 | `[ ]` | SPEC-005, SPEC-006 |
| [SPEC-009](#spec-009) | Dashboard — totalIncomeUsd visible | 2 | P1 | `[ ]` | SPEC-005 |
| [SPEC-010](#spec-010) | Gastos fijos — botón "marcar como pagado" | 2 | P1 | `[ ]` | — |
| [SPEC-011](#spec-011) | Dashboard — ahorros en USD visibles | 2 | P1 | `[ ]` | — |
| [SPEC-012](#spec-012) | Income close CTA — cierre de sueldos del mes | 2 | P2 | `[ ]` | — |
| [SPEC-013](#spec-013) | Categorías de presupuesto — renombrar y agregar custom | 2 | P2 | `[ ]` | — |
| [SPEC-014](#spec-014) | TDC — 8 modos de pago + amountToPayArs/Usd | 3 | P1 | `[ ]` | SPEC-002 |
| [SPEC-015](#spec-015) | TDC — múltiples pagos por statement | 3 | P2 | `[ ]` | SPEC-014 |
| [SPEC-016](#spec-016) | TDC — notificaciones de vencimiento | 3 | P2 | `[ ]` | SPEC-003 |
| [SPEC-017](#spec-017) | Módulo Pasivos | 4 | P3 | `[ ]` | SPEC-001 |
| [SPEC-018](#spec-018) | Módulo Patrimonio | 4 | P3 | `[ ]` | SPEC-017 |
| [SPEC-019](#spec-019) | Módulo Inversiones | 4 | P3 | `[ ]` | — |
| [SPEC-020](#spec-020) | Módulo Fondo de emergencia | 4 | P3 | `[ ]` | — |
| [SPEC-021](#spec-021) | Préstamos overhaul — TNA/TEA/UVA + cálculo en servidor | 4 | P2 | `[ ]` | SPEC-017 |
| [SPEC-022](#spec-022) | Módulo de perfil — editar email, clave y datos de usuario | 5 | P1 | `[ ]` | — |
| [SPEC-023](#spec-023) | Cierre de mes + PDF con resumen y charts | 5 | P2 | `[ ]` | SPEC-006, SPEC-012 |

---

## Fase 0 — Bugs y seguridad (sin cambios de schema)

### SPEC-001

**Loans auth — requireSession + householdId desde sesión**
Estado: `[ ]` · Prioridad: P0

**Problema**
`api/loans/route.ts` y `api/loans/[id]/installments/[num]/route.ts` no llaman `requireSession`. Los IDs de hogar y usuario están hardcodeados con constantes (`HOUSEHOLD_ID`, `AVELINO_ID`) importadas de `prisma/constants`.

**Cambios funcionales**
Ninguno visible para el usuario. Los préstamos dejan de ser accesibles sin sesión y pasan a pertenecer correctamente al hogar del usuario autenticado.

**Cambios técnicos**
- `api/loans/route.ts` — agregar `requireSession(req)` en GET y POST. Reemplazar `HOUSEHOLD_ID` → `session.user.householdId` y `AVELINO_ID` → `session.user.id`.
- `api/loans/[id]/route.ts` — ídem si no lo tiene.
- `api/loans/[id]/installments/[num]/route.ts` — agregar `requireSession(req)`.
- Eliminar el import de `HOUSEHOLD_ID` / `AVELINO_ID` del archivo de loans una vez que no se usen.

**Criterios de aceptación**
- GET /api/loans sin cookie → 401
- POST /api/loans sin cookie → 401
- PATCH /api/loans/:id/installments/:num sin cookie → 401
- Con cookie válida → comportamiento normal, filtrando por householdId de la sesión

---

### SPEC-002

**TDC customAmount no debe forzar payMinimum**
Estado: `[ ]` · Prioridad: P0

**Problema**
En `api/tdc/[id]/route.ts` línea 32–36, cuando se envía `customAmount`, el PATCH setea `payMinimum: true`. Esto hace que `tdcEffective()` en el dashboard lea `minimumPayment` en lugar del custom amount, mostrando el presupuesto incorrecto.

**Cambios técnicos**
- `api/tdc/[id]/route.ts` — en el bloque de `customAmount`, cambiar `payMinimum: true` → `payMinimum: false`.
- El `customAmount` debe guardarse en un campo propio (ya existe `committedOverride`) o en `amountToPay`. Definir en SPEC-014 cuál campo corresponde a cada modo.

**Criterios de aceptación**
- Setear un customAmount de $5000 en una TDC con minimum de $2000 → dashboard muestra $5000 en el presupuesto de TDC, no $2000.

---

### SPEC-003

**TDC alerta a 3 días (no 7)**
Estado: `[ ]` · Prioridad: P0

**Problema**
`lib/dashboard.ts:333` — la ventana de alerta es `now + 7 días`. La spec dice 3 días.

**Cambios técnicos**
- `lib/dashboard.ts` — cambiar `7 * 24 * 60 * 60 * 1000` → `3 * 24 * 60 * 60 * 1000`.

**Criterios de aceptación**
- TDC con due date en 4 días → no aparece en alertas
- TDC con due date en 2 días → aparece en alertas

---

### SPEC-004

**Budget config heredada — indicador en UI**
Estado: `[ ]` · Prioridad: P1

**Problema**
El GET de `/api/budget-config` retorna `inherited: true` cuando se usa la config de un mes anterior, pero la UI no lo indica. El usuario ve porcentajes que parecen del mes actual pero son de otro período.

**Cambios funcionales**
En la pantalla de presupuesto (`/mas/presupuesto`) mostrar un banner o badge cuando `inherited: true`:
> "Usando configuración de [mes anterior]. Guardá para fijar este mes."

**Cambios técnicos**
- `src/components/budget/` — leer el campo `inherited` de la respuesta y renderizar el banner condicionalmente.
- No hay cambios en el API.

**Criterios de aceptación**
- Primer mes sin config → banner visible con referencia al mes origen
- Después de guardar → `inherited: false`, banner desaparece

---

## Fase 1 — Core: modelo de moneda e ingresos

### SPEC-005

**Income model — USD nativo + amountArsSnapshot**
Estado: `[ ]` · Prioridad: P0

**Decisión de diseño**
Los dólares son dólares, no pesos. El fondo USD y el fondo ARS son independientes.

- `amount` + `currency` se mantienen (representan el monto en la moneda original).
- `amountArs` pasa a ser `amountArsSnapshot` — es informativo, representa el valor en pesos al momento de entrada. **No afecta cálculos de balance.**
- Si no hay tasa en DB al registrar un ingreso USD: llamar a la API de Bluelytics (`https://api.bluelytics.com.ar/v2/latest`), guardar la tasa en la tabla `ExchangeRate` y usar ese valor. Si Bluelytics falla, `amountArsSnapshot = null`.

**Cambios de schema (migración)**
```
// Income model
amountArs     Decimal?   →  amountArsSnapshot   Decimal?   (rename)
```

**Cambios en API**
- `api/income/route.ts` — remover la lógica de convertir USD a ARS. Agregar lógica de fallback a Bluelytics para el snapshot. Eliminar `targetUserId` (cada usuario carga su propio ingreso).
- `lib/dashboard.ts` — `totalIncomeArs` ahora solo suma ingresos con `currency = "ARS"`. Los USD no se convierten para el presupuesto ARS.
- `api/balance/route.ts` — ver SPEC-006.

**Función de fallback a Bluelytics**
```typescript
// lib/exchange-rate.ts (nuevo)
async function getOrFetchRate(): Promise<number | null> {
  const cached = await prisma.exchangeRate.findFirst({ orderBy: { date: "desc" } });
  if (cached && isToday(cached.date)) return Number(cached.usdArs);
  try {
    const res = await fetch("https://api.bluelytics.com.ar/v2/latest");
    const data = await res.json();
    const rate = data.blue.value_sell; // o value_avg según lo que usemos
    await prisma.exchangeRate.create({ data: { usdArs: rate, source: "API", date: new Date() } });
    return rate;
  } catch {
    return cached ? Number(cached.usdArs) : null;
  }
}
```

**Criterios de aceptación**
- Ingreso USD registrado → `amount = X`, `currency = USD`, `amountArsSnapshot = X × rateDelDía`
- Si Bluelytics responde → rate guardado en DB y usado en snapshot
- Ingreso ARS → `amount = X`, `currency = ARS`, `amountArsSnapshot = null`
- El campo `targetUserId` eliminado del form y del API

---

### SPEC-006

**Balance API — fórmula ARS/USD separados + comprometido vs pagado**
Estado: `[ ]` · Prioridad: P1 · Depende de: SPEC-005

**Nueva fórmula**
```
incomeUsd = Σ income donde currency = "USD"  → amount
incomeArs = Σ income donde currency = "ARS"  → amount

// Pagado = lo que ya salió
totalExpensesArs = fixedExpenses.amountArs (isPaid=true)
                 + groceryExpenses.amountArs
                 + householdExpenses.amountArs
                 + personalExpenses.amountArs
                 + creditCardStatements.amountToPay (isPaid=true, ARS)
totalExpensesUsd = creditCardStatements.amountToPayUsd (isPaid=true)

// Comprometido = pendiente de pago
totalComprometidoArs = creditCardStatements.amountToPay (isPaid=false, ARS)
                     + fixedExpenses pendientes (templateTotal − pagado)
totalComprometidoUsd = creditCardStatements.amountToPayUsd (isPaid=false)

totalArs = incomeArs − totalExpensesArs
totalUsd = incomeUsd − totalExpensesUsd
```

**Respuesta nueva**
```typescript
{
  totalArs:          number,  // disponible neto en ARS
  totalUsd:          number,  // disponible neto en USD
  rateHoy:           number,  // tipo de cambio del día
  comprometidoArs:   number,  // ARS pendientes de pago este mes
  comprometidoUsd:   number,  // USD pendientes de pago este mes
  totalExpensesArs:  number,  // ARS ya pagados este mes
  totalExpensesUsd:  number,  // USD ya pagados este mes
}
```

**Cambios técnicos**
- `api/balance/route.ts` — reescribir con la fórmula nueva.
- `src/components/quick-log/` y home — adaptar las tarjetas de balance para mostrar ARS y USD por separado.

**Criterios de aceptación**
- Si tengo $100.000 ARS de sueldo y gasté $30.000 ARS → totalArs = $70.000
- Si tengo $500 USD de ingreso y pagué TDC de $100 USD → totalUsd = $400
- Comprometido solo muestra lo que está pendiente de pago, no lo ya pagado

---

### SPEC-007

**Tipos de ingreso — CRUD dinámico**
Estado: `[ ]` · Prioridad: P2

**Decisión de diseño**
Los tipos de ingreso (`SUELDO`, `FREELANCE`, etc.) dejan de ser un enum hardcodeado y pasan a ser registros en DB editables por el usuario.

**Cambios de schema**
```prisma
model IncomeType {
  id          String   @id @default(cuid())
  householdId String
  household   Household @relation(...)
  name        String
  isDefault   Boolean  @default(false)  // tipos predefinidos que no se pueden borrar
  createdAt   DateTime @default(now())
}
```
Seed inicial con los 7 tipos actuales marcados como `isDefault = true`.

**API nueva**
- `GET /api/income-types` — lista los tipos del hogar
- `POST /api/income-types` — crea uno nuevo
- `DELETE /api/income-types/:id` — elimina si `isDefault = false`

**UI**
- Pantalla nueva en `/mas/ingresos` (o dentro de presupuesto) con listado y formulario de CRUD.
- El formulario de ingreso en Home pasa a cargar los tipos desde la API en lugar de tenerlos hardcodeados.

**Criterios de aceptación**
- Crear tipo "BONO" → aparece en el selector al cargar un ingreso
- Intentar borrar "SUELDO" → error (isDefault)
- Borrar tipo custom → desaparece del selector

---

### SPEC-008

**Modal de cambio de moneda (ARS↔USD)**
Estado: `[ ]` · Prioridad: P2 · Depende de: SPEC-005, SPEC-006

**Concepto**
Registrar cuándo se dolarizan o pesifican fondos para poder trackear el movimiento entre ambos fondos.

**Modelo de datos**
Se registra como un `Income` con el tipo `CAMBIO` y con ambos campos en positivo/negativo:

```
ARS → USD (dolarizo $1000 a $1 dólar):
  { type: "CAMBIO", currency: "ARS", amountArs: -1000, amountUsd: +1, dollarRateSnapshot: 1000 }

USD → ARS (pesifio $1 dólar a $1000):
  { type: "CAMBIO", currency: "USD", amountArs: +1000, amountUsd: -1, dollarRateSnapshot: 1000 }
```

Para soportar esto, `Income` necesita:
```prisma
amountUsd   Decimal?   // nuevo campo
amountArs   Decimal?   // antes era amountArsSnapshot, ahora puede ser negativo
```

**UI — Modal**
Accesible desde Home (botón "Cambiar" o similar). Campos:
1. Dirección: toggle "ARS → USD" / "USD → ARS"
2. Monto en pesos (ARS)
3. Monto en dólares (USD)
4. Tipo de cambio (pre-cargado con el último disponible)
5. Botón "Máximo" — completa el monto máximo del fondo origen

Cálculo en tiempo real: al ingresar pesos → calcula dólares (y vice versa) usando el tipo de cambio ingresado.

**Cambios en balance**
El cálculo del balance debe contemplar `amountArs` y `amountUsd` si están presentes en el registro:
```
fondoArs += income.amountArs ?? (currency=ARS ? amount : 0)
fondoUsd += income.amountUsd ?? (currency=USD ? amount : 0)
```

**Criterios de aceptación**
- Cambio de $100.000 ARS a $100 USD → fondoArs baja $100.000, fondoUsd sube $100
- El tipo de cambio usado queda guardado en el registro
- El botón "Máximo" completa con el totalArs o totalUsd disponible según la dirección

---

## Fase 2 — Mejoras del dashboard

### SPEC-009

**Dashboard — totalIncomeUsd visible**
Estado: `[ ]` · Prioridad: P1 · Depende de: SPEC-005

**Cambios funcionales**
En el dashboard mensual, junto al ingreso total en ARS, mostrar el ingreso en USD del mes (menos prominente, informativo).

**Cambios técnicos**
- `lib/dashboard.ts` — agregar:
  ```typescript
  totalIncomeUsd = Σ incomes donde currency = "USD" → amount
  ```
- `DashboardData` — agregar campo `totalIncomeUsd: number`.
- UI del dashboard — mostrar debajo del totalIncomeArs.

---

### SPEC-010

**Gastos fijos — botón "marcar como pagado"**
Estado: `[ ]` · Prioridad: P1

**Problema (D-1)**
El presupuesto de GASTOS_FIJOS usa los templates como "budgeted" pero el "used" viene de registros reales de `FixedExpense`. Si solo existe el template y nunca se registra el gasto real, el available aparece disponible aunque el dinero ya salió.

**Nuevo flujo**
Cada template en la lista de gastos fijos tiene un estado mensual: `PENDING` / `PAID`.
- Al presionar "Marcar como pagado" en un template, el sistema crea automáticamente un `FixedExpense` con el monto del template para el mes actual.
- La lista muestra el estado visual: chip verde "Pagado" / chip amarillo "Pendiente".

**Cambios de schema**
```prisma
model FixedExpenseTemplate {
  // agregar relación inversa para ver qué meses tiene registros
}
// El FixedExpense ya existe — solo agregar el templateId como FK opcional
model FixedExpense {
  templateId   String?
  template     FixedExpenseTemplate? @relation(...)
}
```

**API**
- `POST /api/fixed-templates/:id/pay` — crea el `FixedExpense` del mes actual usando el monto del template. Idempotente (si ya existe, retorna el existente).
- `DELETE /api/fixed-templates/:id/pay?month=X&year=Y` — desmarca (elimina el FixedExpense asociado).

**UI**
- Lista de gastos fijos en `/mas/gastos-fijos` — cada ítem muestra badge de estado y botón toggle "Pagar / Desmarcar".
- El dashboard de GASTOS_FIJOS `budgeted` sigue siendo el total de templates. `used` = Σ FixedExpense del mes (que ahora tiene trazabilidad al template).

**Criterios de aceptación**
- Template "Internet $15.000" sin pagar → used = 0, available = 15.000, badge "Pendiente"
- Presionar "Marcar como pagado" → crea FixedExpense, used = 15.000, available = 0, badge "Pagado"
- Desmarcar → elimina el FixedExpense, estado vuelve a Pendiente

---

### SPEC-011

**Dashboard — ahorros en USD visibles**
Estado: `[ ]` · Prioridad: P1

**Problema (D-3)**
El query de savings en `lib/dashboard.ts` filtra `currency: "ARS"`, por lo que un ahorro en dólares no aparece en el dashboard.

**Cambios técnicos**
- `lib/dashboard.ts` — remover el filtro `currency: "ARS"` del query de savings.
- Para el `usedArs` de las categorías de ahorro, convertir los savings en USD usando el snapshot:
  ```typescript
  savingArsValue = saving.currency === "ARS"
    ? saving.amount
    : saving.amountArsSnapshot ?? saving.amount * exchangeRate
  ```
- Mostrar en la fila del dashboard tanto el monto ARS como USD si existen.

---

### SPEC-012

**Income close CTA — cierre de sueldos del mes**
Estado: `[ ]` · Prioridad: P2

**Problema**
El porcentaje de responsabilidad por categoría (`user.percentage`) se recalcula en cada request usando los sueldos del mes. Si a mitad de mes entra un sueldo extra, el porcentaje cambia retroactivamente.

**Decisión de diseño**
Agregar un "cierre de ingresos" mensual que fija los porcentajes para ese mes.

**Cambios de schema**
```prisma
model IncomePeriodClose {
  id           String   @id @default(cuid())
  householdId  String
  month        String
  year         Int
  closedAt     DateTime @default(now())
  userSplits   Json     // { userId: percentage } snapshot
  @@unique([householdId, month, year])
}
```

**Flujo**
1. Usuario presiona "Cerrar ingresos del mes" (botón en dashboard o en home).
2. El sistema calcula los porcentajes actuales y los persiste en `IncomePeriodClose`.
3. A partir de ese momento, el dashboard lee los porcentajes del snapshot en lugar de recalcularlos.
4. Si no hay cierre → sigue calculando en tiempo real (comportamiento actual).

**API**
- `POST /api/income-close` — crea el snapshot del mes actual.
- `DELETE /api/income-close/:id` — reabre el período (para correcciones).

**UI**
- Banner en el dashboard cuando el período está abierto: "Ingresos del mes no cerrados — los porcentajes pueden cambiar."
- CTA "Cerrar período" que abre un modal confirmando los porcentajes calculados.

---

### SPEC-013

**Categorías de presupuesto — renombrar y agregar custom**
Estado: `[ ]` · Prioridad: P2

**Decisión de diseño**
- Las 8 categorías actuales son renombrables pero no eliminables.
- Se pueden agregar categorías custom.
- Una categoría custom no existente en meses anteriores toma `budgeted = 0` y `used = 0` para esos meses.

**Cambios de schema**
```prisma
model BudgetCategory {
  id           String   @id @default(cuid())
  householdId  String
  key          String   // slug único: "MERCADO", "MI_CATEGORIA", etc.
  label        String   // nombre visible
  isDefault    Boolean  @default(false)
  isReserved   Boolean  @default(true)
  order        Int      // orden en el dashboard
  @@unique([householdId, key])
}
```

El enum `BudgetCategory` en Prisma se reemplaza por referencias al modelo.

**Criterios de aceptación**
- Renombrar "Mercado" → "Super + Feria" → dashboard muestra el nuevo nombre
- Agregar categoría "Mascotas" → aparece en dashboard con $0 budgeted hasta configurarla
- Meses anteriores sin la categoría → `budgeted = 0`, `used = 0` (sin error)

---

## Fase 3 — TDC overhaul

### SPEC-014

**TDC — 8 modos de pago + amountToPayArs/Usd**
Estado: `[ ]` · Prioridad: P1 · Depende de: SPEC-002

**Los 8 modos de uso**

| # | Modo | Presupuesto saludable | Descripción |
|---|---|---|---|
| 1 | `MINIMO` | ✅ | Solo el pago mínimo en ARS |
| 2 | `MINIMO_MAS_USD` | ✅ | Pago mínimo ARS + monto en USD |
| 3 | `TOTAL` | ✅ | Monto total ARS |
| 4 | `TOTAL_MAS_USD` | ✅ | Monto total ARS + monto en USD |
| 5 | `CUSTOM_MAYOR` | ✅ | Monto custom > mínimo, solo ARS |
| 6 | `CUSTOM_MAYOR_MAS_USD` | ✅ | Monto custom > mínimo + USD |
| 7 | `CUSTOM_MENOR_MAS_USD` | ⚠️ | Monto custom < mínimo + USD (riesgo mora) |
| 8 | `CUSTOM_MENOR` | ⚠️ | Monto custom < mínimo (riesgo mora) |

Solo los modos 1–6 se usan para armar el presupuesto. Los modos 7–8 son informativos con advertencia visual.

**Nueva lógica `tdcEffective`**
```
paymentMode = MINIMO            → amountToPayArs = minimumPayment
paymentMode = MINIMO_MAS_USD    → amountToPayArs = minimumPayment; amountToPayUsd = usdAmount
paymentMode = TOTAL             → amountToPayArs = totalAmountArs
paymentMode = TOTAL_MAS_USD     → amountToPayArs = totalAmountArs; amountToPayUsd = usdAmount
paymentMode = CUSTOM_MAYOR      → amountToPayArs = customAmount (> minimumPayment)
paymentMode = CUSTOM_MAYOR_MAS_USD → amountToPayArs = customAmount; amountToPayUsd = usdAmount
paymentMode = CUSTOM_MENOR_MAS_USD → amountToPayArs = customAmount; amountToPayUsd = usdAmount; ⚠️
paymentMode = CUSTOM_MENOR      → amountToPayArs = customAmount; ⚠️
```

**Cambios de schema**
```prisma
model CreditCardStatement {
  // Nuevos campos
  paymentMode      String?    // enum: los 8 modos
  amountToPayArs   Decimal?   // monto ARS a pagar (calculado según modo)
  amountToPayUsd   Decimal?   // monto USD a pagar (si aplica)
  // Deprecar/eliminar: customAmount, committedOverride, payMinimum (reemplazados por paymentMode)
}
```

**Cambios en dashboard**
`tdcEffective` pasa a leer `paymentMode` + `amountToPayArs` + `amountToPayUsd`.

**Criterios de aceptación**
- Seleccionar modo MINIMO → dashboard muestra minimumPayment en TDC budgeted
- Seleccionar modo TOTAL_MAS_USD → dashboard muestra totalAmountArs + (usdAmount × rate)
- Modo CUSTOM_MENOR → badge de advertencia "Riesgo de mora" en la UI de TDC

**Aclaración sobre "Pago con débito de cuenta" (hoy existente)**
Esta feature permite que al marcar una TDC como pagada, se descuente el monto de una cuenta bancaria (ej: acreditar desde caja de ahorro). Se ve en `/tdc` al marcar "isPaid", donde aparece un selector de cuenta y se hace una transacción atómica: update statement + decrement balance de la cuenta. Se mantiene en SPEC-015.

---

### SPEC-015

**TDC — múltiples pagos por statement**
Estado: `[ ]` · Prioridad: P2 · Depende de: SPEC-014

**Problema**
Actualmente un statement tiene un solo `isPaid` / `paidAt`. En la práctica, en un mes pueden hacerse varios pagos parciales a la misma tarjeta.

**Decisión de diseño**
```prisma
model CreditCardPayment {
  id            String   @id @default(cuid())
  statementId   String
  statement     CreditCardStatement @relation(...)
  amount        Decimal
  currency      String   @default("ARS")
  amountArs     Decimal?
  dollarRateSnapshot Decimal?
  paidAt        DateTime @default(now())
  accountId     String?  // cuenta desde la que se pagó
  notes         String?
}
```

`CreditCardStatement` mantiene `isPaid` como flag de "cerrado/completado", pero el historial real de pagos vive en `CreditCardPayment`.

**API**
- `POST /api/tdc/:id/payments` — registrar un pago parcial o total
- `GET /api/tdc/:id/payments` — historial de pagos del statement
- `DELETE /api/tdc/:id/payments/:paymentId` — deshacer un pago

**Criterios de aceptación**
- Pagar $5.000 en enero y $10.000 en febrero del mismo statement → dos registros en payments
- El statement no se marca como isPaid hasta que el usuario lo confirme explícitamente
- El historial de pagos es visible en la pantalla de TDC

---

### SPEC-016

**TDC — notificaciones de vencimiento**
Estado: `[ ]` · Prioridad: P2 · Depende de: SPEC-003

**Decisión de diseño**
Sin infraestructura push (no hay service worker ni push notifications en MVP), la notificación es una alerta in-app: banner persistente en Home y Dashboard cuando hay TDCs próximas a vencer.

**Futuro (v2)**: evaluar Web Push API o email via Resend/SendGrid.

**Implementación MVP**
- Al cargar Home o Dashboard, el sistema verifica TDCs no pagadas con `dueDate ≤ now + 3 días`.
- Si hay alguna → banner rojo fijo en la parte superior: "⚠️ Tenés [N] tarjeta(s) por vencer en los próximos 3 días."
- Click en el banner → navega a `/tdc`.

**Cambios técnicos**
- El endpoint `/api/dashboard` ya retorna `tdcAlerts`. El mismo campo puede usarse en Home.
- Agregar endpoint ligero `GET /api/tdc/alerts` que retorne solo los alertas sin necesidad de calcular el dashboard completo.
- `src/components/layout/` — componente `TdcAlertBanner` que se monta en el layout raíz.

---

## Fase 4 — Módulos nuevos

### SPEC-017

**Módulo Pasivos**
Estado: `[ ]` · Prioridad: P3

**Qué es**
Vista consolidada de todo lo que se debe: TDC total (aunque no se vaya a pagar completo), préstamos vigentes, y deudas registradas.

**Secciones**

| Sección | Fuente de datos | Descripción |
|---|---|---|
| TDC | CreditCardStatement | Total de todos los statements sin pagar del mes + histórico de deuda acumulada |
| Préstamos tomados | Loan donde direction=TOMADO | Capital pendiente + próxima cuota |
| Deudas | Debt | Deudas registradas activas |

**Pantalla: `/mas/pasivos`**
- Total pasivos ARS + USD
- Lista por sección con estado de cada ítem
- Próximos vencimientos ordenados por fecha

**Criterios de aceptación**
- TDC impaga de $50.000 → aparece en Pasivos
- Préstamo tomado con 6 cuotas pendientes de $10.000 c/u → muestra $60.000 pendiente y próxima cuota
- Al pagar la TDC → desaparece del total de pasivos

---

### SPEC-018

**Módulo Patrimonio**
Estado: `[ ]` · Prioridad: P3 · Depende de: SPEC-017

**Fórmula**
```
Activos:
  + fondoArs (balance disponible ARS)
  + fondoUsd × rateHoy (balance disponible USD en ARS)
  + Σ ahorros activos (ARS + USD × rate)
  + Σ deudas a cobrar (Debt donde direction=A_COBRAR)
  + Σ préstamos dados (Loan donde direction=DADO) capital pendiente

Pasivos:
  − Σ TDC sin pagar (total, no solo mínimo)
  − Σ préstamos tomados capital pendiente
  − Σ deudas registradas activas

PN = Activos − Pasivos
```

**Pantalla: `/mas/patrimonio`**
- Tarjeta principal: Patrimonio Neto
- Breakdown activos vs pasivos
- Evolución mes a mes (sparkline o tabla)

**Nota sobre alquiler**
El alquiler no entra al patrimonio directamente (es un gasto operativo). Sí entra si se registra como gasto fijo y afecta el balance disponible. La pantalla de alquiler (`/mas/alquiler`) sigue siendo para tracking/visualización del alquiler como línea de costo mensual.

---

### SPEC-019

**Módulo Inversiones**
Estado: `[ ]` · Prioridad: P3

**Concepto**
Trackear el rendimiento de inversiones: cuánto se invirtió al principio del período y cuánto hay al final, para ver crecimiento pasivo.

**Tipos de activos**
- Plazo fijo (ARS o USD)
- Acciones / ETFs
- Bonos
- Cripto
- Otros

**Schema**
```prisma
model Investment {
  id            String   @id @default(cuid())
  householdId   String
  userId        String
  assetType     String   // PLAZO_FIJO, ACCIONES, BONOS, CRIPTO, OTRO
  assetName     String   // "AAPL", "BTC", "Plazo Fijo Galicia"
  currency      String
  amountInvested Decimal  // cuánto se puso
  currentValue  Decimal?  // cuánto hay ahora (actualización manual)
  platform      String?   // "IOL", "Lemon", "Ripio"
  openedAt      DateTime
  closedAt      DateTime?
  notes         String?
}

model InvestmentSnapshot {
  id            String   @id @default(cuid())
  investmentId  String
  month         String
  year          Int
  value         Decimal
  currency      String
  recordedAt    DateTime @default(now())
}
```

**Pantalla: `/mas/inversiones`**
- Resumen: total invertido vs valor actual → ganancia/pérdida en $ y %
- Por activo: tabla con columnas (Activo, Plataforma, Invertido, Valor actual, Ganancia)
- Vista mensual: gráfico de evolución por mes (usando snapshots)
- Soporte ARS y USD en paralelo

---

### SPEC-020

**Módulo Fondo de emergencia**
Estado: `[ ]` · Prioridad: P3

**Concepto**
Subcategoría especial de ahorro. Tenés fondos en USD que generan ~3.8% anual. Querés ver su evolución mes a mes.

**Decisión de diseño**
El fondo de emergencia es un `Saving` con `type = AHORRO` y un tag especial, o directamente un filtro de la cuenta/plataforma. Evaluar si necesita modelo propio o alcanza con filtrar Savings.

**Opción A (simpler):** tag `isFondoEmergencia: Boolean` en `Saving`.
**Opción B (explicit):** modelo `EmergencyFund` con campos: `initialAmount`, `currency`, `annualRate`, `startDate`, y snapshots mensuales calculados.

**Recomendación:** Opción B para poder calcular el crecimiento automático.

**Schema (Opción B)**
```prisma
model EmergencyFund {
  id           String   @id @default(cuid())
  householdId  String
  name         String   @default("Fondo de emergencia")
  currency     String   @default("USD")
  amount       Decimal  // monto actual
  annualRate   Decimal  @default(0.038)  // 3.8% anual
  startDate    DateTime
  snapshots    EmergencyFundSnapshot[]
}

model EmergencyFundSnapshot {
  id        String   @id @default(cuid())
  fundId    String
  month     String
  year      Int
  amount    Decimal
  interest  Decimal  // intereses acumulados ese mes
}
```

**Cálculo de interés mensual**
```
monthlyRate = (1 + annualRate)^(1/12) − 1
interestMes = amount × monthlyRate
nuevoAmount = amount + interestMes
```

**Pantalla: `/mas/fondo-emergencia`**
- Monto actual en USD + equivalente ARS
- Rendimiento acumulado desde inicio
- Tabla mes a mes: monto inicio, intereses, monto fin

---

### SPEC-021

**Préstamos overhaul — TNA/TEA/UVA + cálculo en servidor**
Estado: `[ ]` · Prioridad: P2 · Depende de: SPEC-017

**Tipos de préstamo**

| Tipo | Descripción |
|---|---|
| `FIJO` | Cuota fija en ARS o USD, TNA/TEA conocida |
| `UVA` | Cuota ajustada por UVA (Unidad de Valor Adquisitivo) |
| `INFORMAL` | Sin interés o interés acordado manualmente |

**Campos nuevos en Loan**
```prisma
model Loan {
  // Existentes: direction, counterpart, currency, principal, installments, totalAmount...
  // Nuevos:
  loanType         String    // FIJO, UVA, INFORMAL
  tna              Decimal?  // Tasa Nominal Anual (ej: 0.60 = 60%)
  tea              Decimal?  // Tasa Efectiva Anual
  cftea            Decimal?  // Costo Financiero Total
  uvaBase          Decimal?  // valor UVA al momento del préstamo
  firstDueDate     DateTime? // fecha de la primera cuota
  autoDebitAccount String?   // cuenta de débito automático
}
```

**Cálculo de cuota fija (sistema francés)**
```
i = TNA / 12
cuota = principal × (i × (1+i)^n) / ((1+i)^n − 1)
```

**Cálculo UVA**
```
cuotaBase = cuotaInicial en UVA
cuotaMes  = cuotaBase × UVAActual / UVABase
```
Para UVA actual se necesita integración con BCRA (API pública). Agregar `GET /api/exchange-rate?type=UVA` que consulte el BCRA y cachee en `ExchangeRate` con `source = "BCRA"`.

**Cálculo en servidor (L-3)**
- Al crear un préstamo de tipo FIJO con TNA: el servidor calcula `totalAmount` y `amountPerInstallment` usando la fórmula francesa.
- El cliente solo envía `principal`, `tna`, `installments`, `firstDueDate`.

**Aviso automático de cuota**
- Al cargar el dashboard o home, si hay una cuota con `dueDate ≤ now + 7 días` → aparecer en las alertas junto a TDC.

---

## Fase 5 — Perfil y cierre de mes

### SPEC-022

**Módulo de perfil — editar email, clave y datos de usuario**
Estado: `[ ]` · Prioridad: P1

**Contexto**
No existe actualmente ninguna pantalla para que el usuario edite sus datos. La única forma de cambiar email o clave es editando directamente la DB o usando el seed.

**Pantalla: `/mas/perfil`**

Secciones:

**1. Datos personales**
- Nombre display
- Email actual → campo editable + botón "Guardar"
- Color de avatar → picker de colores (misma paleta que el sistema de avatares actual)

**2. Cambiar contraseña**
Flujo separado del resto para mayor seguridad:
- Input: Contraseña actual
- Input: Nueva contraseña
- Input: Confirmar nueva contraseña
- Validación: nueva ≠ actual, min 8 caracteres, confirmación coincide
- No se muestra la contraseña actual en ningún momento

**3. Info del hogar** (solo lectura por ahora)
- Nombre del hogar
- Tipo (`PERSONAL`, `SHARED`, etc.)
- Miembros del hogar: lista con nombre + avatar color + rol

**API nueva**

```
PATCH /api/auth/profile
Body: { name?, email? }
→ Actualiza name y/o email del usuario autenticado
→ Si se cambia email: verificar que no esté en uso por otro usuario del mismo hogar

PATCH /api/auth/password
Body: { currentPassword, newPassword }
→ Valida currentPassword con bcrypt.compare()
→ Si válida: hashea newPassword y actualiza
→ Si inválida: 401 con mensaje "Contraseña actual incorrecta"

PATCH /api/auth/avatar
Body: { avatarColor }
→ Actualiza solo el color de avatar
```

**Cambios técnicos**
- `src/app/mas/perfil/page.tsx` — página nueva
- `src/components/profile/` — carpeta nueva con `ProfileForm`, `PasswordForm`, `HouseholdInfo`
- Los tres endpoints PATCH usan `requireSession` y operan sobre el `userId` de la sesión
- `PATCH /api/auth/profile` — si se cambia el email, la sesión activa sigue siendo válida (no requiere re-login)
- El token de sesión no cambia al editar perfil (solo cambian los datos del usuario en DB)

**Cambios de schema**
Ninguno. Los campos `name`, `email`, `passwordHash`, `avatarColor` ya existen en `User`.

**Criterios de aceptación**
- Cambiar nombre → se refleja en el avatar y en el saludo del home sin re-login
- Cambiar email → login con email nuevo funciona, login con email viejo falla
- Contraseña actual incorrecta → error claro en UI, no se actualiza nada
- Contraseña nueva < 8 caracteres → error de validación en cliente antes de enviar
- Confirmar contraseña no coincide → error de validación en cliente
- Cambiar avatar color → se refleja inmediatamente en toda la app

---

### SPEC-023

**Cierre de mes + PDF con resumen y charts**
Estado: `[ ]` · Prioridad: P2 · Depende de: SPEC-006, SPEC-012

**Concepto**
Al final de cada mes, el usuario puede "cerrar" el período. El cierre hace tres cosas:
1. Congela los datos del mes (snapshot histórico)
2. Resuelve los pendientes: qué deudas se heredan al mes siguiente
3. Decide el destino del superávit si hay saldo positivo
4. Genera un PDF descargable con el resumen visual del mes

**Flujo completo del cierre**

```
CTA "Cerrar mes" (en dashboard, visible solo si el mes es el actual)
  ↓
PASO 1 — Revisión de pendientes
  Lista de ítems sin resolver:
  - TDC sin pagar (por tarjeta: nombre, monto, vencimiento)
  - Gastos fijos marcados como pendientes
  - Cuotas de préstamos vencidas o por vencer
  
  Acción por ítem:
  [Heredar al mes siguiente]  →  se copia el ítem como deuda del próximo mes
  [Marcar como pagado]        →  resuelto ahora antes de cerrar
  [Ignorar / Perdonar]        →  se cierra sin impacto (con confirmación)
  ↓
PASO 2 — Destino del superávit (solo si totalArs > 0 o totalUsd > 0)
  "Te queda un saldo de $X ARS y $Y USD este mes. ¿Qué hacés con él?"
  
  Opciones (múltiple selección con montos parciales):
  [ ] Dejarlo disponible para el mes siguiente  →  no hace nada
  [ ] Agregar al Fondo de emergencia            →  crea Saving tipo AHORRO en el fondo
  [ ] Agregar a Inversiones                     →  crea registro en Investment
  [ ] Pagar deuda extra (TDC / préstamo)        →  selector de deuda + monto
  
  Si el usuario elige distribuir: inputs de monto para cada opción.
  Validación: Σ montos asignados ≤ superávit disponible.
  ↓
PASO 3 — Preview del PDF + descarga
  Vista previa del resumen del mes con charts.
  Botón "Descargar PDF"
  ↓
PASO 4 — Confirmación del cierre
  Botón "Cerrar mes definitivamente"
  Crea el registro MonthClose en DB
  El dashboard del mes cerrado muestra badge "Cerrado" y es de solo lectura
```

**Schema — cierre de mes**

```prisma
model MonthClose {
  id           String   @id @default(cuid())
  householdId  String
  month        String
  year         Int
  closedAt     DateTime @default(now())
  closedById   String
  surplusArs   Decimal  // superávit en ARS al momento del cierre
  surplusUsd   Decimal  // superávit en USD
  surplusAllocation Json // { emergencyFund: X, investment: X, nextMonth: X, debtPayment: X }
  pdfUrl       String?  // URL del PDF generado (si se guarda en Object Storage)
  @@unique([householdId, month, year])
}

model InheritedDebt {
  id              String   @id @default(cuid())
  householdId     String
  fromMonth       String
  fromYear        Int
  toMonth         String
  toYear          Int
  sourceType      String   // TDC, GASTO_FIJO, PRESTAMO
  sourceId        String   // ID del registro original
  amountArs       Decimal?
  amountUsd       Decimal?
  description     String
  isResolved      Boolean  @default(false)
  resolvedAt      DateTime?
}
```

**Generación del PDF**

Librería: `@react-pdf/renderer` (server-side en Next.js, sin DOM dependency).

Para los charts dentro del PDF, `@react-pdf/renderer` no soporta canvas/SVG de Recharts directamente. Estrategia:
1. En el cliente, renderizar los charts con Recharts y capturarlos como imágenes PNG usando `html2canvas`.
2. Enviar las imágenes en base64 al endpoint de generación.
3. El servidor embebe las imágenes en el PDF con `@react-pdf/renderer`.

**Contenido del PDF**

```
PORTADA
  Logo / nombre app
  "[Mes] [Año]" en grande
  Nombre del hogar

PÁGINA 1 — Resumen ejecutivo
  ┌─────────────────────────────────────────┐
  │ Ingresos totales    $X ARS   $Y USD     │
  │ Gastos totales      $X ARS   $Y USD     │
  │ Superávit / Déficit $X ARS              │
  └─────────────────────────────────────────┘
  Split por usuario: tabla Avelino vs Maria
    (% de ingresos, % de gastos, saldo individual)

PÁGINA 2 — Presupuesto vs real (chart de barras)
  Barra por categoría: Presupuestado vs Gastado
  Colores: verde (dentro del budget) / rojo (overspent)
  Pie chart: distribución de gastos por categoría

PÁGINA 3 — Detalle TDC
  Por tarjeta: nombre, total del mes, estado de pago, modo de pago elegido
  Total TDC del mes

PÁGINA 4 — Movimientos destacados
  Top 5 gastos más grandes del mes
  Ahorros e inversiones del mes
  Préstamos pagados

PÁGINA 5 — Patrimonio al cierre
  Balance ARS / USD
  Deudas heredadas al mes siguiente (si hay)
  Destino del superávit (si hubo asignación)

PIE DE PÁGINA en todas las páginas
  "omero-finance · [Mes] [Año] · Generado el [fecha]"
```

**API**

```
POST /api/month-close
Body: { month, year, inheritedItems[], surplusAllocation{} }
→ Valida que no exista ya un cierre para ese mes/año
→ Crea InheritedDebt por cada ítem heredado
→ Ejecuta las acciones de superávit (crea Savings / Investment según elección)
→ Crea MonthClose con el snapshot
→ Retorna { ok: true, closeId }

GET /api/month-close?month=X&year=Y
→ Retorna el cierre si existe (para saber si el mes está cerrado)

POST /api/month-close/:id/pdf
Body: { chartImages: { [chartKey]: base64png } }
→ Genera el PDF con @react-pdf/renderer + imágenes embebidas
→ Retorna el PDF como application/pdf (o lo guarda y retorna URL)

DELETE /api/month-close/:id
→ Reabre el mes (elimina el MonthClose, NO los registros de deudas heredadas ni savings)
→ Solo ADMIN del hogar puede hacerlo
```

**Cambios técnicos**
- `npm install @react-pdf/renderer html2canvas` 
- `src/app/mas/cierre/page.tsx` — wizard de 4 pasos (stepper)
- `src/components/month-close/` — `PendingItemsList`, `SurplusAllocator`, `PdfPreview`
- `src/app/api/month-close/` — endpoints de cierre y PDF
- `src/lib/pdf/` — componentes de `@react-pdf/renderer` para el informe
- Dashboard: badge "Cerrado" en el selector de mes cuando `MonthClose` existe; deshabilitar edición

**Criterios de aceptación**
- Mes sin pendientes → Paso 1 muestra "Todo al día ✓" y avanza automáticamente
- TDC heredada → aparece en el mes siguiente como deuda con badge "Heredada de [mes]"
- Superávit de $50.000 ARS → puedo asignar $30.000 al fondo de emergencia y $20.000 quedan disponibles
- PDF descargado → contiene todos los charts y datos del mes
- Mes cerrado → badge en el selector, formularios del mes deshabilitados
- Reabrir mes → cierre eliminado, mes vuelve a ser editable (datos originales intactos)

---

## Notas generales de implementación

### Orden sugerido de ejecución

```
Fase 0 (P0): SPEC-001 → SPEC-002 → SPEC-003  (en paralelo, independientes)
             SPEC-004 (puede ir con la fase 0)

Fase 1 (core): SPEC-005 primero (afecta modelo base)
               → SPEC-006 (depende del modelo)
               → SPEC-007, SPEC-008 (independientes entre sí, dependen de SPEC-005)

Fase 2: SPEC-009, SPEC-010, SPEC-011 (pueden ir en paralelo)
        SPEC-012, SPEC-013 (independientes)

Fase 3: SPEC-014 → SPEC-015 → SPEC-016

Fase 4: SPEC-017 → SPEC-018 (Patrimonio necesita Pasivos)
        SPEC-019, SPEC-020 (independientes)
        SPEC-021 (puede ir con SPEC-017)

Fase 5: SPEC-022 (independiente, se puede hacer en cualquier momento)
        SPEC-023 (depende de SPEC-006 y SPEC-012 para tener los datos correctos)
```

### Migraciones de schema a coordinar

Antes de cualquier migración, hacer backup de la DB en Neon.

| Migration | Specs que la requieren |
|---|---|
| `rename_amountArs_to_amountArsSnapshot` + `add_amountUsd` en Income | SPEC-005, SPEC-008 |
| `add_paymentMode` + `add_amountToPayArs/Usd` en CreditCardStatement | SPEC-014 |
| `create_CreditCardPayment` | SPEC-015 |
| `create_IncomeType` model | SPEC-007 |
| `create_IncomePeriodClose` | SPEC-012 |
| `create_BudgetCategory` model | SPEC-013 |
| `create_Investment` + `InvestmentSnapshot` | SPEC-019 |
| `create_EmergencyFund` + snapshots | SPEC-020 |
| `add_loanType` + `tna/tea` + `uvaBase` en Loan | SPEC-021 |
| `create_MonthClose` + `InheritedDebt` | SPEC-023 |
