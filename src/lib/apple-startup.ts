/**
 * Pantallas de arranque para iPhone (apple-touch-startup-image).
 * iOS exige una imagen por tamaño de pantalla; sin ellas muestra un fondo blanco al abrir.
 * [ancho en puntos, alto en puntos, densidad] → /public/splash/splash-{px}x{px}.png
 */
const IPHONE_SCREENS: [number, number, number][] = [
  [375, 667, 2], // SE
  [414, 896, 2], // XR, 11
  [375, 812, 3], // X, XS, 11 Pro, 12 mini, 13 mini
  [414, 896, 3], // XS Max, 11 Pro Max
  [390, 844, 3], // 12, 13, 14, 16e
  [428, 926, 3], // 12 Pro Max, 13 Pro Max, 14 Plus
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16
  [430, 932, 3], // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  [402, 874, 3], // 16 Pro, 17, 17 Pro
  [440, 956, 3], // 16 Pro Max, 17 Pro Max
  [420, 912, 3], // Air
];

export const appleStartupImages = IPHONE_SCREENS.map(([w, h, dpr]) => ({
  url: `/splash/splash-${w * dpr}x${h * dpr}.png`,
  media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
}));
