import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { formatDate, parseLocal } from "./format";

/**
 * Devuelve `formatWhen(iso, todayIso)`: "hoy 09:12", "ayer 19:40" o "28/10 08:05".
 * `todayIso` es la fecha 'YYYY-MM-DD' de referencia (viene de HomeSummary.today).
 */
export function useFormatWhen() {
  const { t } = useTranslation("notifications");
  return useCallback(
    (iso: string, todayIso: string) => {
      const day = parseLocal(iso);
      const today = parseLocal(todayIso);
      const diff = Math.round(
        (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
          new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()) /
          86_400_000,
      );
      const time = formatDate(day, "time");
      if (diff === 0) return t("when.today", { time });
      if (diff === 1) return t("when.yesterday", { time });
      return t("when.other", { date: formatDate(day, "short"), time });
    },
    [t],
  );
}
