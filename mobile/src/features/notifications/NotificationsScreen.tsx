import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { HStack, IconButton, Text } from "../../components/atoms";
import { ScreenTemplate } from "../../components/templates";

/** PLACEHOLDER de Notificaciones: título y volver. El contenido (Por confirmar + Avisos) se agrega después. */
export function NotificationsScreen() {
  const { t } = useTranslation("notifications");
  const { t: tc } = useTranslation("common");
  return (
    <ScreenTemplate edges={["top", "bottom"]}>
      <HStack gap={3}>
        <IconButton icon="chevron-back" accessibilityLabel={tc("actions.back")} onPress={() => router.back()} />
        <Text variant="screenTitle" accessibilityRole="header">
          {t("title")}
        </Text>
      </HStack>
    </ScreenTemplate>
  );
}
