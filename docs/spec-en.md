# Spec — Omero Finance (English)
> Version 1.1 — Final decisions incorporated

## Overview

Personal web application for monthly household budget management for two people (Avelino and Maria). Replaces a Google Sheets spreadsheet that consolidated income, credit cards, fixed expenses, groceries, free spending, savings, debts, and loans into a single monthly view.

**Stack:** Next.js 14+ (App Router) · Neon (serverless PostgreSQL) · Prisma · Vercel
**Users:** 2 household members (Avelino and Maria)
**Base currency:** Argentine Pesos (ARS). Automatic USD→ARS conversion via API + rate snapshot saved at time of entry.
**Auth:** None (personal use / private deploy)

---

## Design Decisions

| Question | Decision |
|----------|----------|
| AYACUCHO | Discarded — out of scope |
| Exchange rate | Automatic API (Bluelytics) as default. When entering a USD amount, the current rate is saved as a fixed snapshot on that record, preserving the historical value. |
| PRISMA Debt | Removed as standalone module. Generalized into a unified **Loans** module with two sub-types: loans given (to collect) and loans taken (installment payments). |
| TDC notifications | Yes — due date alerts |
| PDF export | Yes — monthly summary export |

---

## Domain Entities

### 1. Income (`income`)
| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| month | string | "enero", "febrero", etc. |
| year | int | Year |
| type | enum | Sueldo · Freelance · Ahorros · Pago de deuda · Remanentes · Prestamo · Inversion |
| person | enum | Avelino · Maria · Conjunto |
| amount | decimal | Amount in ARS |
| description | string | Free-text description |
| created_at | timestamp | |

### 2. Credit Card Monthly Statement (`credit_card_statement`)
| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| month | string | Billing month |
| year | int | Year |
| card_name | string | "VISA MARIA BBVA", "MC AVELINO BN", etc. |
| due_date | date | Payment due date |
| minimum_payment | decimal | Minimum payment amount |
| total_amount | decimal | Full statement amount (ARS) |
| usd_amount | decimal | USD portion (optional) |
| dollar_rate_snapshot | decimal | USD→ARS rate at time of entry (fixed, not updated later) |
| custom_amount | decimal | Override payment amount (optional) |
| amount_to_pay | decimal | Computed final payment amount |
| pay_minimum | bool | Pay minimum only |
| is_paid | bool | Payment completed |

**`amount_to_pay` logic:**
- If `custom_amount` set → use `custom_amount`
- If `pay_minimum` → use `minimum_payment`
- Otherwise → `total_amount + (usd_amount * dollar_rate_snapshot)`

**Notifications:** Dashboard alert X days before `due_date` when `is_paid = false`. Configurable (default: 3 days).

### 3. Fixed Expense (`fixed_expense`)
| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| concept | string | "LUZ", "TELEFONO", "AUTO", etc. |
| subcategory | string | "1G", "NETFLIX", etc. (optional) |
| amount | decimal | Monthly amount |
| is_paid | bool | Paid this month |
| month | string | Applicable month |
| year | int | Year |

**Predefined concepts:** LUZ · TELEFONO · AUTO · SUSCRIPCIONES (NETFLIX, MELI+, BRUBANK, APPLE) · Gimnasio · Consulta dientes · Contador · Limpieza (x4 weeks) · Cocinero (x4 weeks)

### 4. Grocery Expense (`grocery_expense`)
| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| month | string | Month |
| year | int | Year |
| description | string | Store / item description |
| amount | decimal | Amount |
| created_at | timestamp | |

### 5. Free Spending / Miscellaneous (`misc_expense`)
| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| month | string | Month |
| year | int | Year |
| description | string | Description |
| expense_type | enum | Innecesario · Necesario |
| person | enum | Avelino · Maria · Conjunto |
| amount | decimal | Amount |
| created_at | timestamp | |

### 6. Personal Expense (`personal_expense`)
| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| month | string | Month |
| year | int | Year |
| concept | string | Description |
| person | enum | Avelino · Maria |
| amount | decimal | Amount |
| is_paid | bool | Paid |
| created_at | timestamp | |

### 7. Rent & Building Fees (`rent_payment`)
| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| month | string | Month |
| year | int | Year |
| type | enum | ALQUILER · EXPENSAS · TRABAJOS |
| apartment | string | "1G", "1A" |
| amount | decimal | Amount |
| description | string | Description / recipient |
| cbu_alias | string | CBU or payment alias (optional) |

### 8. Savings & Investments (`saving`)
| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| date | date | Date |
| description | string | Description |
| type | enum | Ahorro · Viaje · Inversión |
| amount | decimal | Amount |
| platform | string | "MP", "BALANZ", etc. |

