import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, Icon, Text } from "../../components/atoms";
import { ApiError } from "../../../lib/api";
import type { FinanceDTO, MoveEntriesResult } from "../../../lib/types";
import { useTheme } from "../../design-system";
import { useActiveFinance } from "../../providers/ActiveFinanceProvider";
import { moveEntries } from "./api";
import { financeDisplayName, financeDotColor } from "./financeDisplay";

export interface MoveToFinanceSheetProps {
  visible: boolean;
  /** Movimientos a mover (de la finanza activa). */
  entryIds: string[];
  onClose: () => void;
  /** Se llama al cerrar después de mover al menos uno. */
  onMoved?: (result: MoveEntriesResult) => void;
}

/** Cantidad de movimientos movibles a otra finanza: necesita al menos otra finanza donde se pueda cargar (EDITOR+). */
export function useMoveTargets(): FinanceDTO[] {
  const { finances, active } = useActiveFinance();
  if (!active || active.role === "VIEWER") return [];
  return finances.filter((f) => f.id !== active.id && f.role !== "VIEWER");
}

/** "Mover N movimientos a…": elegir finanza → confirmar → resultado (con el detalle de lo que no se pudo mover). */
export function MoveToFinanceSheet({ visible, entryIds, onClose, onMoved }: MoveToFinanceSheetProps) {
  const { t } = useTranslation("finances");
  const { t: tc } = useTranslation("common");
  const { colors, space, radius, sizes, mode } = useTheme();
  const qc = useQueryClient();
  const targets = useMoveTargets();
  const [target, setTarget] = useState<FinanceDTO | null>(null);
  const [result, setResult] = useState<MoveEntriesResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTarget(null);
      setResult(null);
      setError(null);
    }
  }, [visible]);

  const move = useMutation({
    mutationFn: (to: FinanceDTO) => moveEntries(entryIds, to.id),
    onSuccess: async (res) => {
      setResult(res);
      // Cambian los totales de las dos finanzas: se refresca todo lo cacheado.
      await qc.invalidateQueries();
    },
    onError: (e) => setError(e instanceof ApiError && e.message ? e.message : t("errorGeneric")),
  });

  const close = () => {
    if (result && result.moved.length > 0) onMoved?.(result);
    onClose();
  };
  const name = (f: FinanceDTO) => financeDisplayName(f, t("personal"));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable accessibilityRole="button" accessibilityLabel={tc("actions.close")} onPress={close} style={{ flex: 1, backgroundColor: colors.overlay }} />
      <View
        testID="move-sheet"
        style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.card,
          borderTopRightRadius: radius.card,
          paddingHorizontal: space[5],
          paddingTop: space[5],
          paddingBottom: space[8],
          maxHeight: "75%",
          gap: space[3],
        }}
      >
        {result ? (
          <>
            <Text variant="screenTitle" accessibilityLiveRegion="polite">
              {result.skipped.length > 0
                ? t("move.partial", { moved: result.moved.length, skipped: result.skipped.length })
                : t("move.success", { count: result.moved.length, name: name(result.to) })}
            </Text>
            {result.skipped.length > 0 ? (
              <ScrollView style={{ maxHeight: 160 }}>
                {[...new Set(result.skipped.map((s) => s.reason))].map((reason) => (
                  <Text key={reason} variant="secondary" tone="inkMuted">
                    • {reason}
                  </Text>
                ))}
              </ScrollView>
            ) : null}
            <Button testID="move-done" label={tc("actions.close")} onPress={close} />
          </>
        ) : target ? (
          <>
            <Text variant="screenTitle">{t("move.sheetTitle", { count: entryIds.length })}</Text>
            <Text variant="bodyStrong">{name(target)}</Text>
            <Text variant="secondary" tone="inkMuted">{t("move.confirm", { name: name(target) })}</Text>
            {error ? <Text variant="secondary" tone="dangerInk" accessibilityLiveRegion="polite">{error}</Text> : null}
            <Button testID="move-confirm" label={t("move.submit")} busy={move.isPending} onPress={() => { setError(null); move.mutate(target); }} />
            <Button variant="text" label={tc("actions.cancel")} disabled={move.isPending} onPress={() => setTarget(null)} />
          </>
        ) : (
          <>
            <Text variant="screenTitle">{t("move.sheetTitle", { count: entryIds.length })}</Text>
            {targets.length === 0 ? <Text variant="secondary" tone="inkMuted">{t("move.noTarget")}</Text> : null}
            <ScrollView>
              {targets.map((f) => (
                <Pressable
                  key={f.id}
                  testID={`move-target-${f.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={t("sheet.optionLabel", { name: name(f), role: t(`role.${f.role}`) })}
                  onPress={() => setTarget(f)}
                  style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: sizes.touch, paddingVertical: space[2] }}
                >
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: financeDotColor(f, mode) }} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>{name(f)}</Text>
                    <Text variant="secondary" tone="inkMuted">{t(`role.${f.role}`)}</Text>
                  </View>
                  <Icon name="chevron-forward" tone="inkMuted" />
                </Pressable>
              ))}
            </ScrollView>
            <Button variant="text" label={tc("actions.cancel")} onPress={close} />
          </>
        )}
      </View>
    </Modal>
  );
}
