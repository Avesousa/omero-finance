# SDD — Omero Finance
> Software Design Document · Versión 2.0
> Cubre: Web App (gaps y completar) + Mobile App (React Native + Expo)
> Decisiones de diseño incorporadas el 2026-04-11

---

## 0. Decisiones de diseño confirmadas

| # | Pregunta | Decisión |
|---|----------|----------|
| Q1 | USD sin convertir en el balance disponible | USD **suma al disponible** usando el rate del día (`fondo_USD × rate_hoy`). El "Fondo USD" es un desglose informativo de cuánto del disponible proviene de dólares. |
| Q2 | Gastos Generales vs Mercado | Un solo formulario y una sola página de gastos, diferenciados por tipo. En el presupuesto/dashboard se restan del bucket correcto: Mercado de `MERCADO`, General de `GASTOS_LIBRES`. |
| Q3 | Gastos Propios | Pantalla **propia y dedicada**. El home tiene un toggle "Casa / Personal" para ver el disponible de cada contexto. La pantalla de gastos propios pone el disponible personal como elemento principal. |
| Q4 | Edición simultánea (multi-device) | Last-write-wins. Cada gasto es independiente, no hay conflictos de merge. |
| Q5 | Onboarding mobile | Onboarding completo con 3 tipos de cuenta (2 coming soon): **Personal** (1 usuario), **Compartida** (N usuarios + invitaciones), *(CS) Organización*, *(CS) Múltiple*. |
| Q6 | Tipo de cambio offline | Usar último rate conocido del cache local. La app sube cuando hay conexión. El formulario nunca bloquea por falta de conectividad. |
| Q7 | Templates de Gastos Fijos | Templates son la fuente de verdad. Al inicio de cada mes se **auto-generan instancias** desde los templates activos. Cada instancia puede sobreescribir el monto sin afectar meses anteriores ni el template base. |

---

## 1. Estado Actual

### 1.1 Qué está construido en la web app

| Módulo | Ruta | Estado |
|--------|------|--------|
| Quick Log | `/` | ✅ Construido |
| Dashboard | `/dashboard` | ✅ Construido |
| TDC | `/tdc` | ✅ Construido |
| Menú Más | `/mas` | ✅ Construido |
| Config Presupuesto | `/mas/presupuesto` | ✅ Construido |
| Gastos Fijos | `/mas/gastos-fijos` | ✅ Construido |
| Cuentas | `/mas/cuentas` | ✅ Construido |
| Movimientos | `/movimientos` | ✅ Construido |

### 1.2 Qué está en el spec pero NO construido

| Módulo | Ruta | Prioridad |
|--------|------|-----------|
| Ingresos (página dedicada) | `/ingresos` | Alta |
| Alquiler y expensas | `/alquiler` | Alta |
| Ahorros e inversiones | `/ahorros` | Alta |
| Gastos + Mercado (unificado) | `/gastos` | Media |
| Gastos personales | `/gastos-propios` | Alta |
| Deudas a cobrar | `/deudas` | Media |
| Préstamos | `/prestamos` | Media |
| Configuración | `/configuracion` | Alta |
| Auth real + Onboarding | Global | **Crítico** |
| PDF export | Global | Media |
| GitHub Actions CI | — | Media |
| MercadoPago API integration | — | Baja (fase 2) |

### 1.3 Deuda técnica identificada

| Ítem | Descripción | Impacto |
|------|-------------|---------|
| HOUSEHOLD_ID hardcodeado | Todos los API routes usan una env var fija en lugar de leer del token de sesión | Bloquea auth real y multi-usuario |
| Sin autenticación real | No hay login — cualquiera con la URL puede ver y modificar datos | Crítico para mobile |
| Sin módulo de Ingresos dedicado | Los ingresos se cargan desde Home pero no hay página de gestión completa | Bloquea visibilidad |
| Sin módulo Alquiler | No hay UI para registrar alquiler ni expensas mensuales | Falta funcionalidad clave |
| Accounts sin historial | El módulo de cuentas muestra saldos pero sin historial de movimientos por cuenta | UX incompleta |
| Balance USD incorrecto | El fondo USD se muestra por separado pero no se suma al disponible con el rate del día | Bug funcional |
| Sin auto-generación de instancias fijas | Los templates existen pero no se auto-instancian al inicio del mes | Funcionalidad faltante |

---

## 2. Modelo de datos — Cambios y adiciones

### 2.1 Household con tipos de cuenta

El modelo `Household` necesita soporte para los distintos tipos de cuenta del onboarding.

```prisma
enum HouseholdType {
  PERSONAL      // 1 usuario, 100% de todo
  SHARED        // N usuarios con splits por porcentaje de ingreso
  ORGANIZATION  // coming soon — gastos de negocio/emprendimiento
  MULTIPLE      // coming soon — combinación de org + compartida
}

model Household {
  id        String        @id @default(uuid())
  name      String
  type      HouseholdType @default(PERSONAL)
  createdAt DateTime      @default(now())
  users     User[]
  // ... resto de relaciones
}
```