### 9. Loan (`loan`)
Unified module for loans given and loans taken. Replaces the old "Prestamos" and "PRISMA DEUDA" sheets.

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| direction | enum | `dado` (given, to collect) · `tomado` (received, to repay) |
| counterpart | string | Person's name |
| person | enum | Avelino · Maria · Conjunto |
| payment_method | string | "Transferencia", etc. |
| principal | decimal | Loan principal |
| installments | int | Number of installments |
| installment_unit | enum | weekly · monthly |
| interest_rate | decimal | Rate per period (e.g. 0.18) |
| total_amount | decimal | Total to collect/pay (computed: `principal + principal * rate * installments`) |
| created_at | timestamp | |
| notes | string | Additional notes |

#### Loan Installment (`loan_installment`)
| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| loan_id | uuid | FK → loan |
| installment_number | int | Installment number |
| due_date | date | Due date |
| amount | decimal | Installment amount |
| is_paid | bool | Paid |
| paid_date | date | Actual payment date |

### 10. Informal Debt to Collect (`debt`)
For non-installment debts (e.g. from a side business).

| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| date | date | Start date |
| concept | string | Description |
| debtor | string | Debtor name |
| total_amount | decimal | Total amount owed |
| amount_paid | decimal | Amount already received |
| remaining | decimal | Remaining (computed) |
| status | enum | Activa · Saldada |

### 11. MercadoPago Movement (`mercadopago_movement`)
| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| release_date | date | Date |
| transaction_type | string | Original transaction description |
| reference_id | string | Reference ID |
| net_amount | decimal | Net amount |
| partial_balance | decimal | Running balance |
| origin | string | Assigned category |
| sub_origin | string | Sub-category (optional) |

### 12. Budget Configuration (`budget_config`)
| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| month | string | Month |
| year | int | Year |
| category | enum | See below |
| manual_percentage | decimal | Override percentage |
| manual_amount | decimal | Override fixed amount |
| is_reserved | bool | Reserved in distribution |

**Categories:**
- `ALQUILER` → auto from `rent_payment`
- `TDC` → auto from `credit_card_statement`
- `GASTOS_FIJOS` → sum of `fixed_expense`
- `MERCADO` → manual budget vs. actual from `grocery_expense`
- `GASTOS_LIBRES` → remainder (never negative)
- `AHORRO_CASA` → manual % of income
- `AHORRO_VACACIONES` → fixed amount or manual %
- `INVERSION_AHORRO` → manual %
- `OTROS` → sum of `misc_expense`

### 13. Exchange Rate (`exchange_rate`)
| Field | Type | Description |
|---|---|---|
| id | uuid | PK |
| date | date | Date |
| usd_ars | decimal | USD→ARS rate |
| source | enum | `api` · `manual` |

**Behavior:**
- On app load, fetch from Bluelytics (or similar free public API) and save/update today's rate.
- When a USD amount is entered anywhere (TDC, income, etc.), the current rate is saved as `dollar_rate_snapshot` on that record. This field is never auto-updated after save.
- Manual override is always available for any day's rate.

---

## Main View — Monthly Dashboard

Replicates the **Presupuesto MENSUAL** sheet logic.

### Header
| Field | Calculation |
|---|---|
| Selected month | Month/year picker (default: current month) |
| Total income | `SUM(income WHERE month=X AND year=Y)` |
| Maria's total | `SUM(income WHERE person='Maria')` |
| Avelino's total | `SUM(income WHERE person='Avelino')` |
| Maria % | `maria / total` |
| Avelino % | `avelino / total` |
| Today's rate | From `exchange_rate` |
| Surplus/Available | `total_income - SUM(all category amounts)` |

### Category table
| Column | Description |
|---|---|
| Category | Name |
| % Override | Manual percentage (inline editable) |
| Amount Override | Fixed amount (inline editable) |
| Computed % | If no override: `(amount / income) * 100` |
| Final Amount | `% * income` or override amount |
| Maria | `final * maria_%` |
| Avelino | `final * avelino_%` |
| Used | Actual spend in category |
| Available | `final - used` |
| Avail. Maria | `maria - maria_used` |
| Avail. Avelino | `avelino - avelino_used` |
| Reserved | Boolean toggle |

---

## Design System

### Color Palette

The system uses **CSS variables** to support dark and light modes without duplicating components.

#### Dark Mode (default)
| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#0A0A0F` | Main background |
| `--bg-card` | `#13131A` | Cards |
| `--bg-elevated` | `#1C1C27` | Inputs, modals |
| `--text-primary` | `#F0F0FF` | Main text |
| `--text-secondary` | `#8888AA` | Labels, placeholders |
| `--accent` | `#6366F1` | Indigo — primary action |
| `--accent-green` | `#22C55E` | Positive / available |
| `--accent-red` | `#EF4444` | Negative / overspent |
| `--accent-amber` | `#F59E0B` | Warning / pending |
| `--border` | `#2A2A3D` | Card borders |

