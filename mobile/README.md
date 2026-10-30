# Omero mobile

App móvil de Omero (finanzas personales) hecha con Expo SDK 58, expo-router, React 19.3, React Native 0.88 y TypeScript. Este README es para quien va a desarrollar: cómo correrla, cómo está armada y cómo tocarla sin romper nada.

Hoy la app corre con datos de ejemplo (`mock`). El backend real (`api`) está conectado solo para pagos por confirmar.

## 1. Cómo correrla

```bash
cd mobile
npm install
cp .env.example .env
npx expo start
```

Después escaneá el QR con la app **Expo Go** del teléfono (tiene que estar en la misma red que la compu).

Variables de entorno (archivo `.env` dentro de `mobile/`):

| Variable | Valor | Para qué |
|---|---|---|
| `EXPO_PUBLIC_DATA_SOURCE` | `mock` (default) o `api` | `mock` usa datos de ejemplo; `api` usa el backend. Cualquier valor distinto de `api` cae en `mock`. |
| `EXPO_PUBLIC_API_URL` | `https://<tu-app>.vercel.app` o `http://<IP de tu compu>:3000` | URL del backend. Sin barra al final. Solo hace falta con `api`. |

`.env.example` no trae `EXPO_PUBLIC_DATA_SOURCE`; si no lo agregás, igual corre en `mock`. Para probar el backend en local, usá la IP de tu compu (el teléfono no ve `localhost`). Si cambiás el `.env`, reiniciá con `npx expo start -c`.

Tests y tipos:

```bash
npm test            # node:test sobre src/data/__tests__/*.test.ts
npx tsc --noEmit   # tiene que salir sin errores
```

Para instalar paquetes usá siempre `npx expo install <paquete>` (resuelve la versión compatible con el SDK), nunca `npm install` directo.

## 2. Arquitectura

```
mobile/
  app/                        Rutas de expo-router. Son finas: solo importan pantallas de src/features.
    _layout.tsx               Shell raíz: fuentes, sesión, Stack con guard (mock: sin login; api: login).
    (tabs)/_layout.tsx        Tabs con la TabBar propia (secciones de `src/navigation`).
    (tabs)/index.tsx          Inicio.
    (tabs)/tarjetas.tsx       Tarjetas.
    (tabs)/deudas.tsx         Deudas.
    (tabs)/patrimonio.tsx     Patrimonio.
    (tabs)/mas.tsx            Más.
    cargar.tsx                Modal Cargar (hoja de opciones).
    deudas/nueva.tsx          Modal Nueva deuda o préstamo.
    notificaciones.tsx        Notificaciones.
    login.tsx                 Login (solo modo api).
  src/
    design-system/            Tokens (colores, tipo, espacios, radios, medidas), tema y fuentes.
    components/
      atoms/                  Piezas mínimas: Text, Icon, Button, Surface, Amount, Stack, etc.
      molecules/              Combinan atoms: SegmentedToggle, ListRow, EmptyState, MascotAvatar, etc.
      organisms/              Bloques de UI: TabBar, AppHeader, HeroGasto, MascotMessage, PendingConfirmCard, NoticeRow, etc.
      templates/              ScreenTemplate: layout de pantalla (zona segura, scroll, margen del DS).
    mascots/                  Mascotas: dibujos SVG, registro, provider y hooks de frases.
    i18n/                     i18next, locales por idioma y namespace, formateadores.
    data/                     DataSource (mock y api), hooks de React Query, selectores puros y tests.
    features/                 Pantallas que conectan datos y organisms: home, notifications, more, placeholders.
    providers/                AppProviders: i18n, React Query, sesión, tema y mascota.
  lib/                        Heredado: cliente HTTP (api.ts), sesión, storage (AsyncStorage) y tipos del backend.
  assets/                     Íconos y splash.
```

Reglas de imports (de más bajo a más alto):