### 2.2 Invitaciones de usuario

Para el tipo `SHARED`, el usuario principal puede invitar a otros.

```prisma
enum InvitationStatus {
  PENDING
  ACCEPTED
  DECLINED
  EXPIRED
}

model HouseholdInvitation {
  id          String           @id @default(uuid())
  householdId String
  household   Household        @relation(fields: [householdId], references: [id])
  email       String           // email del invitado
  token       String           @unique // token de 6 dígitos o UUID
  status      InvitationStatus @default(PENDING)
  expiresAt   DateTime         // 48 horas desde creación
  createdAt   DateTime         @default(now())
  acceptedAt  DateTime?
}
```

### 2.3 Templates de Gastos Fijos — Separación template / instancia

El modelo actual ya tiene `FixedExpenseTemplate` y la instancia mensual. Hay que asegurar que:
- El template tiene `baseAmount` como referencia
- La instancia mensual tiene `amount` (puede diferir del template)
- La auto-generación crea instancias al inicio del mes con `amount = template.baseAmount`
- Sobreescribir la instancia no toca el template

```prisma
// Auto-generate job: al inicio de cada mes
// Para cada FixedExpenseTemplate activo del household:
//   → crear FixedExpense con amount = template.baseAmount
//     solo si no existe ya una para ese mes/año
```

### 2.4 Cálculo de balance disponible (Q1)

**Fórmula corregida:**

```
disponible = ingresos_ars_del_mes
           + (fondo_usd_acumulado × rate_hoy)    ← NUEVO: USD suma al disponible
           - gastos_comprometidos_ars

donde fondo_usd_acumulado = Σ ingresos_USD_no_convertidos - Σ gastos_USD_no_convertidos
```

**Display en BalanceCard:**
```
Disponible enero
$1.402.000 ARS ←── total disponible (ARS + USD equivalente)
💵 $840 USD = $1.218.000 ←── desglose: cuánto es USD
```

---

## 3. Plan Web — Módulos Faltantes

### 3.1 Auth Real + Onboarding

**Por qué primero:** Bloquea todo lo demás, especialmente mobile.

#### Auth (NextAuth.js)
- Credentials Provider con email + password
- JWT `strategy`, `maxAge: 30 días`
- Pantalla de login (`/login`)
- Redirigir a `/onboarding` si el usuario no tiene `householdId` asignado
- Reemplazar HOUSEHOLD_ID hardcodeado: leer `session.user.householdId` en todos los API routes

#### Endpoint para mobile
`POST /api/auth/token` → responde JSON (no cookie):
```json
{ "token": "...", "user": { "id": "...", "name": "...", "householdId": "..." } }
```

#### Onboarding (web + mobile)

**Pantalla 1 — Tipo de cuenta:**
```
¿Cómo vas a usar Omero?

○  Solo yo
   Gestión personal, todo al 100%

○  Con mi pareja / familia
   Dividir gastos e ingresos entre varias personas

○  Organización  [Próximamente]
   Gastos de negocio o emprendimiento

○  Múltiple  [Próximamente]
   Combinar personal + organización
```

**Flujo tipo PERSONAL:**
1. Elegir "Solo yo"
2. Configurar nombre de la cuenta (ej: "Mis finanzas")
3. Listo → entra al dashboard

**Flujo tipo SHARED:**
1. Elegir "Con mi pareja / familia"
2. Configurar nombre del hogar (ej: "Casa de Avelino y María")
3. Crear primer ingreso propio para calcular el split inicial
4. **Invitar integrantes:**
   - Ingresar email del otro integrante
   - El sistema genera un token y envía email (o muestra un código de 6 dígitos para compartir)
   - El invitado puede unirse desde web o mobile escaneando/ingresando el código
5. Listo → entran al dashboard juntos

**Reglas del tipo PERSONAL:**
- No hay splits por persona — todos los porcentajes son 100% del usuario
- No hay campo "Persona" en los formularios — oculto o default al único usuario
- El dashboard no muestra columnas por persona

**Reglas del tipo SHARED:**
- Splits se calculan dinámicamente: `ingreso_usuario / ingreso_total_mes`
- Cada registro tiene `createdBy` para saber quién lo cargó
- El owner puede ver todo; los members solo ven lo suyo + lo compartido

---

### 3.2 Balance disponible — corrección (Q1)

La lógica de `GET /api/balance` y `BalanceCard` deben cambiar:

**API `/api/balance`:**
```ts
// Antes: mostraba ARS y USD por separado
// Después: suma todo con el rate del día
{
  totalArs: number,       // disponible total en ARS (ARS + USD×rate)
  fondoUsd: number,       // dólares acumulados sin convertir
  usdEquivalentArs: number, // fondoUsd × rate_hoy
  rateHoy: number,        // rate del día
  comprometidoArs: number // TDC + fijos + alquiler pendiente
}
```

---

### 3.3 Módulo Ingresos (`/ingresos`)

Lista completa de ingresos del mes con formulario de alta/edición/eliminación.

