import { useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, Text, TextField, VStack } from "../../components/atoms";
import { ScreenHeader } from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import { useTheme } from "../../design-system";
import { api, ApiError } from "../../../lib/api";
import { validateNewPassword } from "./passwordRules";

/** Cambiar la clave con sesión iniciada: pide la actual y la nueva dos veces. */
export function ChangePasswordScreen() {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!current) return setError(t("password.missingFields"));
    const issue = validateNewPassword(next, confirm);
    if (issue) return setError(t(`password.${issue}`));
    setBusy(true);
    setError(null);
    try {
      await api("PATCH", "/api/auth/password", { currentPassword: current, newPassword: next });
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("status.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenTemplate
        header={<ScreenHeader title={t("password.changeTitle")} onBack={() => router.back()} backLabel={t("actions.back")} />}
        contentStyle={{ paddingBottom: 48 }}
      >
        <VStack gap={4}>
          <TextField
            testID="password-current"
            accessibilityLabel={t("password.current")}
            placeholder={t("password.current")}
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            textContentType="password"
            autoComplete="current-password"
          />
          <TextField
            testID="password-new"
            accessibilityLabel={t("password.new")}
            placeholder={t("password.new")}
            value={next}
            onChangeText={setNext}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
          />
          <TextField
            testID="password-confirm"
            accessibilityLabel={t("password.confirm")}
            placeholder={t("password.confirm")}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
            onSubmitEditing={submit}
          />
          <Text variant="secondary" tone="inkMuted">
            {t("password.hint")}
          </Text>
          {error ? (
            <Text variant="secondaryStrong" tone="dangerInk" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          {done ? (
            <Text variant="secondaryStrong" tone="positiveInk" accessibilityRole="alert">
              {t("password.changed")}
            </Text>
          ) : null}
          <Button testID="password-submit" label={t("actions.save")} busy={busy} onPress={submit} />
        </VStack>
      </ScreenTemplate>
    </KeyboardAvoidingView>
  );
}