| Capa | Puede importar | No debe importar |
|---|---|---|
| `design-system` | nada del proyecto (solo `lib/storage` para persistir el modo) | componentes, datos, pantallas |
| `atoms` | `design-system` | otras capas de componentes, datos |
| `molecules` | `atoms`, `design-system`, `mascots` | `organisms`, `data`, `features` |
| `organisms` | `atoms`, `molecules`, `design-system`, `mascots`, `i18n` | `data`, `features` |
| `templates` | `design-system` | datos, `features` |
| `features` | todo lo anterior y `data` | `app/` |
| `app/` | `features` (y `providers`, `components/organisms/TabBar` en `(tabs)/_layout.tsx`) | lógica de negocio |

Regla general: un componente no conoce pantallas concretas; recibe datos por props. Los organisms no piden datos: la pantalla (feature) los llama y se los pasa.

## 3. Sistema de diseño

Todo sale de `src/design-system`. Ningún componente tiene colores, tamaños de letra, radios ni espacios sueltos.

**Dónde vive cada cosa**

- `tokens/palette.ts`: el **único archivo con valores hex o rgba**. Tiene los colores crudos de cada tema, los colores de las mascotas (`palette.art`) y los fondos de las mascotas (`palette.backdrop`).
- `tokens/themes.ts`: los temas semánticos `tranqui` y `atrevido`. Cada uno mapea roles (`primary`, `surface`, `ink`...) a valores de `palette`.
- `tokens/typography.ts`: familias (`Unbounded` para display, `Manrope` para el resto) y estilos.
- `tokens/spacing.ts`, `radius.ts`, `sizes.ts`, `elevation.ts`: escalas del DS.
- `theme/ThemeProvider.tsx`: modo activo (guardado en AsyncStorage con la clave `omero_theme_mode`, default `tranqui`). No renderiza hijos hasta leer el modo guardado.
- `theme/useTheme.ts`: hook para leer el tema.
- `theme/fonts.ts`: `useAppFonts()` carga las fuentes de `@expo-google-fonts`.

**Temas**

Modo `tranqui` (default): fondo claro, primario azul (`#2F6FB0` como `tabActive`), acento beige. Sin stickers ni brillos (`bold: false`).

Modo `atrevido`: fondo azul noche, primario azul eléctrico, acento celeste (`#38E1FF`, también `tabActive`). Con stickers, accesorios y brillo neón (`bold: true`, `effects.hero` y `effects.fab` con `boxShadow`). La barra de estado es clara en este modo (`statusBar: "light"`).

Roles de color (`ThemeColors`), que es lo único que usan los componentes:

- Fondos y texto: `bg`, `surface`, `border`, `ink`, `inkMuted`.
- Acciones: `primary` / `onPrimary`, `accent` / `onAccent`, `tabActive`.
- Estados: `positive` / `positiveInk`, `warning` / `onWarning`, `danger` / `dangerInk` / `dangerTint`.
- Otros: `overlay`, `backdropRing`, `heroTrack`, `heroToggle` / `onHeroToggle`, `chartOutline`.
- Gráficos: `chart` es una tupla de 5 colores; el último es "Otros".

**Tipografía** (`typography.<estilo>`, se usa como `variant` en `<Text>`):

- Display (Unbounded): `heroAmount` (44, 900), `screenTitle` (24, 800), `cardTitle` (15, 700), `number` (18, 800), `numberSmall` (15, 700), `sticker` (11, 900).
- Texto (Manrope): `body` (15, 500), `bodySemi`, `bodyStrong` (15, 700), `secondary` (13, 500), `secondarySemi`, `secondaryStrong` (13, 800), `label` (11, 800, mayúsculas: escribí el texto ya en mayúsculas), `tab` y `tabActive` (11).

Como las fuentes son un archivo por peso, no se usa `fontWeight`: se usa `fontFamily` directo.

**Espacios, radios y medidas**

- `space`: claves 1, 2, 3, 4, 5, 6, 8 (base 4px). Ejemplo: `space[5]` es el margen lateral de toda pantalla; `space[4]` es el padding de tarjeta.
- `radius`: `input` 16, `button` 18, `card` 24, `hero` 28, `pill` 999. Todo es redondeado.
- `sizes`: `touch` 44 (mínimo de cualquier objetivo táctil), `tabBarHeight` 64, `fab` 64, `tabItemHeight` 52, `button` 52, `icon` 24, `iconSmall` 20, `hairline` 1, `ring` 2, entre otros.
- No hay sombras, salvo el brillo de `effects` en Atrevido (`glow()` de `elevation.ts`).