**Funcionalidades:**
- Selector de mes (navbar breadcrumb)
- Totales por persona y total combinado con split %
- Lista agrupada por persona
- Alta: tipo, persona (oculto en PERSONAL), moneda, monto, descripción
- Edición y eliminación inline

**API routes necesarios:**
- `GET /api/income?month=&year=` — ya existe (verificar)
- `PATCH /api/income/[id]` — editar
- `DELETE /api/income/[id]` — eliminar

---

### 3.4 Módulo Alquiler (`/alquiler`)

**Funcionalidades:**
- Lista por apartamento (1G / 1A)
- Toggle "Pagado" con haptic
- Alta: tipo (ALQUILER / EXPENSAS / TRABAJOS), apartamento, monto, CBU/alias
- Total del mes que alimenta la categoría ALQUILER del presupuesto

**API routes necesarios:**
- `GET /api/rent?month=&year=`
- `POST /api/rent`
- `PATCH /api/rent/[id]`
- `DELETE /api/rent/[id]`

---

### 3.5 Módulo Gastos (Mercado + General — unificado, Q2)

**Un solo módulo** con:
- Un formulario con campo "Tipo": Mercado / General
- Una sola lista filtrable por tipo
- En el presupuesto/dashboard: Mercado descuenta de `MERCADO`, General descuenta de `GASTOS_LIBRES`

**Ruta:** `/gastos` (reemplaza a `/mercado` y `/gastos` separados del spec anterior)

**Campos del formulario:**
| Campo | Tipo | Notas |
|-------|------|-------|
| Tipo | Toggle | Mercado / General |
| Monto | Decimal | |
| Moneda | Toggle ARS / USD | |
| Descripción | Text | |
| Necesario / Innecesario | Toggle | Solo visible si Tipo = General |
| Tarjeta | Select | Opcional |

---

### 3.6 Módulo Gastos Propios (`/gastos-propios`, Q3)

**Pantalla propia** con el disponible personal como protagonista.

**Layout:**
```
┌─────────────────────────────────────────┐
│  Gastos propios                         │
│                                         │
│  [Avelino]  [María]                     │  ← Tabs
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Disponible personal            │    │  ← PROTAGONISTA
│  │  $85.000 ARS                    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ── Enero ────────────────────────────  │
│  Farmacia      $3.200  ○ Pendiente      │
│  Nafta         $8.500  ✅ Pagado        │
│                                         │
│  [+ Agregar gasto propio]               │
└─────────────────────────────────────────┘
```

**Toggle en Home (Q3):**
El `BalanceCard` en la pantalla principal tiene un toggle:
```
[🏠 Casa]  [👤 Personal]
```
- Casa: muestra disponible ARS del hogar
- Personal: muestra disponible de los gastos propios del usuario logueado

**Cálculo "disponible personal":**
```
disponible_personal = presupuesto_gastos_propios_usuario - Σ personal_expenses_mes
```
(Requiere que el presupuesto tenga una categoría `GASTOS_PROPIOS` por usuario o que sea un % del ingreso personal.)

---

### 3.7 Módulo Ahorros (`/ahorros`)

**Funcionalidades:**
- Tabs: Ahorro / Viaje / Inversión
- Lista por plataforma (MP, BALANZ, efectivo, etc.)
- Totales ARS y USD por tipo
- Alta con tipo, plataforma, moneda, monto, descripción, fecha

**API routes necesarios:**
- `GET /api/savings?month=&year=`
- `POST /api/savings`
- `PATCH /api/savings/[id]`
- `DELETE /api/savings/[id]`

---

### 3.8 Módulo Deudas (`/deudas`)

**Funcionalidades:**
- Tabs: Activas / Saldadas
- Barra de progreso por deuda (cobrado / total)
- "Registrar cobro parcial" (abre modal con monto)
- Marcar como saldada
- Alta de nueva deuda

**API routes necesarios:**
- `GET /api/debts`
- `POST /api/debts`
- `PATCH /api/debts/[id]` — registrar pago parcial o saldar
- `DELETE /api/debts/[id]`

---

### 3.9 Módulo Préstamos (`/prestamos`)

**Funcionalidades:**
- Tabs: Dados (a cobrar) / Tomados (a pagar)
- Por cada préstamo: progreso de cuotas, fecha próxima cuota, monto
- Marcar cuota como pagada
- Alta de nuevo préstamo con cálculo automático del total
- Indicador: `cuotas_pagadas / total_cuotas`

**Lógica de generación de cuotas:**
Al crear un préstamo, el backend genera automáticamente los `LoanInstallment`:
```
para i en 1..installments:
  due_date = created_at + (i × installment_unit)
  amount = total_amount / installments
```

**API routes necesarios:**
- `GET /api/loans`
- `POST /api/loans` — crea loan + genera installments
- `PATCH /api/loans/[id]/installments/[n]` — marcar cuota pagada
- `DELETE /api/loans/[id]`

---

### 3.10 Módulo Configuración (`/configuracion`)

