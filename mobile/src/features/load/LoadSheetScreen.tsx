import { View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Divider, HStack, IconButton, Icon, Pill, Spacer, Surface, Text, VStack } from "../../components/atoms";
import { ListRow } from "../../components/molecules";
import { ScreenTemplate } from "../../components/templates";
import { useTheme } from "../../design-system";
import type { IconName } from "../../components/atoms";

type OptionKey = "expense" | "income" | "debt" | "statement";

interface Option {
  key: OptionKey;
  icon: IconName;
  /** Ruta a abrir; sin ruta = todavía no disponible. */
  href?: string;
}

const OPTIONS: readonly Option[] = [
  { key: "expense", icon: "remove-circle-outline" },
  { key: "income", icon: "add-circle-outline" },
  { key: "debt", icon: "swap-vertical-outline", href: "/deudas/nueva" },
  { key: "statement", icon: "card-outline" },
];

/** Hoja Cargar: opciones grandes; por ahora solo "Deuda o préstamo" está habilitada. */
export function LoadSheetScreen() {
  const { t } = useTranslation("common");
  const { colors, radius, space, sizes } = useTheme();
  return (
    <ScreenTemplate edges={["top", "bottom"]} testID="load-sheet">
      <HStack>
        <VStack gap={1}>
          <Text variant="screenTitle" accessibilityRole="header">
            {t("load.title")}
          </Text>
          <Text variant="secondary" tone="inkMuted">
            {t("load.subtitle")}
          </Text>
        </VStack>
        <Spacer />
        <IconButton icon="close" accessibilityLabel={t("actions.close")} onPress={() => router.back()} />
      </HStack>
      <Surface>
        {OPTIONS.map((o, i) => {
          const enabled = !!o.href;
          const row = (
            <ListRow
              testID={`load-${o.key}`}
              title={t(`load.${o.key}.title`)}
              subtitle={t(`load.${o.key}.body`)}
              onPress={enabled ? () => router.replace(o.href as never) : undefined}
              left={
                <View
                  style={{
                    width: sizes.touch,
                    height: sizes.touch,
                    borderRadius: radius.pill,
                    backgroundColor: colors.tabActiveBg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name={o.icon} tone={enabled ? "ink" : "inkMuted"} />
                </View>
              }
              right={enabled ? <Icon name="chevron-forward" tone="inkMuted" size="sm" /> : <Pill label={t("status.comingSoon")} />}
            />
          );
          return (
            <View key={o.key} accessibilityState={{ disabled: !enabled }} style={{ opacity: enabled ? 1 : 0.6, paddingVertical: space[1] }}>
              {i > 0 ? <Divider /> : null}
              {row}
            </View>
          );
        })}
      </Surface>
    </ScreenTemplate>
  );
}
