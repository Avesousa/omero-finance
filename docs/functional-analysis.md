# Análisis Funcional — omero-finance

> Documento vivo. Actualizarlo a medida que se corrigen issues o cambia la lógica.
>
> Estado: `[ ]` pendiente · `[~]` en progreso · `[x]` resuelto

---

## 1. Ingresos (`/api/income`)

### Lógica de registro

- **ARS:** `amount` y `amountArs` se guardan con el mismo valor.
- **USD:** se busca el tipo de cambio más reciente en DB → `amountArs = amount × dollarRateSnapshot`. Si no hay tasa en DB, `amountArs` queda `undefined`.

### Tipos disponibles

`SUELDO` · `FREELANCE` · `AHORROS` · `PAGO_DEUDA` · `REMANENTES` · `PRESTAMO` · `INVERSION`

El campo `isPersonal` separa si el ingreso pertenece al hogar o a un usuario específico.
`targetUserId` permite registrar un ingreso a nombre de otro miembro del hogar.

### Issues

| # | Estado | Descripción |
|---|---|---|
| I-1 | `[ ]` | Ingreso USD sin tasa en DB → `amountArs` queda `undefined`. Ese ingreso no suma al balance ni al dashboard. |

---

## 2. Balance disponible (`/api/balance`)

### Fórmula

```
fondoUsd  = Σ ingresos USD donde amountArs IS NULL  (sin convertir)
incomeArs = Σ ingresos ARS + Σ ingresos USD donde amountArs IS NOT NULL

totalExpenses = fixedExpenses.amountArs
              + groceryExpenses.amountArs
              + householdExpenses.amountArs
              + personalExpenses.amountArs
              + tdcPagadas.amountToPay   (solo isPaid = true)
              → cada línea usa amountArs ?? amount como fallback

usdEquivalentArs = fondoUsd × rateHoy   (tasa más reciente en DB)

totalArs = incomeArs + usdEquivalentArs − totalExpenses
```

### Lo que devuelve

| Campo | Qué es |
|---|---|
| `totalArs` | Disponible neto en ARS (incluye USD × tasa hoy) |
| `fondoUsd` | Dólares acumulados sin convertir (informativo) |
| `usdEquivalentArs` | fondoUsd × rateHoy |
| `rateHoy` | Tipo de cambio del día |
| `comprometidoArs` | Suma de todos los gastos del mes |

### Módulos que NO descuenta el balance

Ahorros, alquileres y préstamos son módulos independientes. No se restan del disponible automáticamente.

### Issues

| # | Estado | Descripción |
|---|---|---|
| B-1 | `[ ]` | Ahorros y alquiler no se descuentan del balance. El disponible puede parecer mayor de lo real. Evaluar si debe incluirlos o dejarlos como módulos separados. |

---

## 3. Dashboard mensual (`/lib/dashboard.ts`)

### 3a. Total de ingresos del mes

```
totalIncomeArs = Σ income del mes usando (amountArs ?? amount)
```

Incluye todos los tipos de ingreso (SUELDO, FREELANCE, etc.).

### 3b. Split por usuario (proporciones)

```
incomeByUser[userId] = Σ ingresos tipo SUELDO del usuario
sueldoTotal          = Σ todos los SUELDO del hogar

user.percentage = incomeByUser[userId] / sueldoTotal
```

Solo el `SUELDO` define la proporción de responsabilidad. Freelance, inversiones, etc. suman al total pero no cambian el porcentaje por categoría.

### 3c. Montos presupuestados por categoría

**Categorías auto** — calculadas desde la DB, no editables como porcentaje:

| Categoría | Fórmula `budgeted` |
|---|---|
| `TDC` | `Σ tdcEffective(c)` de todos los statements del mes |
| `GASTOS_FIJOS` | `Σ amount` de templates activos en ARS |

```
tdcEffective(c):
  si payMinimum=true  y minimumPayment > 0  → minimumPayment
  si payMinimum=false y committedOverride != null → committedOverride
  sino → amountToPay + (usdAmount × exchangeRate)
```

**Categorías configurables** — override manual por porcentaje o monto fijo:

```
calculateCategoryAmount(totalIncomeArs, config, autoAmount):
  si manualAmount > 0      → manualAmount
  si manualPercentage > 0  → totalIncomeArs × manualPercentage
  sino                     → autoAmount (0 para estas categorías)
```

| Categoría | `isReserved` default | Configurable |
|---|---|---|
| `MERCADO` | true | % o ARS manual |
| `GASTOS_LIBRES` | true | remanente auto (ver 3d) |
| `AHORRO_CASA` | false | % o ARS manual |
| `AHORRO_VACACIONES` | false | % o ARS manual |
| `INVERSION_AHORRO` | false | % o ARS manual |
| `OTROS` | true | % o ARS manual |