**Uso de `useTheme()`**

```tsx
import { Surface, Text, VStack } from "../components/atoms";
import { useTheme } from "../design-system";

export function EjemploTarjeta({ titulo }: { titulo: string }) {
  const { colors, space, radius, sizes } = useTheme();
  return (
    <Surface>
      <VStack gap={2}>
        <Text variant="cardTitle" tone="ink">{titulo}</Text>
        <Text variant="secondary" tone="inkMuted">Texto secundario</Text>
      </VStack>
    </Surface>
  );
}
```

`useTheme()` devuelve `{ mode, bold, colors, effects, type, space, radius, sizes, statusBar, setMode, toggleMode }`. Fuera de `ThemeProvider` tira error.

El `<Text>` de atoms ya toma `variant` (estilo tipográfico) y `tone` (rol de color: `ink`, `inkMuted`, `primary`, `onPrimary`, `onAccent`, `onWarning`, `positiveInk`, `dangerInk`). Usalo en vez de estilos sueltos.

**Cómo cambiar la marca o un color**

1. Cambiá el hex en `tokens/palette.ts`, dentro del bloque que corresponda (`tranqui`, `atrevido`, `backdrop`, `art`). No toques componentes.
2. Si cambia qué color cumple un rol (por ejemplo, el color de la pestaña activa), cambiá el mapeo en `tokens/themes.ts`.
3. Si necesitás un rol nuevo, agregalo a `ThemeColors` y completalo en `tranqui` y en `atrevido`. TypeScript te obliga a hacerlo.
4. Si cambia la tipografía, las fuentes van en `theme/fonts.ts` (paquetes `@expo-google-fonts`) y los nombres de familia en `tokens/typography.ts`.
5. Si cambia el nombre de la app, está en `src/i18n/locales/es/common.json` (`app.name`). Íconos y splash en `assets/`.
6. Verificá: `npx tsc --noEmit` y que no quede hex fuera de `palette.ts`:
   `grep -rnE "#[0-9A-Fa-f]{3,8}|rgba\(" src app | grep -v palette.ts` (tiene que dar vacío).
7. Probá los dos modos desde Más > Modo.

**Cómo agregar un modo nuevo** (por ejemplo, `nocturno`)

1. En `tokens/palette.ts` agregá un bloque con sus colores (`palette.nocturno`).
2. En `tokens/themes.ts` agregá `"nocturno"` al tipo `ThemeMode` y al array `THEME_MODES`, y una entrada en `themes` con `colors` completos, `effects`, `statusBar` y `bold`.
3. Las mascotas: `MascotDefinition.backdrop` es `Record<Mode, string>`, así que TypeScript te pide el fondo del modo nuevo en cada mascota (`mascots/registry.ts`).
4. Las frases de las mascotas usan `<momento>.<modo>` (`mascots.json`). Agregá la clave del modo nuevo en las cinco frases de cada mascota y en `common`, en los tres idiomas.
5. Los accesorios de las mascotas dependen de `bold` (`mascots/parts/mood.ts` deriva `bold` de `mode === "atrevido"`). Si el modo nuevo tiene que mostrar accesorios, ajustá esa función y los `Drawing`.
6. La opción aparece sola en Más > Modo porque usa `THEME_MODES`, pero hace falta la clave `more:mode.nocturno` en los tres idiomas.
7. Corré `npx tsc --noEmit` y revisá las pantallas en el modo nuevo.

## 4. Mascotas

Cuatro mascotas: `omero` (hornero, default), `pincho` (carpincho), `mati` (mate) y `zorro` (zorro gris). Cada una tiene una historia de 3 capítulos.

**Piezas**