**Secciones:**
1. **Tarjetas** — catálogo de tarjetas del hogar (alta/baja)
2. **Tipo de cambio** — rate actual, historial, override manual por fecha
3. **Integrantes** — lista de usuarios del hogar; en SHARED: invitar nuevos vía email o código
4. **Sesión** — nombre de usuario, cerrar sesión

---

### 3.11 Gastos Fijos — Auto-generación de instancias (Q7)

**Lógica:**
- `FixedExpenseTemplate` = fuente de verdad con `baseAmount`
- Al inicio de cada mes (o cuando el usuario abre por primera vez el módulo en un mes nuevo), se crean `FixedExpense` para ese mes/año desde los templates activos
- Cada instancia mensual tiene su propio `amount` (default = `baseAmount`)
- Sobreescribir el `amount` de la instancia no afecta el template ni meses anteriores

**Implementación:**
```ts
// GET /api/fixed-templates → al listar, si no hay instancias del mes actual,
// auto-crear desde templates activos antes de responder
// O bien: endpoint POST /api/fixed-expenses/generate-month
```

---

### 3.12 PDF Export

**Contenido del PDF mensual:**
- Header: mes, ingresos totales ARS, fondo USD, distribución por usuario
- Tabla de categorías: presupuestado vs ejecutado vs disponible
- TDC: estado de cada tarjeta
- Gastos fijos: estado de cada template
- Alquiler: estado por apartamento
- Balance disponible final

**Tecnología:** `@react-pdf/renderer`
**Trigger:** Botón en `/dashboard`

---

## 4. Plan Mobile — React Native + Expo

### 4.1 Decisión tecnológica

**Stack:** React Native + Expo SDK 51+

| Criterio | Decisión |
|----------|----------|
| Lenguaje | TypeScript — mismo que el web |
| Routing | Expo Router v3 — file-based, idéntico a Next.js App Router |
| Estilos | NativeWind 4 — TailwindCSS en RN, mismas clases |
| Data fetching | TanStack React Query v5 |
| Estado global | Zustand |
| Auth storage | expo-secure-store |
| Voz | expo-av (grabación) + API voice/parse |
| Bottom sheets | @gorhom/bottom-sheet |
| Animaciones | react-native-reanimated |
| Haptics | expo-haptics |
| Testing mobile | Expo Go (iPhone, sin cuenta Developer) |

---

### 4.2 Arquitectura del repo mobile

```
omero-mobile/
├── app/                              # Expo Router (file-based)
│   ├── (auth)/
│   │   ├── login.tsx                 # Login con email + password
│   │   └── onboarding/
│   │       ├── index.tsx             # Selección tipo de cuenta
│   │       ├── personal.tsx          # Setup cuenta personal
│   │       ├── shared.tsx            # Setup cuenta compartida + invitación
│   │       └── invite.tsx            # Ingresar código de invitación
│   ├── (tabs)/
│   │   ├── _layout.tsx               # Bottom tab navigator
│   │   ├── index.tsx                 # Quick Log (Home)
│   │   ├── dashboard.tsx             # Presupuesto mensual
│   │   ├── tdc.tsx                   # Tarjetas de crédito
│   │   └── more.tsx                  # Menú Más
│   ├── ingresos/index.tsx
│   ├── gastos/index.tsx              # Mercado + General unificado
│   ├── gastos-propios/index.tsx
│   ├── movimientos/index.tsx
│   ├── alquiler/index.tsx
│   ├── ahorros/index.tsx
│   ├── deudas/index.tsx
│   ├── prestamos/index.tsx
│   ├── gastos-fijos/index.tsx
│   └── configuracion/index.tsx
├── features/
│   ├── auth/
│   │   ├── authApi.ts                # POST /api/auth/token
│   │   ├── useAuth.ts
│   │   └── authStore.ts             # Zustand: token, user, login, logout
│   ├── expenses/
│   │   ├── expenseApi.ts
│   │   └── useExpenses.ts
│   ├── budget/
│   │   ├── budgetApi.ts
│   │   └── useBudget.ts
│   ├── balance/
│   │   ├── balanceApi.ts
│   │   └── useBalance.ts            # ARS total + fondo USD + rate del día
│   ├── tdc/
│   ├── income/
│   ├── accounts/
│   ├── fixedExpenses/
│   ├── rent/
│   ├── savings/
│   ├── loans/
│   ├── debts/
│   └── voice/
│       ├── useVoiceRecorder.ts       # expo-av
│       └── parseVoice.ts
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Input.tsx
│   │   ├── ProgressBar.tsx
│   │   └── Skeleton.tsx
│   ├── sheets/
│   │   ├── ExpenseSheet.tsx
│   │   ├── IncomeSheet.tsx
│   │   ├── PaymentSheet.tsx
│   │   └── TransferSheet.tsx
│   ├── balance/
│   │   ├── BalanceCard.tsx           # Con toggle Casa/Personal
│   │   └── HousePersonalToggle.tsx
│   └── layout/
│       ├── BottomNav.tsx
│       └── MonthSelector.tsx
├── shared/
│   ├── types/
│   │   ├── expense.ts
│   │   ├── budget.ts
│   │   ├── tdc.ts
│   │   ├── household.ts             # HouseholdType enum
│   │   └── auth.ts
│   └── lib/
│       ├── budget.ts                # Mismas funciones puras que el web
│       ├── months.ts
│       ├── formatCurrency.ts
│       └── exchangeRate.ts          # Cache local de rate
├── constants/
│   ├── colors.ts
│   └── api.ts                       # BASE_URL
└── hooks/
    ├── useCurrentMonth.ts
    ├── useExchangeRate.ts           # Con fallback a cache offline
    └── useNetworkStatus.ts
```

