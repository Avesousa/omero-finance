# Spec — Omero Finance (Español)
> Versión 2.0 — Multi-usuario · Multi-moneda · Mobile-first · IA para carga de gastos

## Visión General

Aplicación web mobile-first de gestión del presupuesto del hogar. Diseñada para uno o más usuarios, con login persistente, registro de gastos en ARS y USD, integración con la API de MercadoPago, entrada por voz con interpretación IA, y una UX que minimiza la fricción para cargar un gasto en segundos.

Pensada inicialmente como uso personal, con arquitectura preparada para escalar a múltiples hogares / familias (SaaS eventual).

**Stack:** Next.js 14+ (App Router) · Neon (PostgreSQL serverless) · Prisma · Vercel
**Auth:** NextAuth.js — sesión persistente hasta expiración del browser
**Moneda:** ARS y USD independientes, con conversión opcional y tipo de cambio por registro
**UX:** Mobile-first, voz + IA para carga rápida, formulario mínimo
**API externa:** MercadoPago API · Bluelytics (tipo de cambio)

---

## Decisiones de Diseño (v2.0)

| Área | Decisión |
|------|----------|
| MercadoPago | API directa (no CSV). Sincronización automática. Movimientos con origen conocido → categorizados. Sin origen → cola "Por definir" para revisión manual. |
| Multi-moneda | Cada registro puede estar en ARS o USD. Si se ingresa USD sin conversión → se guarda en USD puro. Si se convierte → se guarda el monto en USD + el equivalente en ARS + el rate del momento. El dashboard muestra fondo en ARS y en USD por separado. |
| Usuarios | N usuarios por hogar. No hardcodeados. Cada gasto registra quién lo cargó. Auth con sesión persistente (no se cierra solo a menos que expire el browser). |
| Entrada de gastos | Pantalla principal = carga rápida. Dos flujos: voz (IA interpreta y solo pregunta lo ambiguo) o formulario mínimo. Default: gasto de la casa. Segunda opción: gasto propio. |
| Gastos compartidos | Se separan en: Mercado (categoría propia) y Otros gastos generales. |
| Mobile-first | Toda la UI diseñada primero para 375px. Luego adapta a desktop. |
| Escalabilidad | Arquitectura multi-hogar (household) desde el inicio, aunque en v1 sea un solo hogar. |

---

## Entidades del Dominio

### 0. Hogar (`household`)
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | PK |
| name | string | "Casa de Avelino y Maria" |
| created_at | timestamp | |

### 1. Usuario (`user`)
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | PK |
| household_id | uuid | FK → household |
| name | string | Nombre visible |
| email | string | Para login |
| password_hash | string | |
| role | enum | admin · member |
| avatar_color | string | Color para identificar en UI |
| created_at | timestamp | |

### 2. Ingreso (`income`)
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | PK |
| household_id | uuid | FK |
| user_id | uuid | Quién lo cargó |
| month | string | "enero" |
| year | int | |
| type | enum | Sueldo · Freelance · Ahorros · Pago de deuda · Remanentes · Prestamo · Inversion |
| currency | enum | ARS · USD |
| amount | decimal | Monto en la moneda indicada |
| amount_ars | decimal | Equivalente en ARS (si se convirtió) |
| dollar_rate_snapshot | decimal | Rate al momento de la conversión (null si no se convirtió) |
| description | string | |
| created_at | timestamp | |

### 3. Tarjeta de Crédito — Resumen mensual (`credit_card_statement`)
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | PK |
| household_id | uuid | FK |
| month | string | |
| year | int | |
| card_name | string | |
| owner_user_id | uuid | FK → user (dueño de la tarjeta) |
| due_date | date | Fecha de vencimiento |
| minimum_payment | decimal | Mínimo a pagar (ARS) |
| total_amount_ars | decimal | Total en pesos |
| usd_amount | decimal | Porción en dólares (opcional) |
| dollar_rate_snapshot | decimal | Rate al momento de carga |
| custom_amount | decimal | Monto personalizado (opcional) |
| amount_to_pay | decimal | Calculado (ver regla de negocio) |
| pay_minimum | bool | |
| is_paid | bool | |
| created_by | uuid | FK → user |

### 4. Gasto Fijo (`fixed_expense`)
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | PK |
| household_id | uuid | FK |
| concept | string | |
| subcategory | string | Opcional |
| currency | enum | ARS · USD |
| amount | decimal | |
| amount_ars | decimal | Equivalente ARS si es USD |
| dollar_rate_snapshot | decimal | |
| is_paid | bool | |
| month | string | |
| year | int | |
| created_by | uuid | FK → user |

