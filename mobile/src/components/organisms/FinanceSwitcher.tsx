import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { financeDisplayName } from "../../features/finances/financeDisplay";
import { useActiveFinance } from "../../providers/ActiveFinanceProvider";
import { Text, type TextTone } from "../atoms";
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

/** Segunda línea del encabezado: nombre de la finanza activa con una flecha hacia abajo ("Personal ⌄"). */
export function FinanceNameLine({ name, tone }: { name: string; tone: Extract<TextTone, "inkMuted" | "heroInkMuted"> }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2, flexShrink: 1 }}>
      <Text variant="secondarySemi" tone={tone} numberOfLines={1} style={{ flexShrink: 1 }}>
        {name}
      </Text>
      <Ionicons name="chevron-down" size={14} color={colors[tone]} accessibilityElementsHidden importantForAccessibility="no" />
    </View>
  );
}
