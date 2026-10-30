import { useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, Text, TextField, VStack } from "../src/components/atoms";
import { ScreenTemplate } from "../src/components/templates";
import { useTheme } from "../src/design-system";
import { useSession } from "../lib/session";
import { ApiError } from "../lib/api";

/** Login (solo modo api). */
export default function Login() {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || !password) return setError(t("login.missingFields"));
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("status.error"));
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenTemplate contentStyle={{ flexGrow: 1, justifyContent: "center" }}>
        <VStack gap={1}>
          <Text variant="screenTitle" tone="primary">
            {t("app.name")}
          </Text>
          <Text variant="body" tone="inkMuted">
            {t("app.tagline")}
          </Text>
        </VStack>
        <VStack gap={4}>
          <TextField
            testID="login-email"
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
            testID="login-password"
            accessibilityLabel={t("login.password")}
            placeholder={t("login.passwordPlaceholder")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            autoComplete="current-password"
            onSubmitEditing={submit}
          />
          {error ? (
            <Text variant="secondaryStrong" tone="dangerInk" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Button testID="login-submit" label={t("actions.login")} busy={busy} onPress={submit} />
        </VStack>
      </ScreenTemplate>
    </KeyboardAvoidingView>
  );
}
