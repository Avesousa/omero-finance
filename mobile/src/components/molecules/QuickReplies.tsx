import { View } from "react-native";
import { useTheme } from "../../design-system";
import { Chip } from "../atoms";

export interface QuickReply {
  key: string;
  label: string;
  /** Todavía no disponible: se ve apagada y no responde. */
  disabled?: boolean;
  testID?: string;
}

export interface QuickRepliesProps {
  options: readonly QuickReply[];
  onSelect: (key: string) => void;
  /** Para lectores de pantalla (agrupa las opciones). */
  accessibilityLabel?: string;
  testID?: string;
}

/** Respuestas rápidas: chips que se acomodan en filas debajo del mensaje de la mascota. */
export function QuickReplies({ options, onSelect, accessibilityLabel, testID }: QuickRepliesProps) {
  const { space } = useTheme();
  return (
    <View testID={testID} accessibilityLabel={accessibilityLabel} style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
      {options.map((o) => (
        <Chip key={o.key} testID={o.testID} label={o.label} disabled={o.disabled} onPress={() => onSelect(o.key)} />
      ))}
    </View>
  );
}