### 5. Gasto de Mercado (`grocery_expense`)
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | PK |
| household_id | uuid | FK |
| month | string | |
| year | int | |
| description | string | |
| currency | enum | ARS · USD |
| amount | decimal | |
| amount_ars | decimal | |
| dollar_rate_snapshot | decimal | |
| created_by | uuid | FK → user |
| created_at | timestamp | |

### 6. Gasto General de la Casa (`household_expense`)
Reemplaza el anterior "Gastos" (misc_expense). Todo gasto de la casa que no sea mercado ni TDC ni fijo.

| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | PK |
| household_id | uuid | FK |
| month | string | |
| year | int | |
| description | string | |
| expense_type | enum | Innecesario · Necesario |
| currency | enum | ARS · USD |
| amount | decimal | |
| amount_ars | decimal | |
| dollar_rate_snapshot | decimal | |
| created_by | uuid | FK → user (quien lo cargó) |
| created_at | timestamp | |

### 7. Gasto Propio (`personal_expense`)
Gasto personal del usuario logueado, no compartido.

| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | PK |
| household_id | uuid | FK |
| user_id | uuid | FK → dueño del gasto |
| month | string | |
| year | int | |
| concept | string | |
| currency | enum | ARS · USD |
| amount | decimal | |
| amount_ars | decimal | |
| dollar_rate_snapshot | decimal | |
| is_paid | bool | |
| created_by | uuid | FK → user (puede ser el mismo u otro) |
| created_at | timestamp | |

### 8. Alquiler / Expensas (`rent_payment`)
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | PK |
| household_id | uuid | FK |
| month | string | |
| year | int | |
| type | enum | ALQUILER · EXPENSAS · TRABAJOS |
| apartment | string | |
| currency | enum | ARS · USD |
| amount | decimal | |
| amount_ars | decimal | |
| dollar_rate_snapshot | decimal | |
| description | string | |
| cbu_alias | string | |
| created_by | uuid | FK → user |

### 9. Ahorro e Inversión (`saving`)
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | PK |
| household_id | uuid | FK |
| date | date | |
| description | string | |
| type | enum | Ahorro · Viaje · Inversión |
| currency | enum | ARS · USD |
| amount | decimal | |
| amount_ars | decimal | |
| dollar_rate_snapshot | decimal | |
| platform | string | |
| created_by | uuid | FK → user |

### 10. Préstamo (`loan`)
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | PK |
| household_id | uuid | FK |
| direction | enum | dado · tomado |
| counterpart | string | Nombre |
| owner_user_id | uuid | Usuario del hogar involucrado |
| payment_method | string | |
| currency | enum | ARS · USD |
| principal | decimal | |
| principal_ars | decimal | |
| dollar_rate_snapshot | decimal | |
| installments | int | |
| installment_unit | enum | semanal · mensual |
| interest_rate | decimal | |
| total_amount | decimal | Calculado |
| notes | string | |
| created_by | uuid | FK → user |
| created_at | timestamp | |

#### Cuota de préstamo (`loan_installment`)
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | PK |
| loan_id | uuid | FK |
| installment_number | int | |
| due_date | date | |
| amount | decimal | |
| currency | enum | ARS · USD |
| is_paid | bool | |
| paid_date | date | |

### 11. Deuda a cobrar (`debt`)
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | PK |
| household_id | uuid | FK |
| date | date | |
| concept | string | |
| debtor | string | |
| currency | enum | ARS · USD |
| total_amount | decimal | |
| total_ars | decimal | |
| dollar_rate_snapshot | decimal | |
| amount_paid | decimal | |
| remaining | decimal | Calculado |
| status | enum | Activa · Saldada |
| created_by | uuid | FK → user |

### 12. Movimiento MercadoPago (`mercadopago_movement`)
Sincronizado automáticamente via API. No hay importación de CSV.

| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | PK |
| household_id | uuid | FK |
| mp_reference_id | string | ID único de MP (para dedup) |
| release_date | date | |
| transaction_type | string | Descripción original de MP |
| net_amount | decimal | |
| partial_balance | decimal | Saldo en MP |
| currency | enum | ARS · USD |
| status | enum | `categorized` · `pending` |
| category | string | Categoría asignada (si status = categorized) |
| sub_category | string | Sub-categoría |
| linked_expense_id | uuid | FK opcional → cualquier tabla de gastos |
| notes | string | Nota manual del usuario |
| categorized_by | uuid | FK → user (quién categorizó) |
| synced_at | timestamp | Última sincronización |

