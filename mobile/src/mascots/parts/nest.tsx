import type { ComponentType, ReactNode } from "react";
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from "react-native-svg";
import { palette } from "../../design-system";
import type { DrawingProps, MascotId, Mode, Mood, NestChapter } from "../types";

const { nest } = palette.art;

export const NEST_W = 320;
export const NEST_H = 200;
/** Línea donde empieza el piso de todas las escenas. */
export const GROUND_Y = 150;
/** Y de las patas de la mascota (la mascota va a escala MASCOT_SCALE sobre el piso). */
export const FEET_Y = 172;
export const MASCOT_SCALE = 0.35;

/** Mood de la mascota en cada capítulo: tranquila, contenta, festejando. */
export const NEST_MOOD: Record<NestChapter, Mood> = { 1: "calma", 2: "feliz", 3: "festeja" };

/** Colores del fondo y del piso de la escena según modo (Atrevido: surface oscuro con piso `border`). */
export function nestColors(id: MascotId, mode: Mode) {
  const bold = mode === "atrevido";
  return {
    backdrop: bold ? palette.atrevido.surface : palette.backdrop[id],
    ground: bold ? palette.atrevido.border : nest.ground[id],
    ring: bold ? palette.atrevido.accent : palette.tranqui.border,
  };
}

interface NestSvgProps {
  id: MascotId;
  mode: Mode;
  size: number;
  children: ReactNode;
}

/**
 * Marco común de las escenas (viewBox 320x200): fondo redondeado de la mascota, piso y aro de 3 unidades
 * (aro accent en Atrevido, como el círculo de las mascotas). La accesibilidad la pone quien lo usa.
 */
export function NestSvg({ id, mode, size, children }: NestSvgProps) {
  const c = nestColors(id, mode);
  return (
    <Svg viewBox={`0 0 ${NEST_W} ${NEST_H}`} width={size} height={(size * NEST_H) / NEST_W}>
      <Defs>
        <ClipPath id="nest-frame">
          <Rect x={0} y={0} width={NEST_W} height={NEST_H} rx={22} />
        </ClipPath>
      </Defs>
      <G clipPath="url(#nest-frame)">
        <Rect x={0} y={0} width={NEST_W} height={NEST_H} fill={c.backdrop} />
        <Path d={`M0 ${GROUND_Y} Q160 ${GROUND_Y - 8} 320 ${GROUND_Y} V200 H0 Z`} fill={c.ground} />
        {mode === "atrevido" ? (
          <>
            <Circle cx={40} cy={34} r={2.5} fill={palette.atrevido.accent} opacity={0.8} />
            <Circle cx={118} cy={20} r={2} fill={palette.white} opacity={0.7} />
            <Circle cx={196} cy={42} r={2.5} fill={palette.atrevido.accent} opacity={0.6} />
            <Circle cx={284} cy={22} r={2} fill={palette.white} opacity={0.7} />
          </>
        ) : null}
        {children}
      </G>
      <Rect x={1.5} y={1.5} width={NEST_W - 3} height={NEST_H - 3} rx={21} fill="none" stroke={c.ring} strokeWidth={3} />
    </Svg>
  );
}

interface NestMascotProps {
  Drawing: ComponentType<DrawingProps>;
  mood: Mood;
  mode: Mode;
  /** Esquina izquierda del dibujo (200x200) en la escena. */
  x: number;
  /** Escala (default 0.35 = 70 px). */
  scale?: number;
}

/** La mascota chica parada sobre el piso de la escena. */
export function NestMascot({ Drawing, mood, mode, x, scale = MASCOT_SCALE }: NestMascotProps) {
  const y = FEET_Y - 186 * scale;
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      <Drawing mood={mood} mode={mode} />
    </G>
  );
}
