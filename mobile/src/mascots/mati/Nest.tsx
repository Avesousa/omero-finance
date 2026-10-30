import { Circle, Ellipse, G, Path, Rect } from "react-native-svg";
import { palette } from "../../design-system";
import { GROUND_Y, NEST_MOOD, NestMascot, NestSvg } from "../parts/nest";
import type { NestProps } from "../types";
import { MatiDrawing } from "./Drawing";

const { nest, mati: c, cream } = palette.art;

/** Termo: cuerpo plateado, tapa azul y una franja. Base en (x, y). */
function Thermos({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Rect x={x - 12} y={y - 54} width={24} height={54} rx={9} fill={nest.thermos} />
      <Rect x={x - 12} y={y - 22} width={24} height={9} fill={nest.thermosDark} />
      <Rect x={x - 14} y={y - 64} width={28} height={16} rx={7} fill={nest.thermosCap} />
      <Rect x={x - 6} y={y - 52} width={4} height={26} rx={2} fill={palette.white} opacity={0.5} />
    </G>
  );
}

/** Mate chiquito con yerba y bombilla. Base en (x, y). */
function Cup({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Path d={`M${x + 2} ${y - 20} L${x + 12} ${y - 36}`} stroke={c.straw} strokeWidth={4} strokeLinecap="round" />
      <Circle cx={x} cy={y - 12} r={14} fill={c.gourd} />
      <Path d={`M${x - 11} ${y - 4} Q${x} ${y + 6} ${x + 11} ${y - 4} Q${x + 8} ${y + 2} ${x} ${y + 2} Q${x - 8} ${y + 2} ${x - 11} ${y - 4} Z`} fill={c.gourdDark} />
      <Ellipse cx={x} cy={y - 23} rx={10} ry={4} fill={c.yerba} />
      <Rect x={x - 11} y={y - 25} width={22} height={5} rx={2.5} fill={c.rim} opacity={0.9} />
      <Ellipse cx={x} cy={y - 24} rx={8} ry={2.6} fill={c.yerba} />
    </G>
  );
}

/** Factura/bizcochito: media luna dorada. */
function Biscuit({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Ellipse cx={x} cy={y} rx={9} ry={5} fill={nest.biscuit} />
      <Ellipse cx={x - 2} cy={y - 1.5} rx={4.5} ry={1.8} fill={cream} opacity={0.6} />
    </G>
  );
}

/** Mantel a cuadros (dos tonos) sobre el piso. */
function Cloth() {
  const squares: { x: number; y: number }[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 14; col++) {
      if ((row + col) % 2 === 0) squares.push({ x: 18 + col * 20.4, y: 154 + row * 15 });
    }
  }
  return (
    <G>
      <Path d="M14 152 L306 152 L316 196 L4 196 Z" fill={nest.cloth} />
      {squares.map((s) => (
        <Rect key={`${s.x}-${s.y}`} x={s.x} y={s.y} width={20.4} height={15} fill={nest.clothCheck} opacity={0.35} />
      ))}
    </G>
  );
}

// Dónde van los mates de la ronda (en orden de aparición), a cada lado de Mati.
const CUPS = [
  { x: 206, y: 170 },
  { x: 62, y: 172 },
  { x: 244, y: 176 },
  { x: 28, y: 176 },
];

/**
 * La ronda de Mati. 1: Mati solo con el termo. 2: se suman mates alrededor (1 a 4 según el avance).
 * 3: la mateada del mes: mantel, termo, bizcochitos y la ronda completa.
 */
export function MatiNest({ chapter, progress, mode, size }: NestProps) {
  const p = Math.min(1, Math.max(0, progress));
  const cups = chapter === 1 ? 0 : chapter === 2 ? 1 + Math.round(p * 3) : 4;
  return (
    <NestSvg id="mati" mode={mode} size={size}>
      {chapter === 3 ? <Cloth /> : null}
      <Thermos x={chapter === 3 ? 286 : 284} y={chapter === 3 ? 186 : GROUND_Y + 28} />
      {CUPS.slice(0, cups).map((cup, i) => (
        <Cup key={i} x={cup.x} y={chapter === 3 ? cup.y + 8 : cup.y} />
      ))}
      <NestMascot Drawing={MatiDrawing} mood={NEST_MOOD[chapter]} mode={mode} x={chapter === 1 ? 70 : 100} />
      {chapter === 3 ? (
        <G>
          <Ellipse cx={160} cy={190} rx={30} ry={7} fill={cream} />
          <Biscuit x={148} y={188} />
          <Biscuit x={165} y={186} />
          <Biscuit x={176} y={191} />
        </G>
      ) : null}
    </NestSvg>
  );
}
