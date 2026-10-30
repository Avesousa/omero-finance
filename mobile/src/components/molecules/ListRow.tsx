import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useTheme } from "../../design-system";
import { Text } from "../atoms";

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Contenido a la izquierda (avatar, ícono, indicador). */
  left?: ReactNode;
  /** Contenido a la derecha (monto, píldora, botón, interruptor). */
  right?: ReactNode;
  onPress?: () => void;
  /** Marca de selección para lectores de pantalla (filas elegibles). */
  selected?: boolean;
  testID?: string;
}

/** Fila genérica: izquierda opcional, título + subtítulo, derecha opcional. Si hay `onPress` es un botón (≥44px). */
export function ListRow({ title, subtitle, left, right, onPress, selected, testID }: ListRowProps) {
  const { space, sizes } = useTheme();
  const body = (
    <>
      {left}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="secondary" tone="inkMuted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </>
  );
  const style = { minHeight: sizes.touch, flexDirection: "row" as const, alignItems: "center" as const, gap: space[3], paddingVertical: space[2] };
  if (!onPress) return <View testID={testID} style={style}>{body}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [style, { opacity: pressed ? 0.8 : 1 }]}
    >
      {body}
    </Pressable>
  );
}