---

### 4.3 Autenticación mobile

**Flujo completo:**
```
App open
  ↓
SecureStore.getItem('auth_token')
  ↓ token existe         ↓ no hay token
  ↓                      → /login
Validar con /api/auth/me
  ↓ válido               ↓ 401
  ↓                      → limpiar store + /login
¿user.householdId?
  ↓ sí                   ↓ no
  ↓                      → /onboarding
(tabs) Home
```

**Token en headers:**
```ts
// features/auth/apiClient.ts
const apiClient = {
  fetch: async (path: string, options?: RequestInit) => {
    const token = await SecureStore.getItemAsync('auth_token')
    return fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    })
  },
}
```

---

### 4.4 Onboarding mobile (Q5)

#### Pantalla 1 — Tipo de cuenta
```
┌─────────────────────────────────┐
│                                 │
│     Bienvenido a Omero          │
│     ¿Cómo vas a usarlo?         │
│                                 │
│  ┌───────────────────────────┐  │
│  │  👤  Solo yo              │  │  ← tap → personal setup
│  │  Gestión personal         │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │  👨‍👩‍👦  Con mi familia/pareja │  │  ← tap → shared setup
│  │  Gastos compartidos       │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │  🏢  Organización  [Soon] │  │  ← deshabilitado, badge "Próximamente"
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │  🔗  Múltiple  [Soon]    │  │  ← deshabilitado
│  └───────────────────────────┘  │
│                                 │
│  ¿Ya tenés un código de         │
│  invitación? → Unirte a un hogar│
└─────────────────────────────────┘
```

#### Pantalla 2a — Setup Personal
```
Nombre de tu cuenta
[Mis finanzas        ]

Tu nombre
[Avelino             ]

                    [Comenzar →]
```
→ Crea Household(type=PERSONAL) + User → entra a (tabs)

#### Pantalla 2b — Setup Compartida
```
Nombre del hogar
[Casa de Avelino y María]

Tu nombre
[Avelino             ]

                    [Continuar →]
```
→ Crea Household(type=SHARED) + User admin

#### Pantalla 3 — Invitar integrante (Shared)
```
Invitá a tu pareja o familia

Podés enviarles este código:

    ┌─────────────────────┐
    │     A8K-92P         │  ← código de 6 chars
    └─────────────────────┘

         [Compartir código]
         [Copiar]

                    [Ir al inicio →]
```

#### Pantalla — Unirse a un hogar existente
```
Ingresar código de invitación

[  A  ][  8  ][  K  ][ - ][  9  ][  2  ][  P  ]

El código expira en 48 horas.

                    [Unirme →]
```
→ `POST /api/households/join` con `{ token: "A8K92P" }` → asigna `householdId` al user

---

### 4.5 Pantallas — Especificación funcional

---

#### Home — Quick Log

**Toggle Casa / Personal (Q3):**
```
┌─────────────────────────────────┐
│  Buenos días, Avelino    🌙     │
│                                 │
│  [🏠 Casa]    [👤 Personal]     │  ← toggle persiste en Zustand
│                                 │
│  ┌───────────────────────────┐  │
│  │  Disponible enero         │  │  ← cambia según toggle
│  │  $1.402.000 ARS           │  │     Casa: total hogar
│  │  💵 $840 USD = $1.218.000 │  │     Personal: disponible propio
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │  🎤  ¿Qué gastaste?       │  │
│  │  ─────────────────────── │  │
│  │  Monto   [$ ____] [ARS ▾] │  │
│  │  Tipo    [Mercado ▾]      │  │  ← en modo Personal: solo "Gasto propio"
│  │  Nota    [opcional...]    │  │
│  │  Tarjeta [ninguna ▾]      │  │
│  │               [Agregar →] │  │
│  └───────────────────────────┘  │
│                                 │
│  ── Hoy ─────────────────────  │
│  🛒 Coto · $4.500 · Mercado    │
│  📱 Netflix · $7.298 · Fijo    │
│                                 │
│  🏠    📊    💳    ⋯           │
└─────────────────────────────────┘
```

**Cuando toggle = Personal:**
- BalanceCard muestra: "Disponible personal · $85.000 ARS"
- El formulario cambia a: Monto, Moneda, Concepto, Pagado (toggle sí/no)
- La lista de recientes muestra solo gastos propios del usuario

**Reglas del formulario según modo y tipo:**

