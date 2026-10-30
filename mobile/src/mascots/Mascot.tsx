import { useTranslation } from "react-i18next";
import Svg from "react-native-svg";
import { useTheme } from "../design-system";
import { useMascot } from "./MascotProvider";
import { getMascot } from "./registry";
import type { MascotId, Mood } from "./types";

interface MascotProps {
  /** Por defecto, la mascota elegida. */
  id?: MascotId;
  /** Por defecto 'feliz'. */
  mood?: Mood;
  /** Lado en px (el dibujo es cuadrado, viewBox 200x200). */
  size: number;
}

/**
 * Dibuja una mascota. El modo (tranqui/atrevido) sale del tema. Para mostrarla en su círculo
 * de fondo usá `MascotAvatar` (las mascotas nunca van sueltas sobre bg/surface).
 */
export function Mascot({ id, mood = "feliz", size }: MascotProps) {
  const { mode } = useTheme();
  const { mascotId } = useMascot();
  const { t } = useTranslation("mascots");
  const def = getMascot(id ?? mascotId);
  const name = t(`${def.i18nKey}.name`);
  const label = t("common.label", { name, mood: t(`common.mood.${mood}`) });
  return (
    <Svg viewBox="0 0 200 200" width={size} height={size} accessible accessibilityRole="image" accessibilityLabel={label}>
      <def.Drawing mood={mood} mode={mode} />
    </Svg>
  );
}
