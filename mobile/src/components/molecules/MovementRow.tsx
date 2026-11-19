import { View } from "react-native";
import { useTheme } from "../../design-system";
import { Icon, Text, type IconName } from "../atoms";

export interface MovementRowProps {
  icon: IconName;
  title: string;
  subtitle: string;
  /** Monto ya formateado. */
  amount: string;
}

/** Renglón de movimiento: ícono en círculo, título y detalle a la izquierda, monto a la derecha. */
export function MovementRow({ icon, title, subtitle, amount }: MovementRowProps) {
  const { colors, space } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[2] }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <Icon name={icon} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>{title}</Text>
        <Text variant="secondary" tone="inkMuted" numberOfLines={1}>{subtitle}</Text>
      </View>
      <Text variant="bodyStrong">{amount}</Text>
    </View>
  );
}
