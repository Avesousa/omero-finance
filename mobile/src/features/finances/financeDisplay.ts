import { themes, type ThemeMode } from "../../design-system";
import { financeAccent } from "../../design-system/tokens/financeColors";
import type { FinanceDTO, PlanFinance } from "../../../lib/types";

type FinanceLike = Pick<FinanceDTO | PlanFinance, "kind" | "name" | "color">;

/** "Personal" para la finanza personal (aunque en la base se llame "Personal de Maria"); el nombre para las compartidas. */
export function financeDisplayName(f: FinanceLike, personalLabel: string): string {
  return f.kind === "PERSONAL" ? personalLabel : f.name;
}

/** Color del punto de una finanza: su color de paleta, o el de Omero para la Personal. */
export function financeDotColor(f: FinanceLike, mode: ThemeMode): string {
  const def = themes[mode];
  return financeAccent(f.color, def.statusBar) ?? def.colors.primary;
}
