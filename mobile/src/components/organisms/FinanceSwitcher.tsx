import { useState, type ReactNode } from "react";
import { Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { financeDisplayName } from "../../features/finances/financeDisplay";
import { useActiveFinance } from "../../providers/ActiveFinanceProvider";
import { FinanceSheet } from "./FinanceSheet";

export interface FinanceSwitcherProps {
  /** Contenido del trigger (mascota + textos). Recibe el nombre de la finanza activa. */
  children: (financeName: string | null) => ReactNode;
}

/**
 * Trigger para cambiar de finanza: toda la zona de Omero (mascota + nombre) abre el sheet.
 * Con una sola finanza igual abre el sheet, para poder descubrir "Crear un Hogar".
 */
export function FinanceSwitcher({ children }: FinanceSwitcherProps) {
  const { t } = useTranslation("finances");
  const { sizes } = useTheme();
  const { active } = useActiveFinance();
  const [open, setOpen] = useState(false);
  const name = active ? financeDisplayName(active, t("personal")) : null;

  return (
    <>
      <Pressable
        testID="finance-switcher"
        accessibilityRole="button"
        accessibilityLabel={t("sheet.openLabel", { name: name ?? t("personal") })}
        onPress={() => setOpen(true)}
        style={{ flexShrink: 1, minHeight: sizes.touch, justifyContent: "center" }}
      >
        {children(name)}
      </Pressable>
      <FinanceSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
