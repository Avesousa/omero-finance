import { useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, Text, TextField, VStack } from "../../components/atoms";
import { ScreenHeader } from "../../components/organisms";
import { ScreenTemplate } from "../../components/templates";
import { useTheme } from "../../design-system";
import { api, ApiError } from "../../../lib/api";
import { useSession } from "../../../lib/session";
import { validateNewPassword } from "./passwordRules";

/**
 * Cambiar la clave desde el login, sin sesión: email + clave nueva. Provisorio —el servidor
 * todavía no verifica identidad—; se reemplaza por doble factor. Al terminar entra solo.
 */
export function ForgotPasswordScreen() {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim()) return setError(t("login.missingEmail"));
    const issue = validateNewPassword(next, confirm);
    if (issue) return setError(t(`password.${issue}`));
    setBusy(true);
    setError(null);
    try {
      await api("POST", "/api/auth/reset-password", { email: email.trim(), newPassword: next });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("status.error"));
      setBusy(false);
      return;
    }
    try {
      // Con la clave nueva ya guardada, entramos directo. El guard de rutas nos saca de esta pantalla.
      await signIn(email.trim(), next);
    } catch {
      setBusy(false);
      router.replace("/login");
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenTemplate
        header={<ScreenHeader title={t("password.forgotTitle")} onBack={() => router.back()} backLabel={t("actions.back")} />}
        contentStyle={{ paddingBottom: 48 }}
      >
        <VStack gap={4}>
          <Text variant="body" tone="inkMuted">
            {t("password.forgotIntro")}
          </Text>
          <TextField
            testID="forgot-email"
            accessibilityLabel={t("login.email")}
            placeholder={t("login.emailPlaceholder")}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="email"
          />
          <TextField
            testID="forgot-new"
            accessibilityLabel={t("password.new")}
            placeholder={t("password.new")}
            value={next}
            onChangeText={setNext}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
          />
          <TextField
            testID="forgot-confirm"
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
          <Button testID="forgot-submit" label={t("password.forgotSubmit")} busy={busy} onPress={submit} />
        </VStack>
      </ScreenTemplate>
    </KeyboardAvoidingView>
  );
}
