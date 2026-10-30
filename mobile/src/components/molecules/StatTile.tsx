import { View } from "react-native";
import { Surface, Text, type TextTone } from "../atoms";

export interface StatTileProps {
  /** Rótulo en mayúsculas ("INGRESOS"). */
  label: string;
  /** Cifra ya formateada. */
  value: string;
  valueTone?: TextTone;
  testID?: string;
}

/** Tarjeta chica con un rótulo y una cifra (estilo `number`). */
export function StatTile({ label, value, valueTone = "ink", testID }: StatTileProps) {
  return (
    <Surface testID={testID} style={{ flex: 1 }}>
      <View style={{ gap: 4 }}>
        <Text variant="label" tone="inkMuted">
          {label}
        </Text>
        <Text variant="number" tone={valueTone}>
          {value}
        </Text>
      </View>
    </Surface>
  );
}
