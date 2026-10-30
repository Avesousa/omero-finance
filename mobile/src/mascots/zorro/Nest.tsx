import { Circle, Ellipse, G, Path, Rect } from "react-native-svg";
import { palette } from "../../design-system";
import { NEST_MOOD, NestMascot, NestSvg } from "../parts/nest";
import type { NestProps } from "../types";
import { ZorroDrawing } from "./Drawing";

const { nest, sparkle } = palette.art;

const MAP = { x: 172, y: 36, w: 128, h: 108 };

// Los tres pedazos del mapa (cortes dentados) y cómo se separan cuando está roto.
const PIECES = [
  { d: "M172 36 L222 36 L216 64 L226 92 L218 118 L224 144 L172 144 Z", dx: -7, dy: 5, rot: -6 },
  { d: "M222 36 L264 36 L270 62 L260 92 L268 120 L262 144 L224 144 L218 118 L226 92 L216 64 Z", dx: 1, dy: -7, rot: 4 },
  { d: "M264 36 L300 36 L300 144 L262 144 L268 120 L260 92 L270 62 Z", dx: 8, dy: 4, rot: 7 },
] as const;

/** Contenido dibujado del pedazo i (árbol, lago, montañas) para que viaje con él. */
function PieceArt({ i }: { i: number }) {
  if (i === 0) {
    return (
      <G>
        <Rect x={190} y={96} width={5} height={14} rx={2} fill={nest.chestDark} />
        <Circle cx={192} cy={92} r={11} fill={nest.mapTree} />
        <Circle cx={204} cy={106} r={7} fill={nest.mapTree} />
      </G>
    );
  }
  if (i === 1) return <Ellipse cx={243} cy={110} rx={16} ry={9} fill={nest.mapLake} />;
  return (
    <G>
      <Path d="M270 78 L283 54 L296 78 Z" fill={nest.mapPeak} />
      <Path d="M283 54 L288 63 L278 63 Z" fill={palette.white} />
      <Path d="M276 100 L290 80 L300 100 Z" fill={nest.mapPeak} opacity={0.8} />
    </G>
  );
}

/** El mapa; `gap` > 0 lo muestra en pedazos separados. */
function TreasureMap({ gap }: { gap: number }) {
  const cx = MAP.x + MAP.w / 2;
  const cy = MAP.y + MAP.h / 2;
  return (
    <G>
      {PIECES.map((piece, i) => (
        <G key={i} transform={`translate(${piece.dx * gap} ${piece.dy * gap}) rotate(${piece.rot * gap} ${cx} ${cy})`}>
          <Path d={piece.d} fill={nest.paper} stroke={nest.paperEdge} strokeWidth={4} strokeLinejoin="round" />
          <PieceArt i={i} />
        </G>
      ))}
    </G>
  );
}

// Camino del mapa: de abajo-izquierda a la X, arriba-derecha.
const ROUTE: [number, number][] = [
  [188, 130], [202, 122], [216, 124], [228, 114], [238, 102], [250, 96], [262, 100], [272, 88], [282, 78], [288, 62],
];

/** La X del tesoro. */
function Cross({ x, y }: { x: number; y: number }) {
  return <Path d={`M${x - 7} ${y - 7} L${x + 7} ${y + 7} M${x + 7} ${y - 7} L${x - 7} ${y + 7}`} stroke={nest.route} strokeWidth={5} strokeLinecap="round" />;
}

/** Capítulo 2: mapa armado y camino de puntos que avanza con `progress` hacia la X. */
function Route({ progress }: { progress: number }) {
  const shown = Math.max(1, Math.round(progress * (ROUTE.length - 1)) + 1);
  const end = ROUTE[ROUTE.length - 1];
  return (
    <G>
      <TreasureMap gap={0} />
      {ROUTE.slice(0, shown).map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={3.4} fill={nest.route} />
      ))}
      <Cross x={end[0]} y={end[1]} />
    </G>
  );
}

/** Capítulo 3: cofre abierto con monedas. */
function Chest() {
  const coins: [number, number][] = [[218, 116], [234, 110], [250, 108], [266, 112], [280, 118], [226, 124], [244, 122], [262, 124]];
  return (
    <G>
      <Path d="M200 120 L206 86 Q244 72 282 86 L288 120 Z" fill={nest.chestDark} />
      <Path d="M212 118 L216 94 Q244 84 272 94 L276 118 Z" fill={nest.chest} />
      <Rect x={198} y={118} width={92} height={46} rx={8} fill={nest.chest} />
      <Rect x={198} y={118} width={92} height={10} fill={nest.chestDark} opacity={0.5} />
      <Rect x={216} y={118} width={9} height={46} fill={nest.chestBand} />
      <Rect x={263} y={118} width={9} height={46} fill={nest.chestBand} />
      {coins.map(([x, y], i) => (
        <G key={i}>
          <Circle cx={x} cy={y} r={9} fill={nest.gold} />
          <Circle cx={x - 2} cy={y - 2} r={4} fill={nest.goldLight} />
        </G>
      ))}
      <Rect x={238} y={132} width={14} height={16} rx={4} fill={nest.gold} />
      <Rect x={243} y={138} width={4} height={6} rx={2} fill={nest.chestDark} />
      <Circle cx={190} cy={160} r={7} fill={nest.gold} />
      <Circle cx={188} cy={158} r={3} fill={nest.goldLight} />
      <Circle cx={302} cy={158} r={7} fill={nest.gold} />
      <Path d="M236 56 L236 70 M229 63 L243 63 M300 76 L300 88 M294 82 L306 82 M196 74 L196 84 M191 79 L201 79" fill="none" stroke={sparkle} strokeWidth={4} strokeLinecap="round" />
    </G>
  );
}

/**
 * El tesoro del Zorro. 1: el mapa roto (los pedazos se acercan con el avance). 2: el mapa armado con un
 * camino punteado que avanza hacia la X. 3: el cofre abierto con monedas.
 */
export function ZorroNest({ chapter, progress, mode, size }: NestProps) {
  const p = Math.min(1, Math.max(0, progress));
  return (
    <NestSvg id="zorro" mode={mode} size={size}>
      {chapter === 1 ? <TreasureMap gap={1.2 - 0.7 * p} /> : null}
      {chapter === 2 ? <Route progress={p} /> : null}
      {chapter === 3 ? <Chest /> : null}
      <NestMascot Drawing={ZorroDrawing} mood={NEST_MOOD[chapter]} mode={mode} x={chapter === 3 ? 50 : 36} />
    </NestSvg>
  );
}