| Toggle | Tipo | Campos visibles |
|--------|------|-----------------|
| Casa | Mercado | Monto, Moneda, Descripción, Tarjeta (opt) |
| Casa | General | Monto, Moneda, Descripción, Necesario/Innecesario, Tarjeta (opt) |
| Personal | — | Monto, Moneda, Concepto, Pagado (toggle) |

**Voice flow:**
1. Tap → expo-av graba (indicador visual pulsante)
2. Tap de nuevo → detiene → POST `/api/voice/parse`
3. Loading skeleton en el form
4. Respuesta llena campos
5. Si ambigüedad: campo vacío + chips de opciones
6. Usuario confirma → haptic Medium + optimistic update en lista

---

#### Dashboard Tab

**Layout:**
```
┌─────────────────────────────────┐
│  ← Enero 2025 →                 │
│                                 │
│  Ingreso total: $2.800.000      │
│  Avelino 60%   ·   María 40%    │
│  💵 $840 USD · Rate: $1.450     │
│                                 │
│  ⚠️ VISA MARIA BBVA vence en 2d │  ← sticky si hay alertas
│                                 │
│  ALQUILER          $613.000     │
│  Presup $613k · Gastado $420k   │
│  ████████████░░░░░ 68%  ✅      │
│                                 │
│  TDC               $650.000     │
│  Presup $650k · Gastado $610k   │
│  ████████████████░ 94%  ⚠️      │
│                                 │
│  MERCADO           $280.000     │
│  Presup $280k · Gastado $195k   │
│  ████████████░░░░░ 70%          │
│                                 │
│  GASTOS LIBRES (resto)          │
│  $186.000 disponibles           │
│                                 │
│  [Exportar PDF]                 │
└─────────────────────────────────┘
```

- Tap en categoría → navega al módulo correspondiente
- Pull-to-refresh
- En tipo PERSONAL: no hay splits, todo es 100% del usuario

---

#### TDC Tab

```
┌─────────────────────────────────┐
│  Tarjetas — Enero 2025          │
│  [Resúmenes]  [Por tarjeta]     │
│                                 │
│  ┌───────────────────────────┐  │
│  │  🔴 VISA MARIA BBVA       │  │  ← badge rojo = urgente (≤3 días)
│  │  💰 $185.000 a pagar      │  │
│  │  Vence: 15 ene · 2 días   │  │
│  │  Mínimo: $45.000          │  │
│  │            [Pagar →]      │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │  ✅ MC AVELINO BN         │  │
│  │  $320.000 · Pagado        │  │
│  └───────────────────────────┘  │
│                                 │
│  [+ Cargar resumen]             │
└─────────────────────────────────┘
```

**PaymentSheet:**
- Monto a pagar (pre-fill con amount_to_pay)
- Toggle "Pagar mínimo" → cambia el monto a minimum_payment
- Campo "Monto personalizado"
- Selector de cuenta origen
- Confirmar → haptic Success + marca `is_paid = true`

---

#### Gastos Propios (Pantalla dedicada, Q3)

```
┌─────────────────────────────────┐
│  ← Gastos Propios               │
│  [Avelino]  [María]             │  ← tabs (solo SHARED; en PERSONAL: sin tabs)
│                                 │
│  ┌───────────────────────────┐  │
│  │  Disponible personal      │  │  ← PROTAGONISTA
│  │  $85.000 ARS              │  │
│  │  Presup $120.000          │  │
│  │  ████████░░░░░░░ 71% usado│  │
│  └───────────────────────────┘  │
│                                 │
│  ── Enero ────────────────────  │
│  Farmacia      $3.200  ○ Pend.  │
│  Nafta         $8.500  ✅ Pago  │
│  Ropa          $12.000 ✅ Pago  │
│                                 │
│  Total: $23.700                 │
│                                 │
│  [+ Agregar gasto propio]       │
└─────────────────────────────────┘
```

**Bottom sheet de alta:**
- En SHARED: selector de usuario (pre-fill con el logueado)
- Monto, Moneda, Concepto, Pagado

---

#### Más Tab — Menú

```
┌─────────────────────────────────┐
│  Más                            │
│                                 │
│  FINANZAS                       │
│  > Ingresos               →     │
│  > Gastos Fijos           →     │
│  > Alquiler               →     │
│  > Ahorros                →     │
│  > Deudas                 →     │
│  > Préstamos              →     │
│  > Movimientos            →     │
│  > Gastos propios         →     │
│                                 │
│  CONFIGURACIÓN                  │
│  > Presupuesto mensual    →     │
│  > Cuentas                →     │
│  > Tarjetas               →     │
│  > Tipo de cambio         →     │
│  > Integrantes            →     │  ← solo en SHARED
│                                 │
│  > Cerrar sesión                │
└─────────────────────────────────┘
```

---

#### Tipo de cambio offline (Q6)

