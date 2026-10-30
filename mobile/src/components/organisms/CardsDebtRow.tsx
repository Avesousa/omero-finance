import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../design-system";
import { formatDate } from "../../i18n/format";
import { Amount, HStack, Icon, Surface } from "../atoms";
import { ListRow } from "../molecules";

export interface CardsDebtRowProps {
  /** Tarjetas con algo por pagar. */
  count: number;
  /** Deuda de tarjetas del mes. */
  amount: number;
  /** Vencimiento más cercano, 'YYYY-MM-DD'. */
  nextDue: string | null;
  onPress?: () => void;
  testID?: string;
}

/** Fila "N tarjetas · vence el 07/11" con el monto; al tocarla se va a Tarjetas. */
export function CardsDebtRow({ count, amount, nextDue, onPress, testID }: CardsDebtRowProps) {
  const { t } = useTranslation("debts");
  const { colors, radius, sizes } = useTheme();
  const subtitle = nextDue ? t("cards.due", { date: formatDate(nextDue, "short") }) : undefined;
  return (
    <Surface testID={testID}>
      <ListRow
        title={t("cards.count", { count })}
        subtitle={subtitle}
        onPress={onPress}
        left={
          <View
            style={{
              width: sizes.touch,
              height: sizes.touch,
              borderRadius: radius.pill,
              backgroundColor: colors.tabActiveBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="card-outline" />
          </View>
        }
        right={
          <HStack gap={2}>
            <Amount variant="numberSmall" value={amount} />
            {onPress ? <Icon name="chevron-forward" tone="inkMuted" size="sm" /> : null}
          </HStack>
        }
      />
    </Surface>
  );
}
