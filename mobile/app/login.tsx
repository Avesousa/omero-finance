import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErrorText, Field, PrimaryButton, TextField, useAction } from "../components/ui";
import { useSession } from "../lib/session";
import { colors, gutter } from "../lib/theme";

export default function Login() {
  const { signIn } = useSession();
  const insets = useSafeAreaInsets();
  const action = useAction();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function submit() {
    if (!email.trim() || !password) return action.setError("Poné tu email y tu contraseña.");
    return action.run(() => signIn(email.trim(), password));
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: gutter, paddingTop: insets.top + 24, gap: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.accent, fontSize: 32, fontWeight: "800", letterSpacing: -0.8 }}>Omero</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 15 }}>Tu plata, con calma.</Text>
        </View>
        <View style={{ gap: 16 }}>
          <Field label="Email">
            <TextField
              testID="login-email"
              accessibilityLabel="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="email"
              placeholder="vos@ejemplo.com"
            />
          </Field>
          <Field label="Contraseña">
            <TextField
              testID="login-password"
              accessibilityLabel="Contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              autoComplete="current-password"
              onSubmitEditing={submit}
              placeholder="••••••••"
            />
          </Field>
          <ErrorText error={action.error} />
          <PrimaryButton testID="login-submit" onPress={submit} busy={action.busy}>Entrar</PrimaryButton>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
