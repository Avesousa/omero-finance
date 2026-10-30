import { Circle, Ellipse, Path, Rect } from "react-native-svg";
import { palette } from "../../design-system";
import { Blush, Brow, Eye, Shadow, Sparkles } from "../parts/parts";
import { moodFlags } from "../parts/mood";
import type { DrawingProps } from "../types";

const c = palette.art.mati;

/** Mati, el mate de calabaza con bombilla. En Atrevido lleva lentes oscuros. */
export function MatiDrawing({ mood, mode }: DrawingProps) {
  const f = moodFlags(mood, mode);
  return (
    <>
      <Shadow />
      {f.celebrate ? <Path d="M72 196 Q100 202 128 196" fill="none" stroke={palette.art.sparkle} strokeWidth={4} strokeLinecap="round" /> : null}
      <Path d="M116 42 L156 10" fill="none" stroke={c.straw} strokeWidth={7} strokeLinecap="round" />
      <Circle cx={100} cy={112} r={62} fill={c.gourd} />
      <Path d="M48 146 Q100 184 152 146 Q146 172 100 172 Q54 172 48 146 Z" fill={c.gourdDark} />
      <Ellipse cx={100} cy={42} rx={38} ry={11} fill={c.yerba} />
      <Rect x={58} y={44} width={84} height={16} rx={8} fill={c.rim} />
      {f.bold ? (
        <>
          <Path d="M116 42 L156 10" fill="none" stroke={c.straw} strokeWidth={7} strokeLinecap="round" />
          <Rect x={70} y={27} width={25} height={14} rx={6} fill={c.lens} />
          <Rect x={105} y={27} width={25} height={14} rx={6} fill={c.lens} />
          <Path d="M95 33 L105 33" fill="none" stroke={c.lens} strokeWidth={3} strokeLinecap="round" />
          <Circle cx={77} cy={31} r={1.8} fill={c.lensGlint} />
          <Circle cx={112} cy={31} r={1.8} fill={c.lensGlint} />
        </>
      ) : null}
      <Brow calm="M69 82 Q80 76 91 80" up="M69 77 Q80 68 92 73" raised={f.up} />
      <Brow calm="M109 80 Q120 76 131 82" up="M108 73 Q120 68 131 77" raised={f.up} />
      <Eye x={80} y={94} mood={mood} />
      <Eye x={120} y={94} mood={mood} />
      <Blush cx={66} cy={110} mood={mood} />
      <Blush cx={134} cy={110} mood={mood} />
      <Path d="M84 172 L82 186 M76 187 L89 186 M116 172 L118 186 M111 187 L124 186" fill="none" stroke={c.legs} strokeWidth={4} strokeLinecap="round" />
      <Sparkles visible={f.celebrate} />
    </>
  );
}
