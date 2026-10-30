import { ClipPath, Defs, Ellipse, G, Path, Rect } from "react-native-svg";
import { palette } from "../../design-system";
import { NEST_MOOD, NestMascot, NestSvg } from "../parts/nest";
import type { NestProps } from "../types";
import { OmeroDrawing } from "./Drawing";

const { nest, omero: c } = palette.art;

const BASE_Y = 172;
const OVEN_X = 246;

/** Ladrillo de barro: rect redondeado con una veta más oscura abajo. */
function Brick({ x, y, w = 20, h = 11 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <>
      <Rect x={x} y={y} width={w} height={h} rx={3} fill={nest.brick} />
      <Rect x={x + 2} y={y + h - 4} width={w - 4} height={3} rx={1.5} fill={nest.brickDark} />
    </>
  );
}

/** Capítulo 1: una rama con la base de barro y algunos ladrillos (más con el avance). */
function FirstBrick({ progress }: { progress: number }) {
  const count = 2 + Math.round(progress * 4); // 2..6
  const row1 = [-36, -14, 8, 30];
  const row2 = [-25, -3, 19];
  return (
    <G>
      <Path d={`M178 ${BASE_Y - 6} L314 ${BASE_Y - 10}`} stroke={nest.branch} strokeWidth={9} strokeLinecap="round" />
      <Path d={`M286 ${BASE_Y - 10} L304 ${BASE_Y - 30}`} stroke={nest.branch} strokeWidth={6} strokeLinecap="round" />
      <Leaf cx={304} cy={BASE_Y - 31} />
      <Ellipse cx={OVEN_X} cy={BASE_Y - 12} rx={52} ry={13} fill={c.mud} />
      <Ellipse cx={OVEN_X - 6} cy={BASE_Y - 15} rx={20} ry={4} fill={c.mudLight} />
      {row1.map((dx, i) => (i < count ? <Brick key={`a${i}`} x={OVEN_X + dx - 10} y={BASE_Y - 31} /> : null))}
      {row2.map((dx, i) => (i + row1.length < count ? <Brick key={`b${i}`} x={OVEN_X + dx - 10} y={BASE_Y - 43} /> : null))}
    </G>
  );
}

function Leaf({ cx, cy }: { cx: number; cy: number }) {
  return <Ellipse cx={cx} cy={cy} rx={7} ry={5} fill={palette.art.pincho.leaf} />;
}

const RX = 52;
const RY = 66;
const WALL = 11;

/** Medio ancho de una elipse (rx, ry) centrada en el piso del horno, a la altura h. */
const halfWidth = (h: number, rx = RX, ry = RY) => rx * Math.sqrt(Math.max(0, 1 - (h / ry) ** 2));

/** Rama sobre la que se apoya el horno. */
function Branch() {
  return (
    <G>
      <Path d={`M176 ${BASE_Y + 6} L316 ${BASE_Y + 3}`} stroke={nest.branch} strokeWidth={10} strokeLinecap="round" />
      <Path d={`M300 ${BASE_Y + 3} L312 ${BASE_Y - 12}`} stroke={nest.branch} strokeWidth={6} strokeLinecap="round" />
      <Leaf cx={313} cy={BASE_Y - 14} />
    </G>
  );
}

/** Hiladas de ladrillos que siguen la curva de la cúpula. */
function Courses({ max }: { max: number }) {
  return (
    <>
      {[16, 34, 52].filter((y) => y < max - 4).map((y) => (
        <Path
          key={y}
          d={`M${OVEN_X - halfWidth(y)} ${BASE_Y - y} Q${OVEN_X} ${BASE_Y - y + 8} ${OVEN_X + halfWidth(y)} ${BASE_Y - y}`}
          fill="none"
          stroke={nest.brickDark}
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.55}
        />
      ))}
    </>
  );
}