### 3d. GASTOS\_LIBRES — el remanente automático

```
reservedAmounts = budgeted de todas las categorías con isReserved=true (excepto GASTOS_LIBRES)

gastosLibres =
  si hay manualConfig → calculateCategoryAmount (% o ARS manual)
  sino               → max(0, totalIncomeArs − Σ reservedAmounts)
```

Nunca es negativo. Si el total comprometido supera los ingresos, muestra 0.

### 3e. Montos "usados" (gasto real del mes)

| Categoría | Fuente de datos |
|---|---|
| `TDC` | `Σ tdcEffective(c)` donde `isPaid = true` |
| `GASTOS_FIJOS` | `Σ FixedExpense.amount` del mes (registros reales) |
| `MERCADO` | `Σ GroceryExpense.amount` del mes |
| `GASTOS_LIBRES` | `Σ HouseholdExpense.amount` del mes |
| `AHORRO_CASA` | `Σ Saving.amount` donde `type = AHORRO` (ARS, ese mes) |
| `AHORRO_VACACIONES` | `Σ Saving.amount` donde `type = VIAJE` (ARS, ese mes) |
| `INVERSION_AHORRO` | `Σ Saving.amount` donde `type = INVERSION` (ARS, ese mes) |
| `OTROS` | `Σ PersonalExpense.amount` del mes (todos los usuarios) |

### 3f. Available y desglose por usuario

```
availableArs = budgetedArs − usedArs   (puede ser negativo → isOverspent = true)

perUserBudget[userId] = budgetedArs × (user.incomeArs / totalIncome)

perUser[userId] = {
  budgeted:  perUserBudget[userId],
  used:      usedArs × user.percentage,   ← estimación proporcional, no el gasto real
  available: budgeted − used
}
```

### 3g. Superávit

```
surplusArs = totalIncomeArs − Σ budgetedArs de categorías con isReserved=true
```

No incluye categorías con `isReserved=false` (ahorros, inversión).

### Issues

| # | Estado | Descripción |
|---|---|---|
| D-1 | `[ ]` | `GASTOS_FIJOS` tiene dualidad: **budgeted** viene de templates, **used** de registros reales. Si se carga el template pero nunca se registra el gasto real en `FixedExpense`, el available aparece como disponible aunque el dinero ya salió. Evaluar si el `used` de GASTOS_FIJOS debería venir también del template (marcar como pagado) o si el flujo de registro debe ser más claro en la UI. |
| D-2 | `[ ]` | `perUser.used` es proporcional al sueldo, no el gasto real por persona. Si Maria gasta todo el mercado, Avelino igual aparece con el 50% usado. |
| D-3 | `[ ]` | Ahorros en USD no entran al `usedAmounts` (el query filtra `currency: "ARS"`). Un ahorro en dólares no aparece en el dashboard. |

---

## 4. TDC — tarjetas de crédito (`/api/tdc`)

### Modos de pago al crear

El statement se crea con `amountToPay = totalAmountArs` como valor inicial.

### Modos de pago al actualizar (PATCH)

| Escenario | Resultado en DB |
|---|---|
| `customAmount` enviado | `amountToPay = customAmount`, `payMinimum = true` |
| `totalAmountArs` enviado | `amountToPay = totalAmountArs` |
| `committedOverride` enviado | campo separado, no modifica `amountToPay` |
| `payMinimum: true/false` enviado | solo actualiza el flag |

### Prioridad en tdcEffective (usado en dashboard)

```
1. payMinimum=true  → minimumPayment
2. payMinimum=false y committedOverride != null → committedOverride
3. sino → amountToPay + (usdAmount × exchangeRate)
```

### Pago con débito de cuenta

Si el PATCH incluye `accountId` y `deductAmount`:
```
transaction:
  1. update CreditCardStatement (isPaid=true, paidAt=now)
  2. account.balance -= deductAmount
```

### Alertas TDC

```
alerta si: !isPaid && dueDate ≤ now + 7 días
daysUntilDue = ceil((dueDate − now) / 86_400_000)
ordenadas por daysUntilDue ASC
```

### Issues

| # | Estado | Descripción |
|---|---|---|
| T-1 | `[x]` | Al setear `customAmount`, el PATCH también forzaba `payMinimum: true`. Corregido: ahora setea `payMinimum: false`. |
| T-2 | `[x]` | La spec dice que las alertas son para `dueDate ≤ 3 días`. Corregido: ventana cambiada de 7 a 3 días en `dashboard.ts`. |

---

## 5. Préstamos (`/api/loans`)

### Cálculo al crear

```
amountPerInstallment = totalAmount / installments

dueDate por cuota:
  WEEKLY:  now + (i+1) × 7 días
  MONTHLY: now + (i+1) meses (mismo día del mes)
```

