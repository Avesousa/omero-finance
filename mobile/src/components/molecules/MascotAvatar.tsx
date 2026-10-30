import { View } from "react-native";
import { useTheme } from "../../design-system";
import { Mascot } from "../../mascots/Mascot";
import { useMascot } from "../../mascots/MascotProvider";
import { getMascot } from "../../mascots/registry";
import type { MascotId, Mood } from "../../mascots/types";

export interface MascotAvatarProps {
  /** Diámetro del círculo (44 en el encabezado, 56 junto a una burbuja). */
  size: number;
  /** Por defecto, la mascota elegida. */
  id?: MascotId;
  mood?: Mood;
}

/**
 * La mascota sobre su círculo de fondo con anillo de 2px (siempre así, nunca suelta).
 * Colores y dibujo salen del registro de mascotas; el dibujo ocupa `size - 8`.
 */
export function MascotAvatar({ size, id, mood = "feliz" }: MascotAvatarProps) {
  const { mode, colors, radius, sizes, space } = useTheme();
  const { mascotId } = useMascot();
  const def = getMascot(id ?? mascotId);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.pill,
        backgroundColor: def.backdrop[mode],
        borderWidth: sizes.ring,
        borderColor: colors.backdropRing,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Mascot id={def.id} mood={mood} size={size - space[2]} />
    </View>
  );
}
