"use client";

import { ExpenseForm } from "./expense-form";
import { useRouter } from "next/navigation";

interface ExpenseFormContainerProps {
  currentRate: number;
}

export function ExpenseFormContainer({ currentRate }: ExpenseFormContainerProps) {
  const router = useRouter();

  async function handleSubmit(data: Parameters<React.ComponentProps<typeof ExpenseForm>["onSubmit"]>[0]) {
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error("Error al guardar el gasto");

    // Refresh server data
    router.refresh();
  }

  return <ExpenseForm currentRate={currentRate} onSubmit={handleSubmit} />;
}
