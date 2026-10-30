/** Medidas fijas del sistema Omero. */
export const sizes = {
  /** Todo objetivo táctil mide al menos esto. */
  touch: 44,
  header: 56,
  headerAvatar: 44,
  bubbleAvatar: 56,
  /** Alto de la píldora flotante de navegación. */
  tabBarHeight: 64,
  /** Botón circular Cargar (igual de alto que la píldora). */
  fab: 64,
  /** Cápsula de fondo de la pestaña activa. */
  tabItemHeight: 52,
  button: 52,
  icon: 24,
  iconSmall: 20,
  /** Íconos protagonistas (micrófono de la voz). */
  iconLarge: 34,
  badge: 18,
  hairline: 1,
  ring: 2,
} as const;

export type SizeKey = keyof typeof sizes;