- `mascots/types.ts`: `MascotId`, `Mood` (`calma`, `feliz`, `atento`, `festeja`), `Mode` (igual al modo del tema), `MascotMoment` (`dailyRemainder`, `allGood`, `pendingConfirm`, `debtDown`, `comeback`), `DrawingProps { mood, mode }` y `MascotDefinition`.
- `mascots/parts/parts.tsx`: piezas compartidas para que todas se vean uniformes: `Shadow`, `Eye`, `Brow`, `Blush`, `Sparkles`.
- `mascots/parts/mood.ts`: `moodFlags(mood, mode)` con las banderas derivadas (`happy`, `bold`, `up`, `calm`, `open`, `celebrate`, `blush`).
- `mascots/<id>/Drawing.tsx`: el dibujo de cada mascota en SVG (`react-native-svg`, viewBox `0 0 200 200`), con sus colores de `palette.art.<id>`.
- `mascots/registry.ts`: `MASCOTS: Record<MascotId, MascotDefinition>`, `getMascot(id)`, `listMascots()`, `isMascotId(valor)`, `DEFAULT_MASCOT = "omero"`.
- `mascots/MascotProvider.tsx`: `MascotProvider` y `useMascot()` → `{ mascotId, setMascotId }`. La elección se guarda con la clave `omero_mascot`.
- `mascots/Mascot.tsx`: `<Mascot id? mood? size />`. Dibuja la mascota sin fondo. `mood` por defecto es `feliz`, `id` por defecto la elegida, y el modo sale del tema. El `accessibilityLabel` sale de i18n.
- `components/molecules/MascotAvatar.tsx`: `<MascotAvatar size id? mood? />`. Es la mascota sobre su círculo de fondo con anillo de 2px. Usala siempre así; nunca suelta sobre `bg` o `surface`.
- `mascots/useMascotLine.ts`:
  - `useMascotLine(moment, vars?, id?)` devuelve la frase para el momento y el modo actual. Busca `mascots:<id>.lines.<momento>.<modo>` y cae a `mascots:common.lines.<momento>.<modo>`. Con `count` en `vars` resuelve los plurales.
  - Ejemplo: `useMascotLine("dailyRemainder", { amount: formatMoney(40866) })`.
  - `useMascotStory(id?)` devuelve `{ name, species, oneLiner, chapterTitle(n) }`.

**Cómo agregar una mascota nueva** (por ejemplo, `yaguarete`)

1. Creá `src/mascots/yaguarete/Drawing.tsx` exportando `YaguareteDrawing({ mood, mode }: DrawingProps)`. Usá `Shadow`, `Eye`, `Brow`, `Blush`, `Sparkles` de `../parts/parts` y `moodFlags` de `../parts/mood`, así queda uniforme. Si necesitás colores nuevos, agregá un bloque `art.yaguarete` en `palette.ts`.
2. En `mascots/types.ts` agregá el id a `MascotId` y a `MASCOT_IDS`.
3. En `mascots/registry.ts` agregá la entrada:
   ```ts
   yaguarete: {
     id: "yaguarete",
     i18nKey: "yaguarete",
     backdrop: { tranqui: palette.backdrop.yaguarete, atrevido: atrevidoBackdrop },
     Drawing: YaguareteDrawing,
     story: { chapters: 3 },
   },
   ```
   Y el color `yaguarete` en `palette.backdrop` (en `palette.ts`).
4. Textos en `src/i18n/locales/<idioma>/mascots.json`, en **los tres idiomas**. En `es` completos; en `pt-BR` y `en` con las mismas claves y valores vacíos (caen a español):
   - `yaguarete.name`, `yaguarete.species`
   - `yaguarete.story.oneLiner`, `yaguarete.story.chapter1`, `chapter2`, `chapter3`
   - `yaguarete.lines.{dailyRemainder,allGood,debtDown,comeback}.{tranqui,atrevido}`
   - `yaguarete.lines.pendingConfirm.{tranqui,atrevido}_one` y `_other`
5. TypeScript te marca lo que falte: `MASCOTS` es un `Record<MascotId, ...>`. La lista de Más (`listMascots()`) la toma sola; revisá que las cinco opciones entren en la fila del selector.
6. Probala en los dos modos y con los cuatro moods.

## 5. Textos (i18n)

Todo texto visible sale de i18n. Sin strings hardcodeadas.

**Namespaces y archivos**

