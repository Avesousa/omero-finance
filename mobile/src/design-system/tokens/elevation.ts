/**
 * "No hay sombras en el sistema": se separa con borde, color y espacio. La única excepción es
 * el brillo neón del modo Atrevido (héroe y botón central), que vive en `themes.ts` como
 * `effects` y se aplica con `boxShadow`. Este módulo solo expone el helper para usarlo.
 */
import type { ViewStyle } from "react-native";

export function glow(boxShadow: string | undefined): ViewStyle {
  return boxShadow ? ({ boxShadow } as ViewStyle) : {};
}
