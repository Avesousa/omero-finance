import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { HStack, IconButton, Spacer, Surface, Text } from "../../components/atoms";
import { EmptyState } from "../../components/molecules";
import { ScreenTemplate } from "../../components/templates";

export type ComingSoonKind = "cards" | "debts" | "wealth" | "add";

interface ComingSoonScreenProps {
  kind: ComingSoonKind;
  /** Modal (Cargar): sin barra de pestañas, con botón de cerrar. */
  modal?: boolean;
}

/** Pantalla "Próximamente" de Tarjetas, Patrimonio y Cargar. */
export function ComingSoonScreen({ kind, modal }: ComingSoonScreenProps) {
  const { t } = useTranslation("common");
  return (
    <ScreenTemplate edges={modal ? ["top", "bottom"] : ["top"]}>
      <HStack>
        <Text variant="screenTitle" accessibilityRole="header">
          {t(`comingSoon.${kind}.title`)}
        </Text>
        <Spacer />
        {modal ? <IconButton icon="close" accessibilityLabel={t("actions.close")} onPress={() => router.back()} /> : null}
      </HStack>
      <Surface>
        <EmptyState title={t("comingSoon.heading")} description={t(`comingSoon.${kind}.body`)} />
      </Surface>
    </ScreenTemplate>
  );
}