#### Light Mode
| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#F8F9FF` | Main background |
| `--bg-card` | `#FFFFFF` | Cards |
| `--bg-elevated` | `#EEF0FF` | Inputs, modals |
| `--text-primary` | `#0F0F1A` | Main text |
| `--text-secondary` | `#6B7280` | Labels |
| `--accent` | `#4F46E5` | Slightly deeper indigo |
| `--accent-green` | `#16A34A` | |
| `--accent-red` | `#DC2626` | |
| `--accent-amber` | `#D97706` | |
| `--border` | `#E5E7F0` | |

**Implementation:** `class="dark"` on `<html>` controlled by `next-themes`. Toggle persisted in `localStorage`, applied SSR-safe (no flash).

### Typography
- **Font:** Geist Sans — fallback: system-ui
- **Numbers:** `font-variant-numeric: tabular-nums` to prevent layout shift
- **Sizes:** `text-4xl` for main balances · `text-base` for lists · `text-sm` for labels

### Key UI Patterns
- Cards: `rounded-2xl` + subtle `border` + `backdrop-blur` on overlays
- Primary buttons: `--accent` background, no shadow, `rounded-xl`
- Forms open as **bottom sheets** (not centered modals — more natural on mobile)
- Haptic feedback via Vibration API on expense confirmation

---

## UX — Expense Entry Flow

### Main Screen: Quick Log

The home screen combines the voice panel **and** the form simultaneously. The microphone is the hero but the form is always visible below — no mode switching required.

```
┌──────────────────────────────────────┐
│  Good morning, Avelino   🌙 / ☀️    │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  Available — January           │  │
│  │  $1,240,000 ARS                │  │
│  │  💵 USD 840                    │  │
│  └────────────────────────────────┘  │
│                                      │
│  [🏠 Household]   [👤 Personal]      │  ← Toggle
│                                      │
│  ┌────────────────────────────────┐  │
│  │  🎤  What did you spend?       │  │  ← Tap to speak
│  │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │  │
│  │  Amount   [    $ ____  ] [ARS▾]│  │  ← Form always visible
│  │  Type     [Groceries▾]         │  │
│  │  Note     [optional...]        │  │
│  │  Card     [none▾]              │  │
│  │                   [Add  →]     │  │
│  └────────────────────────────────┘  │
│                                      │
│  ── Today ─────────────────────────  │
│  🛒 Coto · $4,500 · Groceries        │
│  📺 Netflix · $7,298 · Fixed         │
│                                      │
│  🏠      📊      💳      👤      ⋯  │  ← Nav
└──────────────────────────────────────┘
```

**When voice fills in fields, the form updates in real-time** — the user sees the interpreted values and can edit before confirming.

### Voice Flow
1. User taps the microphone area and speaks: *"I spent 5000 at the market with Avelino's Mastercard"*
2. Whisper transcribes → Claude Haiku (or GPT-4o mini) extracts fields: `{ amount: 5000, category: "groceries", card: "mastercard", user: "Avelino" }`
3. Fields are pre-filled in the visible form
4. If ambiguous → **only that field** is left empty and highlighted: `Which Mastercard?` chips: `[MC BN]` `[MC MP]`
5. User confirms (or edits) and taps **Add**

### Form Flow (no voice)
Form adapts based on the [Household / Personal] toggle:

**Household → Groceries**
- Amount + [ARS / USD] toggle
- Description (e.g. "Coto")
- Card (optional)

**Household → General**
- Amount + currency
- Description
- Classification: [Needed] [Unnecessary]
- Card (optional)

**Personal**
- Amount + currency
- Description
- Paid toggle

### Field visibility rules
- "Card" only shown if type ≠ "Fixed" (fixed expenses have their own screen)
- USD toggle always visible — when enabled, shows current rate hint: `1 USD = $1,477`
- If USD without conversion: saved to USD fund. If "Convert to ARS" enabled: saves both with snapshot.

---

## Screens / Modules

| Route | Module |
|-------|--------|
| `/` | Quick log + recent expenses |
| `/dashboard` | Monthly budget summary |
| `/ingresos` | Monthly income |
| `/tdc` | Credit cards |
| `/gastos-fijos` | Fixed expenses |
| `/mercado` | Grocery spending |
| `/gastos` | Household general expenses |
| `/gastos-propios` | Personal expenses |
| `/alquiler` | Rent & building fees |
| `/ahorros` | Savings & investments |
| `/deudas` | Informal debts |
| `/prestamos` | Loans (given & taken) |
| `/mercadopago` | MP sync + "To categorize" queue |
| `/configuracion` | Users, cards, exchange rate, settings |

