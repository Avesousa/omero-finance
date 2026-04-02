import { BalanceCard } from "@/components/quick-log/balance-card";
import { ExpenseFormContainer } from "@/components/quick-log/expense-form-container";
import { RecentExpenses, type RecentExpense } from "@/components/quick-log/recent-expenses";

// TODO: replace with real DB queries once auth is wired up
const MOCK_BALANCE = { availableArs: 1_240_000, availableUsd: 840 };
const MOCK_RATE = 1477;
const MOCK_EXPENSES: RecentExpense[] = [
  {
    id: "1",
    description: "Coto",
    amount: 4500,
    currency: "ARS",
    category: "mercado",
    createdByName: "Avelino",
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: "2",
    description: "Netflix",
    amount: 7298,
    currency: "ARS",
    category: "fijo",
    createdByName: "Maria",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
  },
];

const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

export default function HomePage() {
  const now = new Date();
  const month = MONTH_NAMES[now.getMonth()];
  const year = now.getFullYear();

  return (
    <div className="flex flex-col gap-4 px-4 py-4 max-w-lg mx-auto">
      {/* Balance */}
      <BalanceCard
        availableArs={MOCK_BALANCE.availableArs}
        availableUsd={MOCK_BALANCE.availableUsd}
        month={month}
        year={year}
      />

      {/* Quick log form */}
      <ExpenseFormContainer currentRate={MOCK_RATE} />

      {/* Recent expenses */}
      <section>
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-3 px-1"
          style={{ color: "var(--text-secondary)" }}
        >
          Últimos gastos
        </h2>
        <RecentExpenses expenses={MOCK_EXPENSES} />
      </section>
    </div>
  );
}
