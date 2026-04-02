"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTH_NAMES, type MonthName } from "@/lib/dashboard";

interface MonthSelectorProps {
  month: MonthName;
  year: number;
}

export function MonthSelector({ month, year }: MonthSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

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
    const idx = MONTH_NAMES.indexOf(month);
    if (idx === 11) navigate(MONTH_NAMES[0], year + 1);
    else navigate(MONTH_NAMES[idx + 1], year);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={prev}
        className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
        style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-elevated)" }}
        aria-label="Mes anterior"
      >
        <ChevronLeft size={16} />
      </button>

      <span
        className="text-sm font-semibold capitalize min-w-[120px] text-center"
        style={{ color: "var(--text-primary)" }}
      >
        {month} {year}
      </span>

      <button
        onClick={next}
        className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
        style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-elevated)" }}
        aria-label="Mes siguiente"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
