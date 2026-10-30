/** Medidas fijas del sistema Omero. */
export const sizes = {
  /** Todo objetivo táctil mide al menos esto. */
  touch: 44,
  header: 56,
  headerAvatar: 44,
  bubbleAvatar: 56,
  tabBar: 84,
  fab: 60,
  /** Cuánto sube el botón central sobre la barra de pestañas. */
  fabLift: 26,
  fabBorder: 4,
  button: 52,
  icon: 24,
  iconSmall: 20,
  badge: 18,
  hairline: 1,
  ring: 2,
} as const;

export type SizeKey = keyof typeof sizes;
