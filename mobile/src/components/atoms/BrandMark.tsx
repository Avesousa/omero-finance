import { View } from "react-native";
import { useTheme } from "../../design-system";
import { Text } from "./Text";

export type BrandMarkBrand = "VISA" | "MC" | "AMEX";

export interface BrandMarkProps {
  brand: BrandMarkBrand;
}

/** Chip de texto con la red de la tarjeta (VISA / MC / AMEX). Sin logos ni marcas gráficas. */
export function BrandMark({ brand }: BrandMarkProps) {
  const { colors, radius, space, sizes } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={brand}
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: space[2],
        paddingVertical: space[1] / 2,
        borderRadius: radius.pill,
        borderWidth: sizes.hairline,
        borderColor: colors.border,
        backgroundColor: colors.bg,
      }}
    >
      <Text variant="label" tone="inkMuted" importantForAccessibility="no">
        {brand}
      </Text>
    </View>
  );
}
