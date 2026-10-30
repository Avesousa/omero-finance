import { Circle, Ellipse, Path } from "react-native-svg";
import { palette } from "../../design-system";
import { moodFlags } from "./mood";
import type { Mood } from "../types";

const { art } = palette;

/** Sombra del piso, igual en todas (cx 100, cy 188, rx 54). `warm` = marrón (Omero) o azul noche. */
export function Shadow({ warm = false }: { warm?: boolean }) {
  return <Ellipse cx={100} cy={188} rx={54} ry={7} fill={warm ? art.shadowWarm : art.shadowCool} opacity={0.12} />;
}

/** Ojo centrado en (x, y): cerrado-calmo, sonriente u abierto (con brillo), según el mood. */
export function Eye({ x, y, mood }: { x: number; y: number; mood: Mood }) {
  const { happy, calm, open } = moodFlags(mood, "tranqui");
  if (open) {
    return (
      <>
        <Circle cx={x} cy={y} r={7} fill={art.ink} />
        <Circle cx={x + 2.5} cy={y - 2.5} r={2.4} fill={palette.white} />
      </>
    );
  }
  if (calm) {
    return <Path d={`M${x - 7} ${y - 2} Q${x} ${y + 5} ${x + 7} ${y - 2}`} fill="none" stroke={art.ink} strokeWidth={4} strokeLinecap="round" />;
  }
  if (happy) {
    return <Path d={`M${x - 7} ${y + 3} Q${x} ${y - 7} ${x + 7} ${y + 3}`} fill="none" stroke={art.ink} strokeWidth={4} strokeLinecap="round" />;
  }
  return null;
}

/** Ceja: cada dibujo pasa su trazo en reposo (`calm`) y en alto (`up`); `raised` elige cuál. */
export function Brow({ calm, up, raised }: { calm: string; up: string; raised: boolean }) {
  return <Path d={raised ? up : calm} fill="none" stroke={art.cream} strokeWidth={5} strokeLinecap="round" />;
}

/** Rubor: visible en feliz/festeja (0.6) y calma (0.35); oculto en atento. */
export function Blush({ cx, cy, mood }: { cx: number; cy: number; mood: Mood }) {
  const opacity = moodFlags(mood, "tranqui").blush;
  if (!opacity) return null;
  return <Ellipse cx={cx} cy={cy} rx={7} ry={4} fill={art.blush} opacity={opacity} />;
}

/** Destellos celestes del mood `festeja` (mismas posiciones en las cuatro mascotas). */
export function Sparkles({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <Path
      d="M36 40 L36 56 M28 48 L44 48 M162 28 L162 42 M155 35 L169 35 M178 58 L178 68 M173 63 L183 63"
      fill="none"
      stroke={art.sparkle}
      strokeWidth={4}
      strokeLinecap="round"
    />
  );
}
