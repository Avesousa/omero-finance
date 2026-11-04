import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { HStack, IconButton, Spacer, Text } from "../../components/atoms";
import { ScreenTemplate } from "../../components/templates";

/** Vuelve a la pantalla anterior; si se abrió directo (sin historial), va a Inicio. */
export function leaveFinanceForm() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

/** Marco de los formularios modales de finanzas: título, cerrar y teclado. */
export function FinanceFormShell({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation("common");
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenTemplate edges={["top", "bottom"]} testID="finance-form">
        <HStack>
          <Text variant="screenTitle" accessibilityRole="header" style={{ flexShrink: 1 }}>
            {title}
          </Text>
          <Spacer />
          <IconButton testID="finance-form-close" icon="close" accessibilityLabel={t("actions.close")} onPress={leaveFinanceForm} />
        </HStack>
        {children}
      </ScreenTemplate>
    </KeyboardAvoidingView>
  );
}
