import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { MascotMessage } from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import { isMonthNotStarted, useAddEntry, usePlan } from "../../data";
import { EntryForm, type EntryFormValues } from "../entry/EntryForm";
import { FixedFormShell, leaveFixedForm } from "./FixedFormShell";

/** Pausa para ver a la mascota festejar antes de volver. */
const CELEBRATE_MS = 1200;

/** Nuevo gasto fijo (modal): `EntryForm` en modo crear, siempre fijo. Param opcional `period`. */
export function NewFixedScreen() {
  const { t } = useTranslation("fixed");
  const { t: tc } = useTranslation("common");
  const params = useLocalSearchParams<{ period?: string }>();
  const plan = usePlan(params.period || undefined);
  const add = useAddEntry();
  const [savedName, setSavedName] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const onSubmit = (v: EntryFormValues) => {
    const period = plan.data?.period;
    if (!period || !v.fixed) return;
    add.mutate(
      { kind: "EXPENSE", period, name: v.name, amount: v.amount, currency: v.currency, categoryId: v.categoryId, date: null, note: null, fixed: v.fixed },
      {
        onSuccess: () => {
          setSavedName(v.name);
          timer.current = setTimeout(leaveFixedForm, CELEBRATE_MS);
        },
      },
    );
  };

  if (savedName != null) {
    return (
      <ScreenTemplate edges={["top", "bottom"]} testID="fixed-form-saved">
        <MascotMessage moment="fixedSaved" params={{ name: savedName }} mood="festeja" />
      </ScreenTemplate>
    );
  }

  return (
    <FixedFormShell title={t("new.title")}>
      <EntryForm
        kind="EXPENSE"
        testIDPrefix="fixed-form"
        fixedMode="always"
        showDate={false}
        showNote={false}
        saveLabel={t("new.save")}
        busy={add.isPending || plan.isPending}
        error={add.isError ? (isMonthNotStarted(add.error) ? tc("errors.monthNotStarted") : t("new.error")) : null}
        onSubmit={onSubmit}
      />
    </FixedFormShell>
  );
}
