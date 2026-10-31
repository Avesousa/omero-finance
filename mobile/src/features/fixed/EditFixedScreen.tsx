import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, Skeleton, Surface, Text, VStack } from "../../components/atoms";
import { EmptyState } from "../../components/molecules";
import { MascotMessage } from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import { useDeleteEntry, useFixedExpenses, usePlan, useUpdateEntry, type FixedItem } from "../../data";
import { monthlyAmount } from "../../domain";
import { EntryForm, type EntryFormValues } from "../entry/EntryForm";
import { FixedFormShell, leaveFixedForm } from "./FixedFormShell";

/** Pausa para ver a la mascota antes de volver. */
const CELEBRATE_MS = 1200;

/** Editar un gasto fijo (modal): `EntryForm` precargado, aplicar a próximos meses y quitarlo (solo este mes o dejar de repetirlo). Params `entryId` y `period`. */
export function EditFixedScreen() {
  const { t } = useTranslation("fixed");
  const params = useLocalSearchParams<{ entryId?: string; period?: string }>();
  const period = params.period || undefined;
  const plan = usePlan(period);
  const fixed = useFixedExpenses(period);
  const update = useUpdateEntry();
  const remove = useDeleteEntry();
  const [done, setDone] = useState<{ moment: "fixedSaved" | "fixedStopped"; name: string } | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  // Se recuerda el último ítem visto: al quitarlo, el plan se refresca antes de mostrar a la mascota y no tiene que aparecer "no encontrado".
  const seen = useRef<FixedItem | undefined>(undefined);
  const found = fixed.data?.groups.flatMap((g) => g.items).find((i) => i.entryId != null && i.entryId === params.entryId);
  if (found) seen.current = found;
  const item = found ?? seen.current;

  const finish = (moment: "fixedSaved" | "fixedStopped", name: string) => {
    setDone({ moment, name });
    timer.current = setTimeout(leaveFixedForm, CELEBRATE_MS);
  };

  if (done) {
    return (
      <ScreenTemplate edges={["top", "bottom"]} testID="fixed-form-saved">
        <MascotMessage moment={done.moment} params={{ name: done.name }} mood="festeja" />
      </ScreenTemplate>
    );
  }

  if (fixed.isPending || plan.isPending) {
    return (
      <FixedFormShell title={t("edit.title")}>
        <VStack gap={4} accessibilityLabel={t("state.loading")} accessibilityLiveRegion="polite">
          <Skeleton height={72} />
          <Skeleton height={72} />
          <Skeleton height={120} />
        </VStack>
      </FixedFormShell>
    );
  }

  if (!item || !item.entryId || !plan.data) {
    return (
      <FixedFormShell title={t("edit.title")}>
        <EmptyState
          title={fixed.isError || plan.isError ? t("state.errorTitle") : t("edit.notFoundTitle")}
          description={fixed.isError || plan.isError ? t("state.errorBody") : t("edit.notFoundBody")}
          action={{ label: t("close"), onPress: leaveFixedForm }}
        />
      </FixedFormShell>
    );
  }

  const entryId = item.entryId;
  const planPeriod = plan.data.period;
  const busy = update.isPending || remove.isPending;

  const onSubmit = (v: EntryFormValues) => {
    if (!v.fixed) return;
    update.mutate(
      {
        id: entryId,
        patch: {
          name: v.name,
          // `amount` del patch es el total del mes: monto por vez × veces en el mes.
          amount: monthlyAmount(v.amount, v.fixed.frequency, planPeriod, v.fixed.weekday),
          currency: v.currency,
          categoryId: v.categoryId,
          applyToRule: v.applyToRule,
          ...(v.applyToRule ? { frequency: v.fixed.frequency, weekday: v.fixed.weekday, dueDay: v.fixed.dueDay } : {}),
        },
      },
      { onSuccess: () => finish("fixedSaved", v.name) },
    );
  };

  return (
    <FixedFormShell title={t("edit.title")}>
      <EntryForm
        kind="EXPENSE"
        testIDPrefix="fixed-form"
        mode="edit"
        fixedMode="always"
        showDate={false}
        showNote={false}
        initial={{
          name: item.name,
          amount: item.unitAmount,
          currency: item.currency,
          categoryId: item.categoryId,
          fixed: { frequency: item.frequency, weekday: item.weekday, dueDay: item.dueDay },
        }}
        saveLabel={t("edit.save")}
        busy={update.isPending}
        error={update.isError ? t("edit.error") : null}
        onSubmit={onSubmit}
      />

      <VStack gap={2}>
        {remove.isError ? (
          <Text variant="secondary" tone="dangerInk" accessibilityLiveRegion="polite">
            {t("edit.removeError")}
          </Text>
        ) : null}
        {confirmStop ? (
          <Surface testID="fixed-form-stop-box">
            <VStack gap={3}>
              <Text variant="bodyStrong" accessibilityRole="header">
                {t("edit.stopTitle", { name: item.name })}
              </Text>
              <Text variant="secondary" tone="inkMuted">
                {t("edit.stopBody")}
              </Text>
              <Button
                testID="fixed-form-stop-confirm"
                label={t("edit.stopConfirm")}
                busy={remove.isPending}
                onPress={() => remove.mutate({ id: entryId, scope: "rule" }, { onSuccess: () => finish("fixedStopped", item.name) })}
              />
              <Button variant="secondary" label={t("edit.cancel")} disabled={remove.isPending} onPress={() => setConfirmStop(false)} />
            </VStack>
          </Surface>
        ) : (
          <>
            <Button
              testID="fixed-form-remove-month"
              variant="secondary"
              label={t("edit.removeMonth")}
              disabled={busy}
              onPress={() => remove.mutate({ id: entryId, scope: "month" }, { onSuccess: leaveFixedForm })}
            />
            <Button testID="fixed-form-stop" variant="text" label={t("edit.stop")} disabled={busy} onPress={() => setConfirmStop(true)} />
          </>
        )}
      </VStack>
    </FixedFormShell>
  );
}