**Flujo:**
1. Sync automático (webhook o polling) con API de MP
2. Si la descripción hace match con una regla conocida → `status = categorized` automáticamente
3. Si no → `status = pending`, aparece en sección "Por definir"
4. Usuario puede categorizar manualmente o vincular a un gasto existente

### 13. Configuración del Presupuesto (`budget_config`)
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | PK |
| household_id | uuid | FK |
| month | string | |
| year | int | |
| category | enum | Ver abajo |
| manual_percentage | decimal | |
| manual_amount | decimal | |
| manual_currency | enum | ARS · USD |
| is_reserved | bool | |

**Categorías:** ALQUILER · TDC · GASTOS_FIJOS · MERCADO · GASTOS_LIBRES · AHORRO_CASA · AHORRO_VACACIONES · INVERSION_AHORRO · OTROS

### 14. Tipo de Cambio (`exchange_rate`)
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | PK |
| date | date | |
| usd_ars | decimal | |
| source | enum | api · manual |

---

## Fondo Total (Balance Multi-Moneda)

El dashboard muestra dos fondos independientes:

| Fondo | Cálculo |
|-------|---------|
| **Fondo ARS** | Ingresos ARS + conversiones ARS de ingresos USD − todos los gastos en ARS |
| **Fondo USD** | Ingresos USD no convertidos − gastos en USD no convertidos |
| **Equivalente total** | `Fondo ARS + (Fondo USD × rate_hoy)` — referencial |

Un ingreso en USD sin convertir **no** suma al fondo ARS. Solo suma al fondo USD.
Un ingreso en USD convertido suma al fondo ARS (al rate del momento de la conversión).

---

## Design System

### Paleta de colores

El sistema usa **CSS variables** para soportar dark mode y light mode sin duplicar componentes.

#### Dark Mode (default)
| Token | Valor | Uso |
|-------|-------|-----|
| `--bg-primary` | `#0A0A0F` | Fondo principal |
| `--bg-card` | `#13131A` | Tarjetas |
| `--bg-elevated` | `#1C1C27` | Inputs, modales |
| `--text-primary` | `#F0F0FF` | Texto principal |
| `--text-secondary` | `#8888AA` | Labels, placeholders |
| `--accent` | `#6366F1` | Indigo — acción principal |
| `--accent-green` | `#22C55E` | Positivo / disponible |
| `--accent-red` | `#EF4444` | Negativo / sobregirado |
| `--accent-amber` | `#F59E0B` | Alerta / por definir |
| `--border` | `#2A2A3D` | Bordes de tarjetas |

#### Light Mode
| Token | Valor | Uso |
|-------|-------|-----|
| `--bg-primary` | `#F8F9FF` | Fondo principal |
| `--bg-card` | `#FFFFFF` | Tarjetas |
| `--bg-elevated` | `#EEF0FF` | Inputs, modales |
| `--text-primary` | `#0F0F1A` | Texto principal |
| `--text-secondary` | `#6B7280` | Labels |
| `--accent` | `#4F46E5` | Indigo más intenso en light |
| `--accent-green` | `#16A34A` | |
| `--accent-red` | `#DC2626` | |
| `--accent-amber` | `#D97706` | |
| `--border` | `#E5E7F0` | |

**Implementación:** `class="dark"` en el `<html>` controlado por `next-themes`. El toggle dark/light se guarda en `localStorage` y se aplica sin flash (SSR-safe).

### Tipografía
- **Font:** Geist Sans (Next.js default) — fallback: system-ui
- **Números grandes:** `font-variant-numeric: tabular-nums` para evitar saltos en cifras
- **Sizes:** `text-4xl` para saldos principales · `text-base` para listas · `text-sm` para labels

### Componentes clave
- Tarjetas con `rounded-2xl` + `border` sutil + leve `backdrop-blur` en overlays
- Botones primarios: fondo `--accent`, sin sombra, `rounded-xl`
- Bottom sheet para formularios (no modales centrados — más natural en mobile)
- Haptic feedback en mobile via Vibration API (al confirmar un gasto)

---

## UX — Flujo de Carga de Gastos

### Pantalla principal: Quick Log

La pantalla de inicio combina el panel de voz **y** el formulario visible simultáneamente. El micrófono es el protagonista pero el formulario siempre está presente debajo — no hay que cambiar de modo.

