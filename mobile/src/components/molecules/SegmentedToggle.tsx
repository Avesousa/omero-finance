import { Pressable, View } from "react-native";
import { useTheme } from "../../design-system";
import { Text } from "../atoms";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedToggleProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `default`: sobre bg/surface (activo = accent). `hero`: dentro del héroe primary (pista heroTrack). */
  appearance?: "default" | "hero";
  /** Etiqueta del grupo para lectores de pantalla. */
  accessibilityLabel?: string;
  testID?: string;
}

/** Interruptor segmentado (ej. Disponible | Libre, Tranqui | Atrevido). Cada opción mide 44px de alto. */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  appearance = "default",
  accessibilityLabel,
  testID,
}: SegmentedToggleProps<T>) {
  const { colors, radius, space, sizes } = useTheme();
  const hero = appearance === "hero";
  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: "row",
        alignSelf: "flex-start",
        gap: 3,
        padding: 3,
        borderRadius: radius.pill,
        backgroundColor: hero ? colors.heroTrack : colors.surface,
        borderWidth: hero ? 0 : sizes.hairline,
        borderColor: colors.border,
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        const fill = hero ? colors.heroToggle : colors.accent;
        return (
          <Pressable
            key={option.value}
            testID={testID ? `${testID}-${option.value}` : undefined}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active, checked: active }}
            onPress={() => onChange(option.value)}
            style={{
              minHeight: sizes.touch,
              paddingHorizontal: space[5],
              borderRadius: radius.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? fill : "transparent",
            }}
          >
            <Text
              variant="secondaryStrong"
              tone={active ? (hero ? "onPrimary" : "onAccent") : hero ? "onPrimary" : "ink"}
              style={active && hero ? { color: colors.onHeroToggle } : undefined}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
