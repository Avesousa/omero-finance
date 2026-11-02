import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, TextField } from "../../components/atoms";
import { FormField } from "../../components/molecules";
import { ApiError } from "../../../lib/api";
import { DEFAULT_SHARED_COLOR, type FinancePaletteKey } from "../../design-system/tokens/financeColors";
import { useActiveFinance } from "../../providers/ActiveFinanceProvider";
import { ColorPicker } from "./ColorPicker";
import { FinanceFormShell, leaveFinanceForm } from "./FinanceFormShell";

/** "Nuevo Hogar": nombre + color. Al crearlo, la app pasa a esa finanza. */
export function NewHomeScreen() {
  const { t } = useTranslation("finances");
  const { createHome } = useActiveFinance();
  const [name, setName] = useState("");
  const [color, setColor] = useState<FinancePaletteKey>(DEFAULT_SHARED_COLOR);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createHome({ name: trimmed, color });
      leaveFinanceForm();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? t("new.errorDuplicate") : e instanceof ApiError && e.message ? e.message : t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FinanceFormShell title={t("new.title")}>
      <FormField label={t("new.nameLabel")} error={error}>
        <TextField
          testID="home-name"
          accessibilityLabel={t("new.nameLabel")}
          placeholder={t("new.namePlaceholder")}
          value={name}
          onChangeText={setName}
          maxLength={60}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      </FormField>
      <FormField label={t("new.colorLabel")}>
        <ColorPicker value={color} onChange={setColor} disabled={busy} />
      </FormField>
      <Button testID="home-submit" label={t("new.submit")} onPress={submit} busy={busy} disabled={!name.trim()} />
    </FinanceFormShell>
  );
}
