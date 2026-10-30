import type { ReactNode } from "react";
import { View } from "react-native";
import { useTheme } from "../../design-system";
import { Text } from "../atoms";

export interface FormFieldProps {
  /** Rótulo visible sobre el control. */
  label: string;
  /** Mensaje de error bajo el control (lo anuncia el lector de pantalla). */
  error?: string | null;
  children: ReactNode;
  testID?: string;
}

/** Rótulo + control + error. El control (TextField, toggle…) lleva su propia etiqueta accesible. */
export function FormField({ label, error, children, testID }: FormFieldProps) {
  const { space } = useTheme();
  return (
    <View testID={testID} style={{ gap: space[2] }}>
      <Text variant="secondaryStrong">{label}</Text>
      {children}
      {error ? (
        <Text variant="secondary" tone="dangerInk" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
