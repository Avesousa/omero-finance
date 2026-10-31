import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { HStack, IconButton, Spacer, Text } from "../../components/atoms";
import { ScreenTemplate } from "../../components/templates";

/** Vuelve a la pantalla anterior; si se abrió directo (sin historial), va a Gastos fijos. */
export function leaveFixedForm() {
  if (router.canGoBack()) router.back();
  else router.replace("/gastos-fijos");
}

/** Marco de los formularios modales de gastos fijos: título, cerrar y teclado. */
export function FixedFormShell({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation("fixed");
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenTemplate edges={["top", "bottom"]} testID="fixed-form">
        <HStack>
          <Text variant="screenTitle" accessibilityRole="header" style={{ flexShrink: 1 }}>
            {title}
          </Text>
          <Spacer />
          <IconButton testID="fixed-form-close" icon="close" accessibilityLabel={t("close")} onPress={leaveFixedForm} />
        </HStack>
        {children}
      </ScreenTemplate>
    </KeyboardAvoidingView>
  );
}
