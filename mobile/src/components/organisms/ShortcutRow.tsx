import { Pressable, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { Icon, Text, type IconName } from "../atoms";

export interface ShortcutItem {
  key: string;
  icon: IconName;
  /** Etiqueta ya traducida. */
  label: string;
  onPress: () => void;
}

export interface ShortcutRowProps {
  items: readonly ShortcutItem[];
  /** Margen lateral de la pantalla: la fila sale a pantalla completa y el primer acceso conserva este margen. */
  bleed?: number;
}

const ITEM_WIDTH = 72;
const CIRCLE = 52;
/** Hasta esta cantidad los accesos se reparten el ancho en partes iguales (sin scroll); con más, scroll horizontal. */
const MAX_FIXED = 5;

/** Accesos rápidos de Inicio: círculos con ícono y etiqueta chica debajo, en una fila con scroll horizontal si no entran. */
export function ShortcutRow({ items, bleed = 0 }: ShortcutRowProps) {
  const { t } = useTranslation("home");
  const { colors, radius, space, sizes } = useTheme();
  if (items.length === 0) return null;

  const circle = (item: ShortcutItem) => (
    <View
      style={{
        width: CIRCLE,
        height: CIRCLE,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        borderWidth: sizes.hairline,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={item.icon} color={colors.tabActive} />
    </View>
  );

  if (items.length <= MAX_FIXED) {
    return (
      <View testID="shortcuts" accessibilityLabel={t("shortcuts.label")} style={{ flexDirection: "row" }}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            testID={`shortcut-${item.key}`}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={item.onPress}
            style={({ pressed }) => ({ flex: 1, alignItems: "center", gap: space[2], opacity: pressed ? 0.75 : 1 })}
          >
            {circle(item)}
            <Text
              variant="secondarySemi"
              align="center"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              style={{ fontSize: 11, lineHeight: 14, alignSelf: "stretch", marginHorizontal: -space[1] }}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <ScrollView
      testID="shortcuts"
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={t("shortcuts.label")}
      style={{ marginHorizontal: -bleed, flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: bleed, gap: space[3] }}
    >
      {items.map((item) => (
        <Pressable
          key={item.key}
          testID={`shortcut-${item.key}`}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          onPress={item.onPress}
          style={({ pressed }) => ({ width: ITEM_WIDTH, alignItems: "center", gap: space[2], opacity: pressed ? 0.75 : 1 })}
        >
          {circle(item)}
          <Text variant="secondarySemi" align="center" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontSize: 11, lineHeight: 14 }}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