```ts
// hooks/useExchangeRate.ts
export function useExchangeRate() {
  return useQuery({
    queryKey: ['exchange-rate'],
    queryFn: async () => {
      const res = await apiClient.fetch('/api/exchange-rate')
      const data = await res.json()
      // Guardar en AsyncStorage como fallback offline
      await AsyncStorage.setItem('last_exchange_rate', JSON.stringify(data))
      return data
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 horas
    gcTime: 48 * 60 * 60 * 1000,
    // Si falla la red, React Query retorna el cache automáticamente
    // Si no hay cache, placeholderData desde AsyncStorage:
    placeholderData: async () => {
      const cached = await AsyncStorage.getItem('last_exchange_rate')
      return cached ? JSON.parse(cached) : null
    },
  })
}
```

Cuando el formulario usa el rate y este viene del cache offline, se muestra un indicador:
```
1 USD = $1.450 ARS ⚠️ (rate del 10 abr)
```

---

### 4.6 Design system mobile

**Paleta (NativeWind):**
```ts
// constants/colors.ts
export const colors = {
  // Dark (default)
  bgPrimary: '#0A0A0F',
  bgCard: '#13131A',
  bgElevated: '#1C1C27',
  textPrimary: '#F0F0FF',
  textSecondary: '#8888AA',
  accent: '#6366F1',
  green: '#22C55E',
  red: '#EF4444',
  amber: '#F59E0B',
  border: '#2A2A3D',
  // Light
  bgPrimaryLight: '#F8F9FF',
  bgCardLight: '#FFFFFF',
  bgElevatedLight: '#EEF0FF',
  textPrimaryLight: '#0F0F1A',
  textSecondaryLight: '#6B7280',
  accentLight: '#4F46E5',
}
```

**Tipografía:** Inter via `@expo-google-fonts/inter`

**Componentes UI base:**

| Componente | Props clave |
|------------|-------------|
| `Button` | `variant`: primary/secondary/ghost/destructive · `size`: sm/md/lg |
| `Card` | `elevated`: boolean (usa bgElevated vs bgCard) |
| `Badge` | `status`: paid/pending/urgent/info/soon |
| `Input` | `label`, `error`, `hint` |
| `BottomSheet` | snap points configurables (50%/90%) |
| `ProgressBar` | `value` 0-1, `color` por umbral |
| `MonthSelector` | prev/next, deshabilita meses futuros vacíos |
| `CurrencyToggle` | ARS/USD con hint de rate actual |
| `Skeleton` | width, height, variant: text/card/row |

**Haptics:**
| Acción | Feedback |
|--------|----------|
| Confirmar gasto | `ImpactFeedbackStyle.Medium` |
| Marcar TDC pagada | `NotificationFeedbackType.Success` |
| Toggle switches | `ImpactFeedbackStyle.Light` |
| Error / validación | `NotificationFeedbackType.Error` |
| Swipe-to-delete | `ImpactFeedbackStyle.Heavy` |

---

### 4.7 Data fetching — React Query

**Config global:**
```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 2,
      networkMode: 'offlineFirst',
    },
  },
})
```

**Optimistic updates en mutaciones críticas:**
- Crear gasto → aparece inmediatamente en la lista
- Marcar TDC pagada → badge cambia inmediatamente
- Marcar gasto fijo pagado → toggle actualiza sin esperar

---

### 4.8 Offline strategy

**v1 (MVP):** Cache-first con React Query

| Operación | Estrategia |
|-----------|------------|
| Reads | Cache local, refetch en focus / reconexión |
| Writes | Optimistic update + retry automático (React Query) |
| Rate USD | Cache 24h en AsyncStorage, badge de "rate viejo" si > 1 día |
| Formularios | Nunca bloquear por falta de conectividad — guardar en cola |

**v2 (post-MVP):** Offline write queue
- Mutaciones fallidas se encolan en AsyncStorage
- NetInfo listener → retry automático al reconectar
- Banner: "2 cambios pendientes de sincronizar"

---

## 5. Gaps y Mejoras identificadas

### 5.1 Gaps funcionales críticos

| # | Gap | Impacto | Decisión |
|---|-----|---------|----------|
| G1 | Sin auth real + onboarding | Bloquea mobile | Auth + onboarding en Fase 0 |
| G2 | Balance USD no suma al disponible | Bug funcional | Corregir en Fase 0 |
| G3 | Sin módulo Ingresos | No hay gestión de ingresos | Fase 1 |
| G4 | Sin módulo Alquiler | Presupuesto muestra sin UI de carga | Fase 1 |
| G5 | Sin módulo Ahorros | No hay gestión de ahorros | Fase 1 |
| G6 | Sin auto-generación de instancias fijas | Templates no se instancian por mes | Fase 1 |
| G7 | Gastos Propios sin pantalla | Solo se cargan desde Home | Fase 1 |
| G8 | Sin módulo Deudas | Modelo existe, UI no | Fase 2 |
| G9 | Sin módulo Préstamos | Modelo existe, UI no | Fase 2 |
| G10 | Accounts sin historial | Saldos sin auditoría | Fase 2 |
| G11 | Sin PDF export | Feature del spec | Fase 3 |
| G12 | Sin Configuración completa | Tipo de cambio manual sin UI | Fase 1 |

