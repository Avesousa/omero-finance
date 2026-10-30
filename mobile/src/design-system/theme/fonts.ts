import { useFonts } from "expo-font";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { Manrope_800ExtraBold } from "@expo-google-fonts/manrope/800ExtraBold";
import { Unbounded_700Bold } from "@expo-google-fonts/unbounded/700Bold";
import { Unbounded_800ExtraBold } from "@expo-google-fonts/unbounded/800ExtraBold";
import { Unbounded_900Black } from "@expo-google-fonts/unbounded/900Black";
import { fontFamily } from "../tokens/typography";

const fontMap = {
  [fontFamily.display700]: Unbounded_700Bold,
  [fontFamily.display800]: Unbounded_800ExtraBold,
  [fontFamily.display900]: Unbounded_900Black,
  [fontFamily.sans500]: Manrope_500Medium,
  [fontFamily.sans600]: Manrope_600SemiBold,
  [fontFamily.sans700]: Manrope_700Bold,
  [fontFamily.sans800]: Manrope_800ExtraBold,
};

/**
 * Carga Unbounded (700/800/900) y Manrope (500–800), solo los pesos del DS.
 * Devuelve true cuando terminó (también si falló: la app cae a la fuente del sistema).
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(fontMap);
  return loaded || error != null;
}