```
┌──────────────────────────────────────┐
│  Buenos días, Avelino    🌙 / ☀️    │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  Disponible enero              │  │
│  │  $1.240.000 ARS                │  │
│  │  💵 USD 840                    │  │
│  └────────────────────────────────┘  │
│                                      │
│  [🏠 Casa]      [👤 Personal]        │  ← Toggle
│                                      │
│  ┌────────────────────────────────┐  │
│  │  🎤  ¿Qué gastaste?            │  │  ← Tap para hablar
│  │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │  │
│  │  Monto    [    $ ____  ] [ARS▾]│  │  ← Formulario siempre visible
│  │  Tipo     [Mercado▾]           │  │
│  │  Nota     [opcional...]        │  │
│  │  Tarjeta  [ninguna▾]           │  │
│  │                   [Agregar →]  │  │
│  └────────────────────────────────┘  │
│                                      │
│  ── Hoy ──────────────────────────  │
│  🛒 Coto · $4.500 · Mercado         │
│  📺 Netflix · $7.298 · Fijo         │
│                                      │
│  🏠      📊      💳      👤      ⋯  │  ← Nav
└──────────────────────────────────────┘
```

**El formulario pre-rellena sus campos cuando el micrófono interpreta algo** — el usuario ve el resultado de la voz aplicado en el form y puede editarlo antes de confirmar.

### Flujo por voz
1. Usuario toca el área del micrófono y habla: *"Gasté 5000 en mercado con la master de Avelino"*
2. Whisper transcribe → Claude Haiku (o GPT-4o mini) extrae campos: `{ monto: 5000, categoria: "mercado", tarjeta: "mastercard", usuario: "Avelino" }`
3. Los campos se pre-rellenan en el formulario visible
4. Si hay ambigüedad → **solo ese campo** queda vacío y resaltado: `¿Cuál Mastercard?` con chips `[MC BN]` `[MC MP]`
5. Usuario confirma (o ajusta) y toca **Agregar**

### Flujo por formulario (sin voz)
El formulario se ajusta según el toggle [Casa / Personal]:

**Casa → Tipo: Mercado**
- Monto + [ARS / USD] toggle
- Descripción (ej: "Coto")
- Tarjeta (opcional)

**Casa → Tipo: General**
- Monto + moneda
- Descripción
- Clasificación: [Necesario] [Innecesario]
- Tarjeta (opcional)

**Personal**
- Monto + moneda
- Concepto
- Pagado: toggle sí/no

### Campos que se muestran / ocultan según contexto
- "Tarjeta" solo si el tipo no es "Fijo" (los fijos ya tienen su pantalla propia)
- "USD" toggle siempre visible — al activarlo aparece el rate actual como hint: `1 USD = $1.477`
- Si `USD` sin conversión: se guarda en fondo USD. Si activa "Convertir a ARS": guarda ambos con snapshot.

---

## Pantallas / Módulos

| Ruta | Módulo |
|------|--------|
| `/` | Quick log + últimos gastos |
| `/dashboard` | Resumen mensual del presupuesto |
| `/ingresos` | Ingresos del mes |
| `/tdc` | Tarjetas de crédito |
| `/gastos-fijos` | Gastos fijos |
| `/mercado` | Gasto de mercado |
| `/gastos` | Gastos generales de la casa |
| `/gastos-propios` | Gastos personales |
| `/alquiler` | Alquiler y expensas |
| `/ahorros` | Ahorros e inversiones |
| `/deudas` | Deudas a cobrar |
| `/prestamos` | Préstamos (dados y tomados) |
| `/mercadopago` | Sync MP + cola "Por definir" |
| `/configuracion` | Usuarios, tarjetas, tipo de cambio |

---

## Auth

- **NextAuth.js** con credentials provider (email + password)
- Sesión persistente: `strategy: "jwt"`, `maxAge: 30 días` — se renueva con cada visita
- Solo se cierra si el usuario cierra sesión o el token expira sin actividad
- Todos los datos filtrados por `household_id` del usuario logueado
- El `user_id` del token se usa para taggear cada registro creado

---

## Reglas de Negocio

1. **Gastos Libres** = `ingreso_ars - (alquiler + TDC + fijos + mercado + ahorros + inversión + otros)` → mínimo 0.
2. **TDC amount_to_pay**: custom → mínimo → total_ars + (usd × rate_snapshot).
3. **% por persona**: ingreso_ars de esa persona / ingreso_ars total del mes.
4. **Fondo USD**: solo suma/resta movimientos cuya `currency = USD` y `amount_ars = null`.
5. **Rate snapshot**: se guarda al momento de carga; nunca se actualiza después.
6. **MP sync**: dedup por `mp_reference_id`. Si ya existe → skip.
7. **Alerta TDC**: `due_date - today ≤ 3 días` y `is_paid = false`.
8. **Préstamo total**: `principal + (principal × rate × installments)`.

