import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { CardManagerSheet } from "../accounts/CardManagerSheet";

/**
 * «Resumen de tarjetas»: abre el modal de tarjetas (carrusel «Todas» + cada tarjeta) sobre un fondo liso.
 * Params: `card` = id | "all" (por defecto «all»), `action` = "new" | "statement" | "purchase" | "pay" (abre en «Todas»).
 */
export function CardsScreen() {
  const params = useLocalSearchParams<{ card?: string; action?: string }>();
  const cardId = params.action === "new" ? null : params.card ?? "all";
  const initialForm = params.action === "statement" || params.action === "purchase" ? params.action : undefined;
  const close = () => (router.canGoBack() ? router.back() : router.replace("/cuentas"));
  return (
    <View testID="cards-screen" style={{ flex: 1, backgroundColor: "transparent" }}>
      <CardManagerSheet cardId={cardId} initialForm={initialForm} onClose={close} />
    </View>
  );
}
