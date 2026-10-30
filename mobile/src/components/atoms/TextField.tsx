import { TextInput, type TextInputProps } from "react-native";
import { useTheme } from "../../design-system";

export interface TextFieldProps extends TextInputProps {
  /** Obligatoria para lectores de pantalla (el campo no tiene etiqueta visible propia). */
  accessibilityLabel: string;
}

/** Campo de texto del DS: 52px, radio input, borde 1px. */
export function TextField({ style, ...rest }: TextFieldProps) {
  const { colors, radius, space, sizes, type } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.inkMuted}
      {...rest}
      style={[
        type.body,
        {
          minHeight: sizes.button,
          paddingHorizontal: space[4],
          borderRadius: radius.input,
          borderWidth: sizes.hairline,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          color: colors.ink,
        },
        style,
      ]}
    />
  );
}