---

## Business Rules

1. **Gastos Libres** = `income - (alquiler + TDC + gastos_fijos + mercado + ahorro_casa + ahorro_vacaciones + inversion + otros)` → min 0.
2. **TDC amount_to_pay**: custom → minimum → total + (USD × rate_snapshot).
3. **Person %**: person income / total month income.
4. **Per-person available per category**: `category_amount × person_% - person_spent`.
5. **Auto categories** (ALQUILER, TDC, GASTOS_FIJOS): amount comes from their tables, not editable as percentages.
6. **Exchange rate**: API updates daily rate on load; snapshot is saved per record and never changed after save.
7. **TDC alert**: trigger when `due_date - today ≤ 3 days` and `is_paid = false`.
8. **Loan total**: `principal + (principal × rate × installments)`.

---

## PDF Export

Monthly summary PDF includes:
- Header: month, total income, per-person split
- Budget category table: budgeted vs. actual
- Pending credit card payments
- Pending fixed expenses
- Final available balance

---

## Testing Strategy

### Stack
| Layer | Tool | Purpose |
|-------|------|---------|
| Unit | **Jest** + **React Testing Library** | Components, calculation functions, utils |
| Integration | **Jest** + **Prisma Client mock** | Server Actions, API routes |
| E2E | **Playwright** | Full critical-path flows |

### What to test per module

#### Calculation functions (unit — no DB)
- `calculateBudgetCategory(income, config)` → final amount per category
- `calculateAvailablePerPerson(category, users)` → available per user
- `calculateAmountToPay(statement)` → TDC logic (custom → minimum → total+USD)
- `calculateLoanTotal(principal, rate, installments)` → loan total
- `calculateFunds(movements)` → ARS and USD funds separately

#### Components (unit with RTL)
- `QuickLogForm` — voice pre-fill, fields visible by Casa/Personal toggle
- `BudgetTable` — renders categories, computes available, alerts overspent
- `CreditCardCard` — shows paid status, near-due-date alert
- `CurrencyToggle` — ARS/USD switch shows rate hint
- `ThemeToggle` — toggles `class` on `<html>`, persists in localStorage

#### API Routes / Server Actions (integration)
- `POST /api/expenses` — creates expense, saves `dollar_rate_snapshot` for USD
- `GET /api/budget/[year]/[month]` — returns full monthly summary
- `POST /api/mercadopago/sync` — dedup by `mp_reference_id`, auto-categorize
- `GET /api/exchange-rate` — returns today's rate, fallback to last available
- `POST /api/voice/parse` — receives transcript, returns extracted fields + ambiguities

#### E2E with Playwright (critical flows)
1. **Quick expense entry** — open app → type amount → select type → confirm → appears in list
2. **Voice entry** — speak → form pre-fills → resolve ambiguity → confirm
3. **Monthly dashboard** — switch month → table updates → edit category % inline → persists
4. **Pay credit card** — mark as paid → alert disappears → adds to "used"
5. **Dark/Light mode** — toggle → theme changes → reload → theme persists
6. **Login / session** — login → reload → still logged in → logout → redirects to login

### Conventions
- Test files: `*.test.ts` (unit/integration) · `*.spec.ts` (E2E)
- Location: next to the file they test (`src/lib/budget.test.ts`), except E2E which lives in `/e2e/`
- Every new feature or bug fix includes its test
- CI: tests run on every push via GitHub Actions

### Coverage targets
| Type | Target |
|------|--------|
| Calculation functions | 100% |
| Critical components | 80%+ |
| API routes | 80%+ |
| E2E critical flows | 6 flows covered |

---

## Technical Constraints

- **Database:** Neon (serverless PostgreSQL) — free tier (0.5 GB)
- **Deploy:** Vercel — free tier (personal)
- **Framework:** Next.js 14+ App Router
- **ORM:** Prisma
- **Auth:** NextAuth.js (JWT, 30-day session, no auto-logout)
- **Language:** TypeScript
- **UI:** TailwindCSS + shadcn/ui + next-themes (dark/light)
- **Exchange rate API:** Bluelytics
- **Voice:** Whisper API (transcription) + Claude Haiku or GPT-4o mini (intent parsing)
- **MP API:** MercadoPago OAuth 2.0

---

## Data Migration from Google Sheets

1. Export each relevant tab as CSV (skip: AYACUCHO, Claude Cache, Alquiler 2024)
2. Migration script at `/scripts/import.ts` — reads CSVs, upserts into DB
3. Normalize month names: lowercase, no accents
4. Historical data range: October 2024 → January 2026