---

## Export PDF

Resumen mensual incluye:
- Header: mes, ingresos totales ARS, fondo USD, distribución por usuario
- Tabla de categorías: presupuestado vs ejecutado
- TDC pendientes
- Gastos fijos pendientes
- Balance disponible

---

## Migración desde Google Sheets

1. Script `/scripts/import.ts` — lee los CSV exportados y hace upsert
2. Se crea un hogar y dos usuarios (Avelino, Maria) durante el seed
3. Sheets a migrar: Ingresos · TDC · Gasto fijos · Gasto de mercado · Gastos · Gasto Propios · Alquiler2025 · Ahorros & inversión · Deudas · Prestamos
4. Sheets descartadas: AYACUCHO · Claude Cache · Alquiler 2024 · Movimientos mercadopago · PRISMA DEUDA
5. Rango: octubre 2024 → enero 2026

---

## Estrategia de Testing

### Stack de tests
| Capa | Herramienta | Propósito |
|------|-------------|-----------|
| Unitario | **Jest** + **React Testing Library** | Componentes, funciones de cálculo, utils |
| Integración | **Jest** + **Prisma Client mock** | Server Actions, API routes |
| E2E | **Playwright** | Flujos críticos completos |

### Qué testear por módulo

#### Funciones de cálculo (unitarios — sin DB)
- `calculateBudgetCategory(income, config)` → monto final por categoría
- `calculateAvailablePerPerson(category, users)` → disponible por usuario
- `calculateAmountToPay(statement)` → lógica TDC (custom → mínimo → total+USD)
- `calculateLoanTotal(principal, rate, installments)` → total de préstamo
- `calculateFunds(movements)` → fondo ARS y USD separados

#### Componentes (unitarios con RTL)
- `QuickLogForm` — pre-relleno desde voz, campos visibles según toggle Casa/Personal
- `BudgetTable` — renderiza categorías, calcula y muestra disponible, alerta sobregirado
- `CreditCardCard` — muestra estado pagado, alerta vencimiento próximo
- `CurrencyToggle` — switch ARS/USD muestra rate hint
- `ThemeToggle` — cambia clase en `<html>`, persiste en localStorage

#### API Routes / Server Actions (integración)
- `POST /api/expenses` — crea gasto, guarda `dollar_rate_snapshot` si es USD
- `GET /api/budget/[year]/[month]` — devuelve resumen mensual completo
- `POST /api/mercadopago/sync` — dedup por `mp_reference_id`, categoriza automático
- `GET /api/exchange-rate` — devuelve rate del día, fallback al último disponible
- `POST /api/voice/parse` — recibe transcripción, devuelve campos extraídos + ambigüedades

#### E2E con Playwright (flujos críticos)
1. **Carga de gasto rápido** — abrir app → escribir monto → seleccionar tipo → confirmar → aparece en lista
2. **Carga por voz** — hablar → form se pre-rellena → resolver ambigüedad → confirmar
3. **Dashboard mensual** — cambiar mes → tabla actualiza → editar % de categoría inline → persiste
4. **TDC — pagar tarjeta** — marcar como pagada → desaparece alerta → suma al "usado"
5. **Dark/Light mode** — toggle → cambia tema → recargar → tema persiste
6. **Login / sesión** — login → recargar → sigue logueado → cerrar sesión → redirige a login

### Convenciones
- Archivos de test: `*.test.ts` (unitario/integración) · `*.spec.ts` (E2E)
- Ubicación: junto al archivo que testean (`src/lib/budget.test.ts`) excepto E2E que van en `/e2e/`
- Cada nueva feature o bug fix incluye su test
- CI: los tests corren en cada push via GitHub Actions

### Coverage objetivo
| Tipo | Target |
|------|--------|
| Funciones de cálculo | 100% |
| Componentes críticos | 80%+ |
| API routes | 80%+ |
| E2E flujos críticos | 6 flujos cubiertos |

---

## Restricciones Técnicas

- Neon free tier (0.5 GB)
- Vercel free tier
- Next.js 14+ App Router
- Prisma ORM
- NextAuth.js
- TypeScript
- TailwindCSS + shadcn/ui
- API MP: OAuth 2.0 (access token por usuario)
- API tipo de cambio: Bluelytics
- IA voz: Whisper (transcripción) + GPT-4o mini o Claude Haiku (interpretación de intención)
