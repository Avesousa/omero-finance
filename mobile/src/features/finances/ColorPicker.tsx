import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { FINANCE_PALETTE, financeAccent, type FinancePaletteKey } from "../../design-system/tokens/financeColors";
import { Icon } from "../../components/atoms";

export interface ColorPickerProps {
  value: FinancePaletteKey;
  onChange: (key: FinancePaletteKey) => void;
  disabled?: boolean;
}

/** Selector de color de la paleta de finanzas (6 círculos). */
export function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
  const { t } = useTranslation("finances");
  const { space, sizes, statusBar, colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[3] }}>
      {(Object.keys(FINANCE_PALETTE) as FinancePaletteKey[]).map((key) => {
        const selected = key === value;
        return (
          <Pressable
            key={key}
            testID={`color-${key}`}
            accessibilityRole="button"
            accessibilityLabel={t(`colors.${key}`)}
            accessibilityState={{ selected, disabled: !!disabled }}
            disabled={disabled}
            onPress={() => onChange(key)}
            style={{
              width: sizes.touch,
              height: sizes.touch,
              borderRadius: sizes.touch / 2,
              backgroundColor: financeAccent(key, statusBar) ?? colors.primary,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: selected ? 3 : 0,
              borderColor: colors.ink,
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {selected ? <Icon name="checkmark" color={colors.onPrimary} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
