import { useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, HStack, IconButton, Skeleton, Spacer, Surface, Text, VStack } from "../../components/atoms";
import { EmptyState } from "../../components/molecules";
import { ScreenTemplate } from "../../components/templates";
import { useDeleteEntry, usePlan, useUpdateEntry, type EntryPatch } from "../../data";
import { monthlyAmount, type MonthPlan } from "../../domain";
import { formatMoney } from "../../i18n/format";
import { EntryForm, type EntryFormValues } from "../entry/EntryForm";

/** Vuelve a la lista; si se abrió directo (sin historial), va a Movimientos. */
function leave() {
  if (router.canGoBack()) router.back();
  else router.replace("/movimientos");
}

/** Cierra el modal y abre Deudas (las cuotas se gestionan allá). */
function goToDebts() {
  if (router.canGoBack()) router.back();
  router.push("/deudas");
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = useTranslation("movements");
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenTemplate edges={["top", "bottom"]} testID="movement-form">
        <HStack>
          <Text variant="screenTitle" accessibilityRole="header" style={{ flexShrink: 1 }}>
            {title}
          </Text>
          <Spacer />
          <IconButton testID="movement-form-close" icon="close" accessibilityLabel={t("close")} onPress={leave} />
        </HStack>
        {children}
      </ScreenTemplate>
    </KeyboardAvoidingView>
  );
}

/**
 * Editar un movimiento (modal; params `entryId` y `period`): `EntryForm` en modo edición (nombre, monto, moneda,
 * categoría, fecha, nota; los fijos suman "Aplicar también a los próximos meses") y Borrar con confirmación en pantalla.
 * Las cuotas de préstamos son de solo lectura, con link a Deudas.
 */
export function EditMovementScreen() {
  const { t } = useTranslation("movements");
  const params = useLocalSearchParams<{ entryId?: string; period?: string }>();
  const plan = usePlan(params.period || undefined);
  const update = useUpdateEntry();
  const remove = useDeleteEntry();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (plan.isPending) {
    return (
      <Shell title={t("edit.title")}>
        <VStack gap={4} accessibilityLabel={t("state.loading")} accessibilityLiveRegion="polite">
          <Skeleton height={72} />
          <Skeleton height={72} />
          <Skeleton height={120} />
        </VStack>
      </Shell>
    );
  }

  const data: MonthPlan | undefined = plan.data;
  const entry = data?.entries.find((e) => e.id === params.entryId);
  if (!data || !entry || entry.id.startsWith("proj-") || entry.id.startsWith("proposal-")) {
    return (
      <Shell title={t("edit.title")}>
        <EmptyState
          title={plan.isError ? t("state.errorTitle") : t("edit.notFoundTitle")}
          description={plan.isError ? t("state.errorBody") : t("edit.notFoundBody")}
          action={{ label: t("close"), onPress: leave }}
        />
      </Shell>
    );
  }

  if (entry.loanId) {
    return (
      <Shell title={t("edit.installmentTitle")}>
        <Surface testID="movement-installment">
          <VStack gap={2}>
            <Text variant="bodyStrong">{entry.name}</Text>
            <Text variant="number">{formatMoney(entry.amount, entry.currency)}</Text>
            <Text variant="secondary" tone="inkMuted">
              {t("edit.installmentBody")}
            </Text>
          </VStack>
        </Surface>
        <Button testID="movement-go-debts" label={t("edit.goToDebts")} onPress={goToDebts} />
      </Shell>
    );
  }

  const rule = entry.recurringId ? data.recurrings.find((r) => r.id === entry.recurringId) : undefined;
  const isFixed = rule != null;
  const busy = update.isPending || remove.isPending;

  const onSubmit = (v: EntryFormValues) => {
    const patch: EntryPatch = { name: v.name, currency: v.currency, categoryId: v.categoryId, note: v.note };
    if (v.fixed) {
      // `amount` del patch es el total del mes: monto por vez × veces en el mes.
      patch.amount = monthlyAmount(v.amount, v.fixed.frequency, entry.period, v.fixed.weekday);
      patch.applyToRule = v.applyToRule;
      if (v.applyToRule) Object.assign(patch, { frequency: v.fixed.frequency, weekday: v.fixed.weekday, dueDay: v.fixed.dueDay });
    } else {
      patch.amount = v.amount;
      // Un movimiento sin fecha que sigue en "Hoy" (el valor por defecto del formulario) queda sin fecha.
      const date = entry.date == null && v.dateMode === "today" ? null : v.date;
      if (date !== entry.date) patch.date = date;
    }
    update.mutate({ id: entry.id, patch }, { onSuccess: leave });
  };

  const del = (scope: "month" | "rule") => remove.mutate({ id: entry.id, scope }, { onSuccess: leave });

  return (
    <Shell title={t("edit.title")}>
      <EntryForm
        kind={entry.kind}
        testIDPrefix="movement-form"
        mode="edit"
        fixedMode="never"
        showDate={!isFixed}
        initial={{
          name: entry.name,
          amount: rule ? rule.amount : entry.amount,
          currency: entry.currency,
          categoryId: entry.categoryId,
          date: entry.date,
          note: entry.note,
          fixed: rule ? { frequency: rule.frequency, weekday: rule.weekday, dueDay: rule.dueDay } : null,
        }}
        saveLabel={t("edit.save")}
        busy={update.isPending}
        error={update.isError ? t("edit.error") : null}
        onSubmit={onSubmit}
      />

      <VStack gap={2}>
        {remove.isError ? (
          <Text variant="secondary" tone="dangerInk" accessibilityLiveRegion="polite">
            {t("edit.deleteError")}
          </Text>
        ) : null}
        {confirmDelete ? (
          <Surface testID="movement-delete-box">
            <VStack gap={3}>
              <Text variant="bodyStrong" accessibilityRole="header">
                {t("edit.deleteTitle", { name: entry.name })}
              </Text>
              <Text variant="secondary" tone="inkMuted">
                {isFixed ? t("edit.deleteRuleBody") : t("edit.deleteBody")}
              </Text>
              {isFixed ? (
                <>
                  <Button testID="movement-delete-month" label={t("edit.deleteMonth")} busy={remove.isPending} onPress={() => del("month")} />
                  <Button testID="movement-delete-rule" variant="secondary" label={t("edit.deleteRule")} disabled={remove.isPending} onPress={() => del("rule")} />
                </>
              ) : (
                <Button testID="movement-delete-confirm" label={t("edit.deleteConfirm")} busy={remove.isPending} onPress={() => del("month")} />
              )}
              <Button variant="text" label={t("edit.cancel")} disabled={remove.isPending} onPress={() => setConfirmDelete(false)} />
            </VStack>
          </Surface>
        ) : (
          <Button testID="movement-delete" variant="secondary" label={t("edit.delete")} disabled={busy} onPress={() => setConfirmDelete(true)} />
        )}
      </VStack>
    </Shell>
  );
}