### Fórmula de total (en `budget.ts`)

```
calculateLoanTotal = principal + (principal × interestRate × installments)
```

Esta función existe en `budget.ts` pero **no se llama desde el API**. El `totalAmount` se recibe directamente del cliente — el usuario ingresa el total manualmente.

### Marcar cuota como pagada

Toggle: `isPaid = !isPaid`, `paidDate = now` si se marca como pagada, `null` si se desmarca.

### Issues

| # | Estado | Descripción |
|---|---|---|
| L-1 | `[x]` | `loans/route.ts` usa `HOUSEHOLD_ID` y `AVELINO_ID` hardcodeados (constantes importadas desde `prisma/constants`) en lugar de obtenerlos de la sesión. |
| L-2 | `[x]` | `loans/route.ts` y el endpoint de cuotas (`/api/loans/[id]/installments/[num]`) no llaman `requireSession`. Cualquiera puede leer o modificar préstamos sin autenticar. |
| L-3 | `[ ]` | `calculateLoanTotal` en `budget.ts` no se usa desde el API. El total lo calcula el cliente. Evaluar si mover el cálculo al servidor para garantizar consistencia. |

---

## 6. Budget Config — herencia entre meses (`/api/budget-config`)

### Comportamiento

Si no hay config guardada para el mes solicitado, el GET busca hacia atrás hasta 12 meses:

```
candidates = [mes-1, mes-2, ..., mes-12]
para cada candidato:
  si tiene configs en DB → retorna esas + inherited: true
  break
si no encuentra nada → retorna configs vacías + inherited: false
```

### Issues

| # | Estado | Descripción |
|---|---|---|
| C-1 | `[x]` | Ya implementado en `budget-config-editor.tsx` — banner visible cuando `inherited: true`. |

---

## 7. Multi-moneda — regla de snapshot

| Momento | Comportamiento |
|---|---|
| Se carga gasto/ingreso USD | Se guarda `dollarRateSnapshot = rate actual` y `amountArs = amount × rate` |
| Se consulta el balance | Se usa la tasa más reciente del día para convertir `fondoUsd` |
| Se consulta el dashboard | Se usa la tasa más reciente para TDC con USD |

Los registros históricos **nunca se recalculan**. Un ingreso de $1.000 USD a $1.000 ARS/USD siempre vale $1.000.000 ARS, aunque hoy el dólar valga $1.500.

---

## 8. Fondos (`calculateFunds` en `budget.ts`)

Función utilitaria para separar fondos ARS y USD de una lista de movimientos:

```
para cada movement:
  si currency = ARS            → arsTotal += amount
  si currency = USD y amountArs existe → arsTotal += amountArs  (contó como ARS)
  si currency = USD y amountArs NULL   → usdTotal += amount     (fondo USD separado)
```

Actualmente esta función está definida pero **no se llama desde ningún componente ni API**. Es candidata a ser el cálculo centralizado del balance.

---

## 9. Resumen de issues por prioridad

### Alta — bugs que afectan datos o seguridad

| ID | Archivo | Descripción |
|---|---|---|
| L-1 | `api/loans/route.ts:89` | Hardcoded `HOUSEHOLD_ID` y `AVELINO_ID` en lugar de sesión |
| L-2 | `api/loans/route.ts` · `api/loans/[id]/installments/[num]/route.ts` | Sin `requireSession` — endpoints sin autenticación |
| T-1 | `api/tdc/[id]/route.ts:32-36` | `customAmount` pone `payMinimum: true`, rompe `tdcEffective` en dashboard |
| I-1 | `api/income/route.ts:42-46` | Ingreso USD sin tasa → `amountArs` undefined, no suma en balance/dashboard |

### Media — inconsistencias funcionales

| ID | Archivo | Descripción |
|---|---|---|
| D-1 | `lib/dashboard.ts:218-219` | GASTOS_FIJOS: budgeted = templates, used = registros reales. Dualidad no explicada en UI |
| D-3 | `lib/dashboard.ts:168-174` | Ahorros USD no cuentan en el dashboard (query filtra `currency: "ARS"`) |
| L-3 | `lib/budget.ts:111-117` | `calculateLoanTotal` definida pero sin usar — cálculo delegado al cliente |
| C-1 | `api/budget-config/route.ts:29-48` | Config heredada no se indica en la UI |

### Baja — deuda técnica o mejoras menores

| ID | Archivo | Descripción |
|---|---|---|
| T-2 | `lib/dashboard.ts:333` | Alerta TDC: código usa 7 días, spec dice 3 días |
| D-2 | `lib/dashboard.ts:302-304` | `perUser.used` es proporcional al sueldo, no el gasto real por persona |
| B-1 | `api/balance/route.ts` | Ahorros y alquiler no se descuentan del disponible |
