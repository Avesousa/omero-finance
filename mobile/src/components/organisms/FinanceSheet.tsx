import { Modal, Pressable, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useTheme } from "../../design-system";
import { financeDisplayName, financeDotColor } from "../../features/finances/financeDisplay";
import { useActiveFinance } from "../../providers/ActiveFinanceProvider";
import { Icon, Text } from "../atoms";

export interface FinanceSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** "¿En qué finanza estás?": lista de finanzas con punto de color, nombre y rol; pie "Crear un Hogar". */
export function FinanceSheet({ visible, onClose }: FinanceSheetProps) {
  const { t } = useTranslation("finances");
  const { colors, space, radius, sizes, mode } = useTheme();
  const router = useRouter();
  const { finances, active, setActive } = useActiveFinance();

  const choose = async (id: string) => {
    onClose();
    await setActive(id);
  };
  const go = (path: string) => {
    onClose();
    router.push(path as never);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("sheet.title")} onPress={onClose} style={{ flex: 1, backgroundColor: colors.overlay }} />
      <View
        style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.card,
          borderTopRightRadius: radius.card,
          paddingHorizontal: space[5],
          paddingTop: space[5],
          paddingBottom: space[8],
          maxHeight: "70%",
        }}
      >
        <Text variant="screenTitle" style={{ marginBottom: space[3] }}>{t("sheet.title")}</Text>
        <ScrollView>
          {finances.map((f) => {
            const selected = f.id === active?.id;
            const name = financeDisplayName(f, t("personal"));
            const role = t(`role.${f.role}`);
            return (
              <View key={f.id} style={{ flexDirection: "row", alignItems: "center" }}>
                <Pressable
                  testID={`finance-${f.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={t("sheet.optionLabel", { name, role })}
                  onPress={() => choose(f.id)}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space[3], minHeight: sizes.touch, paddingVertical: space[2] }}
                >
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: financeDotColor(f, mode) }} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>{name}</Text>
                    <Text variant="secondary" tone="inkMuted">{role}</Text>
                  </View>
                  {selected ? <Icon name="checkmark" tone="primary" /> : null}
                </Pressable>
                {f.kind === "SHARED" ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("sheet.manage")}
                    onPress={() => go(`/finanzas/${f.id}`)}
                    hitSlop={8}
                    style={{ minHeight: sizes.touch, minWidth: sizes.touch, alignItems: "center", justifyContent: "center" }}
                  >
                    <Icon name="chevron-forward" tone="inkMuted" />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
        <Pressable
          testID="finance-create"
          accessibilityRole="button"
          onPress={() => go("/finanzas/nueva")}
          style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: sizes.touch, marginTop: space[2] }}
        >
          <Icon name="add-circle-outline" tone="primary" />
          <Text variant="bodyStrong" tone="primary">{t("sheet.createHome")}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