Los namespaces son `common`, `tabs`, `home`, `notifications`, `more`, `mascots`, `cards`, `wealth` y `debts` (`src/i18n/resources.ts`). Cada uno es un JSON por idioma en `src/i18n/locales/<idioma>/<namespace>.json`. El namespace por defecto es `common`.

- `common`: acciones, estados, login, textos de "Próximamente", `app.name`.
- `tabs`: nombres de pestañas.
- `home`: héroe, gastos por categoría, fijos, alertas, historia.
- `notifications`: "Por confirmar", "Avisos", fechas relativas.
- `more`: modo, mascota, idioma, cuenta.
- `mascots`: nombres, historias y frases de las mascotas.

Uso:

```tsx
const { t } = useTranslation("home");
t("hero.perDay", { count: 27 });  // "por día · quedan 27 días"
```

**Claves tipadas**: `src/i18n/i18next.d.ts` toma el tipo de las claves de `es`. Una clave inexistente no compila. Con claves armadas dinámicamente (como el de las categorías de HomeScreen) hay que castear, como ya se hace en `HomeScreen`.

**Plurales**: i18next usa sufijos `_one` y `_other`. Pasá `count` y la clave base sin sufijo, por ejemplo `alert.pendingApplePay` con `count`.

**Interpolación**: `{{amount}}`, `{{name}}`, etc. `escapeValue` está apagado.

**Formateadores** (`src/i18n/format.ts`), siempre con el locale activo:

- `formatMoney(amount, currency = "ARS")`: `$ 40.866` en es-AR. Sin centavos.
- `formatNumber(value, fractionDigits = 0)`.
- `formatPercent(fraction, fractionDigits = 0)`: `0.43` → `43 %`.
- `formatDate(input, style)`: `style` es `short` (10/11), `long`, `month`, `monthYear` (noviembre 2026), `time` (09:12) o `dateTime`. Acepta `YYYY-MM-DD`, `YYYY-MM-DDTHH:mm` o `Date`.
- `parseLocal(input)` y `capitalize(texto)`.
- `useFormatWhen()` (`src/i18n/useFormatWhen.ts`): devuelve `formatWhen(iso, todayIso)` → "hoy 09:12", "ayer 19:40" o "28/10 08:05".

`src/i18n/index.ts` re-exporta `formatMoney`, `formatDate`, `formatPercent` y `formatNumber`. `capitalize` y `parseLocal` se importan desde `i18n/format`.

**Idioma activo**: hoy solo español. En `src/i18n/index.ts`, `SUPPORTED_LANGUAGES = ["es", "pt-BR", "en"]` y `SUPPORTED_ENABLED = ["es"]`. `currentLanguage()` devuelve el idioma activo y `setLanguage(lng)` lo cambia.

**Cómo activar portugués o inglés**

1. Completá los valores vacíos de `src/i18n/locales/pt-BR/*.json` (o `en/*.json`) con las mismas claves que `es`. Mientras estén vacíos, `returnEmptyString: false` hace que se muestre el español en silencio: revisá visualmente.
2. En `src/i18n/index.ts`, agregá el idioma a `SUPPORTED_ENABLED`, por ejemplo `["es", "pt-BR"]`.
3. `INTL_LOCALE` (en `index.ts`) y el mapa `INTL` (en `format.ts`) ya tienen `pt-BR` y `en`. Si agregás un idioma nuevo, actualizá los dos.
4. En Más, el idioma habilitado muestra el check; los que no están habilitados muestran "Próximamente". Ojo: hoy las filas de idioma no tienen `onPress`, o sea que no hay selector. El idioma se elige solo al arrancar, según el idioma del dispositivo (`pickLanguage`). Para un selector real, conectá `onPress` a `setLanguage(lng)`.

**Cómo agregar un texto**

1. Agregá la clave en `src/i18n/locales/es/<namespace>.json` (es la fuente de verdad y tipa las claves).
2. Agregá la misma clave en `pt-BR` y `en`, con valor `""`.
3. Usala con `useTranslation("<namespace>")` y `t("clave")`. Para plural, agregá `_one` y `_other`.
4. Para mascotas, las frases van en `mascots.json`, no en `home`.

## 6. Datos