### 5.2 Mejoras de UX

| # | Mejora | Descripción |
|---|--------|-------------|
| U1 | Edición de gastos existentes | No hay forma de editar un gasto ya creado |
| U2 | Confirmación antes de borrar | No hay dialog de confirmación |
| U3 | Filtros en Movimientos | Solo por categoría; agregar por persona, fecha, monto |
| U4 | Búsqueda de texto libre | No hay buscador |
| U5 | Validación consistente de forms | Errores no se muestran de forma uniforme |
| U6 | Estado vacío con ilustración | Módulos vacíos sin feedback visual |

### 5.3 Mejoras técnicas

| # | Mejora | Descripción |
|---|--------|-------------|
| T1 | Error boundaries globales | Sin manejo de errores en el cliente |
| T2 | Loading states (skeletons) | Algunos componentes sin estado de carga |
| T3 | CI/CD GitHub Actions | Tests no corren automáticamente |
| T4 | Rate limiting en API | Sin protección contra abuso |
| T5 | Monitoreo de errores | Sin integración Sentry |
| T6 | Tipos compartidos web/mobile | Actualmente duplicados — considerar monorepo |

---

## 6. Roadmap

### Fase 0 — Fundaciones (semana 1)
- [ ] Auth real con NextAuth.js
- [ ] Endpoint `POST /api/auth/token` para mobile
- [ ] Reemplazar HOUSEHOLD_ID hardcodeado en todos los API routes
- [ ] Corregir cálculo de balance: USD suma al disponible con rate del día
- [ ] Seed: Household + usuarios Avelino y María

### Fase 1 — Web: gaps críticos (semanas 1-2)
- [ ] Módulo Ingresos (`/ingresos`) — CRUD completo
- [ ] Módulo Alquiler (`/alquiler`) — CRUD completo
- [ ] Módulo Ahorros (`/ahorros`) — CRUD completo
- [ ] Módulo Gastos + Mercado unificado (`/gastos`)
- [ ] Módulo Gastos Propios (`/gastos-propios`) con disponible personal
- [ ] Toggle Casa/Personal en BalanceCard (home)
- [ ] Auto-generación de instancias de Gastos Fijos por mes
- [ ] Configuración básica: tarjetas, tipo de cambio manual, integrantes
- [ ] Schema: HouseholdType + HouseholdInvitation

### Fase 2 — Mobile core (semanas 2-4)
- [ ] Setup Expo + Expo Router + NativeWind
- [ ] Auth flow: login screen + token storage
- [ ] Onboarding: selección de tipo + setup personal + setup shared + invitación
- [ ] Quick Log: formulario + voice + toggle Casa/Personal + lista recientes
- [ ] Dashboard: presupuesto mensual + alertas TDC
- [ ] TDC: estados + payment sheet
- [ ] Gastos Propios: pantalla dedicada con disponible personal

### Fase 3 — Mobile módulos secundarios (semanas 4-5)
- [ ] Ingresos, Gastos Fijos, Alquiler (CRUD)
- [ ] Ahorros, Deudas, Préstamos (CRUD)
- [ ] Movimientos (ledger filtrable)
- [ ] Configuración (tarjetas, cuentas, tipo de cambio, integrantes)
- [ ] Offline rate cache + indicador de rate viejo

### Fase 4 — Completar y polish (semana 6)
- [ ] Deudas y Préstamos (web)
- [ ] Edición de gastos existentes (web + mobile)
- [ ] PDF export
- [ ] CI/CD GitHub Actions
- [ ] Error boundaries + Sentry
- [ ] Validación de formularios consistente

### Fase 5 — Producción mobile (post-MVP)
- [ ] EAS Build → TestFlight (iOS)
- [ ] EAS Build → APK (Android)
- [ ] Push notifications: TDC próximas a vencer, cuotas de préstamo
- [ ] Offline write queue (cola de mutaciones)
- [ ] MercadoPago API integration
- [ ] Coming soon: tipo Organización

---

## 7. Preguntas resueltas

| # | Pregunta | Decisión final |
|---|----------|---------------|
| Q1 | USD sin convertir en balance | Suma al disponible con `rate_hoy`. Fondo USD es informativo. |
| Q2 | Gastos Generales vs Mercado | Un solo módulo/formulario. Dashboard resta según tipo. |
| Q3 | Gastos Propios | Pantalla dedicada. Toggle en Home para ver disponible. |
| Q4 | Edición simultánea | Last-write-wins. OK. |
| Q5 | Onboarding mobile | Completo con 3 tipos (2 CS): Personal, Shared, Org, Múltiple. |
| Q6 | Tipo de cambio offline | Cache local 24h. Badge de "rate viejo" si > 1 día. |
| Q7 | Templates Gastos Fijos | Auto-instancian por mes. Instancia sobreescribible sin afectar template. |

---

*Versión 2.0 — 2026-04-11*
*Revisión planificada: al iniciar Fase 2 (mobile core)*
