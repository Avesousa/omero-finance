/**
 * Paleta cruda de la marca Omero. ÚNICO archivo del proyecto con valores hexadecimales/rgba.
 * Los temas (themes.ts) y los dibujos de las mascotas toman sus colores de acá por nombre.
 */
export const palette = {
  white: "#FFFFFF",

  tranqui: {
    bg: "#F4F6F8",
    surface: "#FFFFFF",
    border: "#DDE3EA",
    ink: "#14233B",
    inkMuted: "#4A5568",
    primary: "#2F6FB0",
    accent: "#E9C98B",
    positive: "#3FA796",
    positiveInk: "#23795F",
    warning: "#F0B43A",
    danger: "#E06A55",
    dangerInk: "#B83E2C",
    dangerTint: "#FCE6E1",
    heroTrack: "#1F4F82",
    chartOutline: "#A0AEC0",
    overlay: "rgba(20,35,59,0.40)",
  },

  atrevido: {
    bg: "#070B1A",
    surface: "#111833",
    border: "#26305A",
    ink: "#F5F7FF",
    inkMuted: "#A9B4D0",
    primary: "#2F5BFF",
    accent: "#38E1FF",
    onAccent: "#070B1A",
    positive: "#2EE6A8",
    warning: "#FFE14D",
    danger: "#FF4D6D",
    dangerInk: "#FF8095",
    dangerTint: "#2A1230",
    heroTrack: "#1636B8",
    chartOutline: "#A9B4D0",
    overlay: "rgba(0,0,0,0.55)",
    glowHero: "rgba(47,91,255,0.55)",
    glowFab: "rgba(47,91,255,0.7)",
  },

  /** Texto oscuro sobre rellenos de warning/danger (igual en los dos modos). */
  onWarning: "#14233B",

  /** Círculos de fondo de cada mascota en Tranqui (en Atrevido todos van en atrevido.surface). */
  backdrop: {
    omero: "#DCEFFB",
    pincho: "#F3E6C8",
    mati: "#D8F0E6",
    zorro: "#E7E1F7",
  },

  /** Colores de los dibujos de las mascotas (ilustración; no son roles de UI). */
  art: {
    ink: "#1F1A17",
    cream: "#F6EAD2",
    blush: "#EC7A6C",
    sparkle: "#8CC7E6",
    shadowWarm: "#2A1C15",
    shadowCool: "#14233B",
    omero: {
      tail: "#A9532A",
      body: "#C9703F",
      belly: "#F3E2C2",
      cheek: "#F6EAD2",
      wing: "#A9532A",
      capVisor: "#1E3FCC",
      cap: "#2F5BFF",
      beak: "#6B4A33",
      legs: "#6B4A33",
      mud: "#8A5A3B",
      mudLight: "#A87452",
    },
    pincho: {
      body: "#9B6A3E",
      belly: "#B98756",
      dark: "#7A5230",
      nostril: "#2A1C15",
      orange: "#F0B43A",
      leaf: "#3FA796",
      phones: "#2F5BFF",
    },
    mati: {
      gourd: "#7F8F3A",
      gourdDark: "#6B7A2E",
      yerba: "#5E7A2E",
      rim: "#C9D1D9",
      straw: "#C9D1D9",
      legs: "#4F5A22",
      lens: "#0B1220",
      lensGlint: "#38E1FF",
    },
    zorro: {
      fur: "#8A94A6",
      tailBand: "#C2562B",
      tailTip: "#FFFFFF",
      belly: "#F6EAD2",
      legs: "#5A6478",
      earInner: "#F3E2C2",
      face: "#FFFFFF",
      nose: "#1F1A17",
      bandana: "#FF4D6D",
    },
  },
} as const;

export type Palette = typeof palette;
