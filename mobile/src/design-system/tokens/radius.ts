/** Radios del sistema Omero: todo es redondeado. */
export const radius = {
  input: 16,
  button: 18,
  card: 24,
  hero: 28,
  pill: 999,
} as const;

export type RadiusKey = keyof typeof radius;