Las pantallas nunca usan el mock directo: usan hooks de `src/data`.

**Interfaz** (`src/data/sources/DataSource.ts`):

```ts
interface DataSource {
  getHome(period?: string): Promise<HomeSummary>;   // period 'YYYY-MM'; default el actual
  getPendingPayments(): Promise<PendingPayment[]>;
  getNotifications(): Promise<AppNotifications>;     // { pending, notices }
  confirmPayment(id: string, amount?: number): Promise<void>;
}
```

Los tipos (`src/data/types.ts`): `HomeSummary`, `SpendingCategory`, `FixedProgress`, `PendingPayment`, `AppNotice`, `AppNotifications`.

**Elección de fuente** (`src/data/sources/index.ts`): `DATA_SOURCE` es `"api"` si `EXPO_PUBLIC_DATA_SOURCE === "api"`; si no, `"mock"`.

- `mock.ts`: datos del diseño (noviembre 2026, quedan 27 días, ingresos 3.500.000, etc.). Tiene 300 ms de latencia y el estado vive en memoria: confirmar un pago lo saca de la lista. `confirmPayment` ignora `amount`.
- `api.ts`: `getPendingPayments` y `getNotifications` llaman a `GET /api/plan/inbox` (cliente de `lib/api.ts`). `getNotifications` devuelve `notices: []`. `getHome` y `confirmPayment` tiran `NotImplementedError` hasta que se implementen.

**Hooks** (`src/data/index.ts`, React Query):

- `useHome(period?)`: resumen del mes para Inicio.
- `usePendingPayments()`: pagos de Apple Pay por confirmar.
- `useNotifications()`: `{ pending, notices }` para la pantalla de Notificaciones.
- `useNotificationBadge()`: número del globo de la campana (pendientes + avisos sin leer). Devuelve 0 mientras carga.
- `useConfirmPayment()`: mutación `mutate({ id, amount? })`. Al confirmar invalida `["home"]`, pendientes y notificaciones.

El `queryClient` tiene `staleTime` de 15 s, `retry: 1` y refresca al volver a la app (`AppState`).

**Selectores puros** (`src/data/selectors.ts`): `dailyAllowance(free, daysLeft)` (libre dividido por días, redondeado hacia abajo, nunca negativo), `fixedProgressRatio`, `spendingTotal`, `notificationBadgeCount`, `clampChapter`. Los tests están en `src/data/__tests__/selectors.test.ts`.

**Cómo conectar una pantalla a la API real**

1. Confirmá que el endpoint existe en el backend. Si devuelve otra forma, agregá el DTO en `lib/types.ts`.
2. En `src/data/sources/api.ts`, reemplazá el `throw new NotImplementedError(...)` del método por la llamada real, usando `api<T>("GET", "/api/...")`. Mapeá el DTO al tipo de `src/data/types.ts` en una función `toX()` del mismo archivo, como ya hace `toPending`.
3. No cambies la forma de `HomeSummary` ni las pantallas: el objetivo de la capa es que la pantalla no note la diferencia.
4. Si es una mutación, implementá también su firma (`confirmPayment(id, amount)`) y dejá que `useConfirmPayment` invalide las queries.
5. Si la función de mapeo es pura, agregá un test en `src/data/__tests__/`.
6. Probá en modo `api`: `.env` con `EXPO_PUBLIC_DATA_SOURCE=api` y `EXPO_PUBLIC_API_URL`, y `npx expo start -c`. En modo `api` la app exige sesión (`login.tsx`).

## 7. Navegación

