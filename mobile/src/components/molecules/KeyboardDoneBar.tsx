import { InputAccessoryView, Keyboard, Platform, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { Text } from "../atoms";
import { KEYBOARD_DONE_ID } from "./AmountCapsule";

/** Barra "Listo" sobre el teclado numérico de iOS (no tiene tecla de confirmar). Poné una por pantalla que use `AmountCapsule`; en Android y web no dibuja nada. */
export function KeyboardDoneBar() {
  const { t } = useTranslation();
  const { colors, space, sizes } = useTheme();
  if (Platform.OS !== "ios") return null;
  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE_ID}>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", backgroundColor: colors.surface, borderTopWidth: sizes.hairline, borderTopColor: colors.border, paddingHorizontal: space[4] }}>
        <Pressable
          testID="keyboard-done"
          accessibilityRole="button"
          accessibilityLabel={t("actions.done")}
          onPress={() => Keyboard.dismiss()}
          style={{ minHeight: sizes.touch, minWidth: sizes.touch, justifyContent: "center", alignItems: "center" }}
        >
          <Text variant="bodyStrong" tone="primary">
            {t("actions.done")}
          </Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}
