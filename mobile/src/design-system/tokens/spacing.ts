/** Escala de espaciado (base 4px) del sistema Omero. */
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16, // padding de tarjeta y separación entre bloques
  5: 20, // margen lateral de toda pantalla
  6: 24,
  8: 32,
} as const;

export type SpaceKey = keyof typeof spacing;