- **Secciones** (`src/navigation/sections.ts`): fuente única, en orden de la barra: **Inicio** (`index`), **Tarjetas** (`tarjetas`), **Deudas** (`deudas`), **Patrimonio** (`patrimonio`) y **Más** (`mas`). Cada una trae `key`, `route` e íconos (`icon` / `iconActive`). La barra y los títulos salen de ahí.
- **TabBar** (`components/organisms/TabBar.tsx`): píldora flotante con las 5 secciones (la activa con cápsula `tabActiveBg` e ícono relleno) y, fuera de la píldora, el botón circular **Cargar** (`fab-cargar`). Medidas en `sizes.tabBarHeight` y `sizes.fab`. `ScreenTemplate` deja el aire inferior para que la barra no tape nada.
- **Cargar** no es una pestaña: el botón hace `router.push("/cargar")` y abre el modal con las opciones (Gasto, Ingreso, Deuda o préstamo, Resumen de tarjeta). Arriba está **"Contale a {{mascota}}"** (`VoiceCapture` + `useVoiceRecorder` con `expo-audio`): grabás o escribís, `useInterpretVoice` llama a `POST /api/plan/voice` (en `mock`, un intérprete local por palabras clave) y la mascota responde según el `VoiceOutcome` (contrato compartido en `src/lib/plan/voice.ts`): `draft` abre el formulario precargado, `notYet` pide que esperes, `chat` aclara que solo carga finanzas, `unclear` pide repetir; los errores reintentables se reintentan solos y los demás quedan reportados (`AppErrorReport`). Qué se carga por voz lo define `VOICE_SUPPORTED` (hoy solo ingreso). Opciones a mano habilitadas: Ingreso (`/ingresos/nuevo`) y Deuda o préstamo (`/deudas/nueva`).
- **Deudas** (`app/(tabs)/deudas.tsx` → `DebtsScreen`): Debo / Me deben, tarjetas, préstamos y terminados. "Agregar" abre `app/deudas/nueva.tsx` (`NewDebtScreen`, modal) con `?direction=OWE|OWED`.
- **Inicio** tiene la campana en el header (`AppHeader`). Va a `/notificaciones` y muestra el badge de `useNotificationBadge()`.
- **Notificaciones** (`app/notificaciones.tsx` → `NotificationsScreen`) tiene dos secciones separadas: **Por confirmar** (arriba, `PendingConfirmCard`) y **Avisos** (abajo, `NoticeRow`).
- **Stack raíz** (`app/_layout.tsx`): `(tabs)`, `cargar` (modal), `deudas/nueva` (modal), `notificaciones`. `login` solo aparece en modo `api` cuando no hay sesión.
- **Más**: modo Tranqui/Atrevido, mascota, idioma y, en modo `api`, cuenta y cierre de sesión.

### Lógica centralizada

- **Dominio compartido con la web**: la lógica de préstamos y plata vive en `src/lib/plan/core.ts` (raíz del repo, pura). La app la usa solo a través de `src/domain/index.ts` (Metro la ve por `watchFolders`). No se re-exporta nada que devuelva texto en español: eso va por i18n. Si falta una función de core, agregala al re-export; no la copies.
- **Selectores de datos** (`src/data/selectors.ts`): usan las funciones de `domain`; no duplican cálculos. La deuda de tarjetas es un único selector, `cardsDebt(overview, period)`, que usan Tarjetas, Deudas y Patrimonio.
- **Mascota y modo por providers**: `MascotProvider` (`useMascot()`) y `ThemeProvider` (`useTheme().mode`). Ninguna pantalla recibe ni decide la mascota o el modo: `<Mascot/>`, `useMascotLine`, `MascotMessage` y `useSectionLabel` los leen solos.
- **Nombres de sección**: `useSectionLabel(key)` (barra) y `useSectionTitle(key)` (título de pantalla) en `src/navigation`. Los dos resuelven el caso especial de Patrimonio en Atrevido (el lugar de la mascota). Las pantallas usan `useSectionTitle` en su `ScreenHeader`.

## 8. Pendiente

- **Cargar**: Gasto y Resumen de tarjeta muestran "Próximamente". Por voz solo se carga Ingreso (deuda por voz es lo próximo). En `mock`, con audio se usa un texto de ejemplo; escribí `error` o `error fatal` para probar los errores.
- **Confirmar un pago** en `mock` ignora la categoría y el monto: el flujo de categoría llega con Cargar.
- **Fuente `api`**: solo implementa pagos por confirmar. `getHome` tira error, así que en modo `api` Inicio muestra el estado de error.
- **Selector de idioma** no implementado (ver sección 5).
- **Dispositivo físico**: la app todavía no fue probada en un teléfono real, solo en Expo Go.
