"use client";

import { useState } from "react";
import { BalanceCard } from "./balance-card";
import { ExpenseFormContainer, type FixedTemplate } from "./expense-form-container";
import { type RecentExpense } from "./recent-expenses";
import { type RecentIncome } from "./recent-incomes";
import { type CardItem } from "@/components/tdc/card-management";

interface AccountSnap {
  id: string; name: string; type: string; currency: string;
  balance: number; user: { id: string; name: string; avatarColor: string } | null;
}

interface HomeClientProps {
  userName: string;
  userId: string;
  month: string;
  year: number;
  currentRate: number;
  accounts: AccountSnap[];
  fixedTemplates: FixedTemplate[];
  cards: CardItem[];
  recentIncomes: RecentIncome[];
  // casa
  availableArs: number;
  committed: number;
  actualSpent: number;
  totalIncomeUsd: number;
  recentExpenses: RecentExpense[];
  // personal
  myAvailableArs: number;
  myGastosLibres: number;
  personalOnlyIncomeArs: number;
  myPersonalSpentArs: number;
  myRecentExpenses: RecentExpense[];
}

export type ViewMode = "personal" | "casa";

export function HomeClient({
  userName, userId, month, year, currentRate, accounts, fixedTemplates, cards, recentIncomes,
  availableArs, committed, actualSpent, totalIncomeUsd, recentExpenses,
  myAvailableArs, myGastosLibres, personalOnlyIncomeArs, myPersonalSpentArs, myRecentExpenses,
}: HomeClientProps) {
  const [mode, setMode] = useState<ViewMode>("personal");

  return (
    <>
      <BalanceCard
        mode={mode}
        onToggleMode={() => setMode((m) => (m === "personal" ? "casa" : "personal"))}
        userName={userName}
        month={month}
        year={year}
        accounts={accounts}
        // casa
        availableArs={availableArs}
        committed={committed}
        actualSpent={actualSpent}
        totalIncomeUsd={totalIncomeUsd}
        // personal
        myAvailableArs={myAvailableArs}
        myGastosLibres={myGastosLibres}
        personalOnlyIncomeArs={personalOnlyIncomeArs}
        myPersonalSpentArs={myPersonalSpentArs}
      />

      <ExpenseFormContainer
        mode={mode}
        currentRate={currentRate}
        userId={userId}
        recentExpenses={recentExpenses}
        myRecentExpenses={myRecentExpenses}
        recentIncomes={recentIncomes}
        fixedTemplates={fixedTemplates}
        cards={cards}
      />
    </>
  );
}
