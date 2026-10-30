import { Circle, Ellipse, Path } from "react-native-svg";
import { palette } from "../../design-system";
import { Blush, Brow, Eye, Shadow, Sparkles } from "../parts/parts";
import { moodFlags } from "../parts/mood";
import type { DrawingProps } from "../types";

const c = palette.art.omero;

/** Omero, el hornero. En Atrevido lleva gorra azul con la visera hacia atrás. `mud` muestra el barro (default sí). */
export function OmeroDrawing({ mood, mode, mud = true }: DrawingProps & { mud?: boolean }) {
  const f = moodFlags(mood, mode);
  const showMud = mud && mood !== "atento";
  return (
    <>
      <Shadow warm />
      <Path d="M54 120 Q24 120 16 148 Q40 142 60 138 Z" fill={c.tail} />
      <Ellipse cx={96} cy={120} rx={58} ry={56} fill={c.body} />
      <Circle cx={118} cy={76} r={36} fill={c.body} />
      <Ellipse cx={112} cy={134} rx={36} ry={38} fill={c.belly} />
      <Ellipse cx={130} cy={98} rx={18} ry={14} fill={c.cheek} />
      {f.celebrate ? (
        <Path d="M72 104 Q38 70 54 48 Q74 74 98 100 Z" fill={c.wing} />
      ) : (
        <Path d="M64 106 Q60 152 104 154 Q86 134 92 106 Q80 98 64 106 Z" fill={c.wing} />
      )}
      {f.bold ? (
        <>
          <Path d="M92 50 Q62 46 56 54 Q60 61 92 57 Z" fill={c.capVisor} />
          <Path d="M90 50 A26 26 0 0 1 142 50 Z" fill={c.cap} />
          <Circle cx={116} cy={24} r={3.5} fill={c.capVisor} />
        </>
      ) : null}
      <Brow calm="M108 64 Q122 56 138 62" up="M107 58 Q121 47 138 55" raised={f.up} />
      <Eye x={126} y={76} mood={mood} />
      <Blush cx={138} cy={92} mood={mood} />
      <Path d="M145 82 Q166 84 186 91 Q166 96 145 96 Z" fill={c.beak} />
      <Path d="M90 170 L86 186 M80 187 L92 186 M110 170 L112 186 M106 187 L119 186" fill="none" stroke={c.legs} strokeWidth={4} strokeLinecap="round" />
      {showMud ? (
        <>
          <Circle cx={152} cy={176} r={13} fill={c.mud} />
          <Circle cx={147.5} cy={171.5} r={4} fill={c.mudLight} />
        </>
      ) : null}
      <Sparkles visible={f.celebrate} />
    </>
  );
}

