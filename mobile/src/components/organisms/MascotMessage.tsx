import { View } from "react-native";
import { useTheme } from "../../design-system";
import { useMascotLine } from "../../mascots/useMascotLine";
import type { MascotMoment, Mood } from "../../mascots/types";
import { MascotAvatar, SpeechBubble } from "../molecules";

export interface MascotMessageProps {
  /** Momento con frase propia (`dailyRemainder`, `pendingConfirm`…). */
  moment: MascotMoment;
  /** Variables de interpolación ya formateadas (`{ amount: formatMoney(40866) }`) o `count` para plurales. */
  params?: Record<string, string | number>;
  mood?: Mood;
}

/** La mascota elegida con su burbuja; el texto depende del momento y del modo (Tranqui/Atrevido). */
export function MascotMessage({ moment, params, mood = "feliz" }: MascotMessageProps) {
  const { space, sizes } = useTheme();
  const text = useMascotLine(moment, params);
  return (
    <View testID="mascot-message" style={{ flexDirection: "row", alignItems: "center", gap: space[2] + 2 }}>
      <MascotAvatar size={sizes.bubbleAvatar} mood={mood} />
      <SpeechBubble text={text} />
    </View>
  );
}
