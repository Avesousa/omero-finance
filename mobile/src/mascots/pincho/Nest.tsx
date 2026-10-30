import { Ellipse, G, Path } from "react-native-svg";
import { palette } from "../../design-system";
import { NEST_MOOD, NestMascot, NestSvg } from "../parts/nest";
import type { NestProps } from "../types";
import { PinchoDrawing } from "./Drawing";

const { nest } = palette.art;

const PIT = { cx: 200, cy: 166, rx: 108, ry: 26 };

/** Junco con su flor marrón. */
function Reed({ x, y, h = 34 }: { x: number; y: number; h?: number }) {
  return (
    <G>
      <Path d={`M${x} ${y} L${x - 2} ${y - h}`} stroke={nest.reed} strokeWidth={4} strokeLinecap="round" />
      <Path d={`M${x + 6} ${y} L${x + 9} ${y - h * 0.7}`} stroke={nest.reed} strokeWidth={4} strokeLinecap="round" />
      <Ellipse cx={x - 2} cy={y - h - 4} rx={4} ry={8} fill={nest.reedHead} />
    </G>
  );
}

/** Pozo de tierra: borde claro, hueco oscuro. */
function Pit({ scale = 1 }: { scale?: number }) {
  return (
    <G>
      <Ellipse cx={PIT.cx} cy={PIT.cy} rx={PIT.rx * scale} ry={PIT.ry * scale} fill={nest.pit} />
      <Ellipse cx={PIT.cx} cy={PIT.cy + 3} rx={(PIT.rx - 10) * scale} ry={(PIT.ry - 5) * scale} fill={nest.pitDark} />
    </G>
  );
}

/** Capítulo 1: pozo seco con grietas. */
function DryPit() {
  return (
    <G>
      <Pit />
      <Path d="M150 166 L168 160 L178 170 L196 162 M214 170 L230 160 L246 168 M262 164 L276 170" fill="none" stroke={nest.crack} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
      <Path d="M190 150 L196 160 M236 182 L230 172" fill="none" stroke={nest.crack} strokeWidth={3} strokeLinecap="round" />
    </G>
  );
}

/** Capítulo 2: el agua sube dentro del pozo con el avance. */
function Rising({ progress }: { progress: number }) {
  const s = 0.35 + 0.6 * progress; // 0.35..0.95
  const rx = (PIT.rx - 10) * s;
  const ry = (PIT.ry - 5) * s;
  return (
    <G>
      <Pit />
      <Ellipse cx={PIT.cx} cy={PIT.cy + 3} rx={rx} ry={ry} fill={nest.water} />
      <Ellipse cx={PIT.cx} cy={PIT.cy + 3 + ry * 0.25} rx={rx * 0.8} ry={ry * 0.55} fill={nest.waterDeep} />
      <Path d={`M${PIT.cx - rx * 0.5} ${PIT.cy - ry * 0.1} Q${PIT.cx - rx * 0.3} ${PIT.cy - ry * 0.4} ${PIT.cx - rx * 0.1} ${PIT.cy - ry * 0.1}`} fill="none" stroke={nest.waterShine} strokeWidth={3} strokeLinecap="round" />
      <Reed x={PIT.cx - PIT.rx + 4} y={PIT.cy - 2} h={30} />
      <Reed x={PIT.cx + PIT.rx - 14} y={PIT.cy - 4} h={36} />
      {progress > 0.45 ? <Reed x={PIT.cx + PIT.rx + 2} y={PIT.cy + 8} h={26} /> : null}
    </G>
  );
}

/** Capítulo 3: laguna llena con islita y juncos; Pincho flota (el agua tapa su panza). */
function Delta() {
  const lake = { cx: 178, cy: 166, rx: 110, ry: 30 };
  return (
    <G>
      <Ellipse cx={lake.cx} cy={lake.cy} rx={lake.rx + 8} ry={lake.ry + 6} fill={nest.pit} />
      <Ellipse cx={lake.cx} cy={lake.cy} rx={lake.rx} ry={lake.ry} fill={nest.water} />
      <Ellipse cx={lake.cx + 10} cy={lake.cy + 8} rx={lake.rx - 28} ry={lake.ry - 12} fill={nest.waterDeep} opacity={0.55} />
      <Path d="M84 176 Q94 171 104 176 M214 184 Q228 179 242 184 M150 190 Q160 185 170 190" fill="none" stroke={nest.waterShine} strokeWidth={3} strokeLinecap="round" />
      <Ellipse cx={252} cy={156} rx={26} ry={10} fill={nest.reed} />
      <Ellipse cx={252} cy={159} rx={22} ry={6} fill={nest.pitDark} opacity={0.5} />
      <Reed x={242} y={156} h={34} />
      <Reed x={262} y={157} h={26} />
      <Reed x={78} y={160} h={30} />
    </G>
  );
}

/**
 * La laguna de Pincho. 1: pozo seco y agrietado. 2: llega el agua (sube con el avance) y crecen juncos.
 * 3: laguna llena con islita; Pincho flota con una naranja en la cabeza.
 */
export function PinchoNest({ chapter, progress, mode, size }: NestProps) {
  const p = Math.min(1, Math.max(0, progress));
  return (
    <NestSvg id="pincho" mode={mode} size={size}>
      {chapter === 1 ? <DryPit /> : null}
      {chapter === 2 ? <Rising progress={p} /> : null}
      {chapter === 3 ? <Delta /> : null}
      <NestMascot Drawing={PinchoDrawing} mood={NEST_MOOD[chapter]} mode={mode} x={chapter === 3 ? 90 : 10} />
      {chapter === 3 ? (
        <G>
          <Ellipse cx={128} cy={173} rx={58} ry={11} fill={nest.water} opacity={0.92} />
          <Path d="M96 172 Q108 167 120 172 M150 176 Q162 171 174 176" fill="none" stroke={nest.waterShine} strokeWidth={3} strokeLinecap="round" />
        </G>
      ) : null}
    </NestSvg>
  );
}
