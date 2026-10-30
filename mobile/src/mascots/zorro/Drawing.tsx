import { Circle, Ellipse, Path } from "react-native-svg";
import { palette } from "../../design-system";
import { Blush, Brow, Eye, Shadow, Sparkles } from "../parts/parts";
import { moodFlags } from "../parts/mood";
import type { DrawingProps } from "../types";

const c = palette.art.zorro;

/**
 * Zorro, el zorro gris. Cola gris con banda interior óxido y punta blanca.
 * En Atrevido lleva un pañuelo coral al cuello.
 */
export function ZorroDrawing({ mood, mode }: DrawingProps) {
  const f = moodFlags(mood, mode);
  return (
    <>
      <Shadow />
      <Path d="M70 166 Q8 172 16 114 Q20 92 40 86 Q36 112 52 130 Q70 142 78 150 Z" fill={c.fur} />
      <Path d="M66 158 Q26 160 27 122 Q29 106 37 100 Q38 118 50 132 Q62 142 70 150 Z" fill={c.tailBand} />
      <Path d="M16 114 Q20 92 40 86 Q36 100 38 110 Q28 114 16 114 Z" fill={c.tailTip} />
      {f.celebrate ? <Path d="M136 144 L156 116" fill="none" stroke={c.fur} strokeWidth={9} strokeLinecap="round" /> : null}
      <Ellipse cx={100} cy={146} rx={40} ry={38} fill={c.fur} />
      <Ellipse cx={100} cy={152} rx={22} ry={26} fill={c.belly} />
      <Path d="M82 172 L80 186 M74 187 L87 186 M118 172 L120 186 M113 187 L126 186" fill="none" stroke={c.legs} strokeWidth={4} strokeLinecap="round" />
      <Path d="M62 60 L56 20 L92 44 Z" fill={c.fur} />
      <Path d="M138 60 L144 20 L108 44 Z" fill={c.fur} />
      <Path d="M66 52 L63 32 L82 46 Z" fill={c.earInner} />
      <Path d="M134 52 L137 32 L118 46 Z" fill={c.earInner} />
      <Ellipse cx={100} cy={78} rx={46} ry={38} fill={c.fur} />
      <Path d="M74 88 Q100 66 126 88 Q124 112 100 112 Q76 112 74 88 Z" fill={c.face} />
      <Ellipse cx={100} cy={88} rx={5.5} ry={4} fill={c.nose} />
      {f.bold ? <Path d="M70 120 L130 120 L100 144 Z" fill={c.bandana} /> : null}
      <Brow calm="M69 64 Q80 58 91 62" up="M69 59 Q80 50 92 55" raised={f.up} />
      <Brow calm="M109 62 Q120 58 131 64" up="M108 55 Q120 50 131 59" raised={f.up} />
      <Eye x={80} y={76} mood={mood} />
      <Eye x={120} y={76} mood={mood} />
      <Blush cx={64} cy={92} mood={mood} />
      <Blush cx={136} cy={92} mood={mood} />
      {f.celebrate ? <Circle cx={157} cy={112} r={6} fill={c.fur} /> : null}
      <Sparkles visible={f.celebrate} />
    </>
  );
}
