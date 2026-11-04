# Refactor "Hogar → Finanzas" — Contrato compartido

Fuente de verdad del diseño: https://claude.ai/artifact/EKRHHmwFTNEZMeHJq3RU4y (leer con la herramienta Artifact, action `read`).
Rama de integración: `develop` (parte de `main`). Una rama `feat/finanzas-sN-*` por semana, PR hacia `develop`.

## Principios (no se discuten en los specs)

1. **No renombrar `Household`** en la base. En la UI se muestra "Finanza". Todo lo nuevo = tablas/columnas con default; los datos actuales quedan como finanza PERSONAL de su dueño.
2. **Una sola regla de acceso**: `canAccess(user, recurso, accion)` en `src/lib/plan/access.ts`. Ningún endpoint filtra a mano por `householdId`. Roles: `ADMIN | EDITOR | VIEWER`.
3. **Todo movimiento (`PlanEntry`) tiene `accountId` y `householdId` (finanza)**. Origen en `PlanEntry.source`: `MANUAL | COVERAGE | LOAN_OUT | GROUP | GROUP_BACK`.
4. **Un solo mecanismo de vínculo**: `EntryLink` (ingreso → gasto, tipo `REIMBURSEMENT | BUSINESS`). Gasto neto = gasto − ingresos vinculados (mín. 0); el excedente cuenta como ingreso.
5. **Movimiento de otra finanza** (no miembro): se ve como "Otra finanza · monto · MOV-XXXX" (`refCode`), sin descripción ni categoría.
6. Moneda: ARS/USD con `dollar_rate_snapshot` inmutable (regla existente).
7. Errores API: `{ error: string }` con status apropiado. Verbos estándar en endpoints nuevos: `POST` crear, `PATCH` actualizar, `DELETE` borrar. Los endpoints existentes (PATCH/PUT) no se renombran ni se deprecan salvo que una ruta tenga una versión incompatible; la app publicada debe seguir funcionando.
8. Migraciones Prisma aditivas, una por semana, sin tocar datos viejos; con script de backfill idempotente.

## Entidades por semana (nombres fijos — no inventar otros)

| Semana | Entidades nuevas / modificadas |
|---|---|
| S1 | `Household.kind (PERSONAL|SHARED)`, `Household.ownerUserId`, `Household.color`, `FinanceMember(userId, householdId, role)`, helper `canAccess`, header/ctx `x-finance-id` (finanza activa), acción "Mover a finanza" |
| S2 | `PlanAccount(ownerUserId, type, currency, openingBalance)`, `AccountFinance`, `PlanAccountTransfer`, `PlanEntry.accountId`, `Card.ownerUserId`, `CardFinance`, `PlanCardPurchase.householdId`, reparto de pago de resumen por finanza |
| S3 | `EntryLink`, `FinanceCoverage`, `PlanCardStatement.carryOver`, `PlanEntry.source/linkId/refCode`, ajuste `buildSummary` |
| S4 | `Contact(ownerUserId, name, phone, email, linkedUserId)`, `Invite`, `PlanLoan.contactId | counterpartyHouseholdId`, `LOAN_OUT`, toggle Patrimonio |
| S5-6 | `Group`, `GroupMember(userId|contactId)`, `GroupExpense`, `GroupExpenseShare`, `GroupSettlement` |
| Web | Layout escritorio de todo lo anterior + mascota Omero + Movimientos |

## Dependencias

S1 → S2 → S3 → S4 → S5-6. La web (transversal) consume cada semana al terminar; su spec define qué pantalla de escritorio corresponde a cada una.

## Estructura obligatoria de cada spec (Markdown, en español)

1. **Objetivo y "Listo cuando"** (criterio de aceptación observable)
2. **Alcance / Fuera de alcance**
3. **Spec funcional**: historias de usuario, reglas de negocio, casos borde, textos de UI clave
4. **Spec técnico**: cambios Prisma (bloque `model` exacto), migración + backfill, endpoints (método, ruta, body, respuesta, permisos), helpers/libs (`src/lib/plan/*`), impacto en `buildSummary`, pantallas y componentes mobile (`mobile/app`, `mobile/src`) y web (`src/app/plan`)
5. **Plan de tareas**: lista numerada, atómica, con dependencias y marcando cuáles son paralelizables
6. **Tests**: unitarios (Jest en `src/lib/plan`), integración API, E2E manual en iPhone
7. **Riesgos y decisiones abiertas** (si no hay, escribir "ninguna")
8. **Contrato hacia la siguiente semana**: qué deja listo y qué asume la siguiente

Antes de escribir: leer el artifact, `prisma/schema.prisma`, `src/lib/plan/`, `src/app/api/plan/`, y las pantallas mobile relevantes. Citar rutas reales de archivos. No inventar entidades fuera de este contrato; si hace falta una, listarla en "Riesgos y decisiones abiertas".
