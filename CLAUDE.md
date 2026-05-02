@AGENTS.md

# omero-finance — Project Guide

App de presupuesto familiar para reemplazar una planilla Google Sheets. Dos usuarios: Avelino y Maria.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Prisma 7** + **Neon** (PostgreSQL serverless)
- **TailwindCSS 4** + **shadcn/ui** + **Lucide React**
- **OpenAI** (Whisper + GPT-4o-mini para voz)
- **Vercel** deployment
- Custom session auth (NO NextAuth — el paquete está en deps pero no se usa)

## Estructura clave

```
src/
├── app/
│   ├── page.tsx              # Home — Quick Log
│   ├── login/page.tsx
│   ├── dashboard/page.tsx    # Resumen presupuesto mensual
│   ├── tdc/page.tsx          # Tarjetas de crédito
│   ├── movimientos/page.tsx  # Historial
│   └── mas/                  # Sub-páginas: ahorros, alquiler, gastos-fijos, prestamos, presupuesto, cuentas
├── components/               # 60+ componentes por feature
├── lib/
│   ├── auth.ts               # requireSession(), Session type
│   ├── budget.ts             # Cálculos de presupuesto
│   ├── dashboard.ts          # Agregación del dashboard
│   └── prisma.ts             # Singleton del cliente
└── app/api/                  # ~28 rutas API
```

## Auth

Custom session: cookie HTTP-only `omero_session` + Bearer token (para mobile).  
Helper: `requireSession(request)` en `src/lib/auth.ts` — úsalo en TODOS los API routes protegidos.  
No hay sign-up UI — los usuarios se crean por seed/invitación.

## Base de datos — modelos principales

`Household`, `User`, `Session` — auth y multi-tenant  
`Income`, `CreditCardStatement`, `FixedExpense(Template)`, `GroceryExpense`, `HouseholdExpense`, `PersonalExpense` — gastos  
`RentPayment`, `Saving`, `Loan`, `LoanInstallment`, `Debt` — módulos CRUD  
`Account`, `AccountTransfer` — cuentas y transferencias  
`BudgetConfig`, `Card`, `ExchangeRate`, `MercadoPagoMovement` — config y externos  

Multi-tenancy: **todos los queries deben filtrar por `householdId`** (viene de la sesión).

## Convenciones API

- `GET /api/[resource]` — lista, siempre con `householdId` del token
- `POST /api/[resource]` — crear
- `POST /api/[resource]/[id]` — actualizar (no PUT/PATCH)
- `DELETE /api/[resource]/[id]` — eliminar
- Siempre retornar `{ error: string }` con el status code apropiado en errores

## Presupuesto — 9 categorías

`ALQUILER | TDC | GASTOS_FIJOS | MERCADO | GASTOS_LIBRES | AHORRO_CASA | AHORRO_VACACIONES | INVERSION_AHORRO | OTROS`

`GASTOS_LIBRES` es el remanente automático — no se configura directamente.

## Multi-moneda

ARS y USD. Cada registro guarda un `dollar_rate_snapshot` al momento de la entrada — **nunca se actualiza después de guardar**.

## Tarjetas configuradas

`VISA MARIA BBVA`, `VISA MARIA CP`, `VISA AVELINO BN`, `MC AVELINO BN`, `VISA AVELINO BK`, `MC AVELINO MP`

## Estado del MVP (mayo 2026)

**Implementado:** auth, quick log (voz + formulario), dashboard mensual, TDC, gastos fijos, income, alquiler, ahorros, préstamos, deudas, cuentas, transferencias, tipos de cambio, tema oscuro/claro.

**Parcial:** sync MercadoPago (schema ok, integración incompleta), household invitations (schema ok, UI sin terminar).

**Pendiente:** sign-up UI, perfil de usuario, reportes/PDF, notificaciones, importación CSV, analytics.

## Notas importantes

- Prisma 7 tiene cambios de API — siempre verificar `node_modules/@prisma/client` antes de usar métodos de ORM.
- TailwindCSS 4 usa `@import "tailwindcss"` en lugar de las directivas `@tailwind` de v3.
- Tests: Jest (unitarios en `src/lib/`) + Playwright (E2E configurado, no escrito completamente).
- `next-auth` está en `package.json` pero **no se usa** — no importar ni configurar.
