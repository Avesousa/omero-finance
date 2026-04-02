"use client";

import { ExpenseForm } from "./expense-form";
import { useRouter } from "next/navigation";

interface ExpenseFormContainerProps {
  currentRate: number;
}

export function ExpenseFormContainer({ currentRate }: ExpenseFormContainerProps) {
  const router = useRouter();

  async function handleSubmit(
    data: Parameters<React.ComponentProps<typeof ExpenseForm>["onSubmit"]>[0]
  ) {
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error ?? "Error al guardar el gasto");
    }

    router.refresh();
  }

  return <ExpenseForm currentRate={currentRate} onSubmit={handleSubmit} />;
}
