import { Circle, Ellipse, Path, Rect } from "react-native-svg";
import { palette } from "../../design-system";
import { Blush, Brow, Eye, Shadow, Sparkles } from "../parts/parts";
import { moodFlags } from "../parts/mood";
import type { DrawingProps } from "../types";

const c = palette.art.pincho;

/** Pincho, el carpincho. Tranqui: naranja en la cabeza. Atrevido: auriculares azules en su lugar. */
export function PinchoDrawing({ mood, mode }: DrawingProps) {
  const f = moodFlags(mood, mode);
  return (
    <>
      <Shadow />
      {f.celebrate ? <Path d="M38 130 L18 106" fill="none" stroke={c.dark} strokeWidth={9} strokeLinecap="round" /> : null}
      <Ellipse cx={90} cy={128} rx={62} ry={48} fill={c.body} />
      <Ellipse cx={96} cy={150} rx={40} ry={22} fill={c.belly} />
      <Path d="M64 168 L64 186 M84 172 L84 186 M112 172 L112 186 M134 166 L134 186" fill="none" stroke={c.dark} strokeWidth={9} strokeLinecap="round" />
      <Rect x={118} y={74} width={54} height={58} rx={22} fill={c.body} />
      <Rect x={158} y={86} width={32} height={44} rx={15} fill={c.dark} />
      <Circle cx={182} cy={102} r={2.6} fill={c.nostril} />
      <Circle cx={134} cy={84} r={8} fill={c.dark} />
      {!f.bold ? (
        <>
          <Circle cx={146} cy={66} r={11} fill={c.orange} />
          <Path d="M146 56 Q156 47 163 53 Q155 62 146 58 Z" fill={c.leaf} />
        </>
      ) : (
        <>
          <Path d="M134 86 Q134 58 152 58 Q170 58 172 80" fill="none" stroke={c.phones} strokeWidth={8} strokeLinecap="round" />
          <Circle cx={134} cy={86} r={11} fill={c.phones} />
        </>
      )}
      <Brow calm="M139 86 Q150 80 161 84" up="M139 82 Q150 73 161 78" raised={f.up} />
      <Eye x={150} y={98} mood={mood} />
      <Blush cx={141} cy={116} mood={mood} />
      <Sparkles visible={f.celebrate} />
    </>
  );
}