/** Capítulo 2: las paredes curvas de la cúpula suben (abiertas arriba), siguiendo la curva del domo. */
function Walls({ h }: { h: number }) {
  const top = BASE_Y - h;
  const outer = halfWidth(h);
  const inner = halfWidth(h, RX - WALL, RY - WALL);
  const mid = (outer + inner) / 2;
  return (
    <G>
      <Defs>
        <ClipPath id="omero-oven-c2">
          <Rect x={OVEN_X - 60} y={top} width={120} height={h + 6} />
        </ClipPath>
      </Defs>
      <G clipPath="url(#omero-oven-c2)">
        <Ellipse cx={OVEN_X} cy={BASE_Y} rx={RX} ry={RY} fill={nest.brick} />
        <Ellipse cx={OVEN_X} cy={BASE_Y} rx={RX - WALL} ry={RY - WALL} fill={c.beak} />
        <Ellipse cx={OVEN_X} cy={BASE_Y} rx={RX - WALL - 10} ry={RY - WALL - 10} fill={nest.brickDark} opacity={0.5} />
        <Courses max={h} />
      </G>
      <Ellipse cx={OVEN_X - mid} cy={top} rx={(outer - inner) / 2 + 1} ry={4} fill={nest.brick} />
      <Ellipse cx={OVEN_X + mid} cy={top} rx={(outer - inner) / 2 + 1} ry={4} fill={nest.brick} />
    </G>
  );
}

/** Capítulo 3: cúpula completa y redondeada con la entrada en arco a un costado. */
function Dome() {
  return (
    <G>
      <Defs>
        <ClipPath id="omero-oven-c3">
          <Rect x={OVEN_X - 60} y={BASE_Y - RY - 2} width={120} height={RY + 8} />
        </ClipPath>
      </Defs>
      <G clipPath="url(#omero-oven-c3)">
        <Ellipse cx={OVEN_X} cy={BASE_Y} rx={RX} ry={RY} fill={nest.brick} />
        <Ellipse cx={OVEN_X + 14} cy={BASE_Y - 30} rx={20} ry={30} fill={nest.brickDark} opacity={0.25} />
        <Ellipse cx={OVEN_X - 16} cy={BASE_Y - 44} rx={10} ry={16} fill={c.mudLight} opacity={0.35} />
        <Courses max={RY} />
      </G>
      <Path d={`M${OVEN_X - 38} ${BASE_Y + 6} V${BASE_Y - 10} A15 15 0 0 1 ${OVEN_X - 8} ${BASE_Y - 10} V${BASE_Y + 6} Z`} fill={nest.brickDark} />
      <Path d={`M${OVEN_X - 33} ${BASE_Y + 6} V${BASE_Y - 10} A10 10 0 0 1 ${OVEN_X - 13} ${BASE_Y - 10} V${BASE_Y + 6} Z`} fill={c.beak} />
    </G>
  );
}

/**
 * El nido de Omero. 1: base de barro y ladrillos sobre una rama. 2: horno a medio levantar (sube con el avance).
 * 3: la casa completa con puerta y Omero en la entrada.
 */
export function OmeroNest({ chapter, progress, mode, size }: NestProps) {
  const p = Math.min(1, Math.max(0, progress));
  return (
    <NestSvg id="omero" mode={mode} size={size}>
      {chapter === 1 ? <FirstBrick progress={p} /> : null}
      {chapter >= 2 ? <Branch /> : null}
      {chapter === 2 ? <Walls h={24 + p * 38} /> : null}
      {chapter === 3 ? <Dome /> : null}
      {chapter === 2 ? (
        <>
          <Brick x={168} y={BASE_Y + 8} />
          <Brick x={190} y={BASE_Y + 12} w={18} />
        </>
      ) : null}
      <NestMascot Drawing={OmeroDrawing} mood={NEST_MOOD[chapter]} mode={mode} x={chapter === 3 ? 134 : 56} />
    </NestSvg>
  );
}
