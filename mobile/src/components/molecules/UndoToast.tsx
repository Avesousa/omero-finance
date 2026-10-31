import { Pressable, View } from "react-native";
import { useTheme } from "../../design-system";
import { Text } from "../atoms";

export interface UndoToastProps {
  message: string;
  actionLabel: string;
  onAction: () => void;
  /** Distancia al borde de abajo (para quedar sobre la barra de navegación). */
  bottomOffset?: number;
  testID?: string;
}

/** Aviso breve flotante con una acción ("Deshacer"). Colores invertidos al tema para que se destaque; el padre decide cuándo se va. */
export function UndoToast({ message, actionLabel, onAction, bottomOffset = 0, testID = "undo-toast" }: UndoToastProps) {
  const { colors, radius, space, sizes } = useTheme();
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: space[5], right: space[5], bottom: bottomOffset }}>
      <View
        testID={testID}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingLeft: space[4], paddingRight: space[2], borderRadius: radius.button, backgroundColor: colors.ink }}
      >
        <Text variant="secondaryStrong" style={{ flex: 1, color: colors.bg, paddingVertical: space[3] }}>
          {message}
        </Text>
        <Pressable
          testID={`${testID}-action`}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={({ pressed }) => ({ minHeight: sizes.touch, minWidth: sizes.touch, paddingHorizontal: space[3], justifyContent: "center", alignItems: "center", opacity: pressed ? 0.7 : 1 })}
        >
          <Text variant="secondaryStrong" style={{ color: colors.bg, textDecorationLine: "underline" }}>
            {actionLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
