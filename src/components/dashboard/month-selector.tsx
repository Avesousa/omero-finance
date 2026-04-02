"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTH_NAMES, isMonthInFuture, type MonthName } from "@/lib/dashboard";

interface MonthSelectorProps {
  month: MonthName;
  year: number;
}

export function MonthSelector({ month, year }: MonthSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Disable "next" if already at current month (can't browse the future)
  const isAtCurrentOrFuture = !isMonthInFuture(month, year) &&
    (() => {
      const now = new Date();
      const idx = MONTH_NAMES.indexOf(month);
      return year === now.getFullYear() && idx === now.getMonth();
    })();

  function navigate(newMonth: MonthName, newYear: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", newMonth);
    params.set("year", String(newYear));
    router.push(`/dashboard?${params.toString()}`);
  }

  function prev() {
    const idx = MONTH_NAMES.indexOf(month);
    if (idx === 0) navigate(MONTH_NAMES[11], year - 1);
    else navigate(MONTH_NAMES[idx - 1], year);
  }

  function next() {
    if (isAtCurrentOrFuture) return;
    const idx = MONTH_NAMES.indexOf(month);
    if (idx === 11) navigate(MONTH_NAMES[0], year + 1);
    else navigate(MONTH_NAMES[idx + 1], year);
  }

  return (
    <div className="flex items-center gap-3">
      <NavButton onClick={prev} label="Mes anterior" disabled={false}>
        <ChevronLeft size={16} />
      </NavButton>

      <span
        className="text-sm font-semibold capitalize min-w-[130px] text-center"
        style={{ color: "var(--text-primary)" }}
      >
        {month} {year}
      </span>

      <NavButton onClick={next} label="Mes siguiente" disabled={isAtCurrentOrFuture}>
        <ChevronRight size={16} />
      </NavButton>
    </div>
  );
}

function NavButton({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
      style={{
        color: disabled ? "var(--border)" : "var(--text-secondary)",
        backgroundColor: disabled ? "transparent" : "var(--bg-elevated)",
        cursor: disabled ? "default" : "pointer",
      }}
      aria-label={label}
    >
      {children}
    </button>
  );
}
