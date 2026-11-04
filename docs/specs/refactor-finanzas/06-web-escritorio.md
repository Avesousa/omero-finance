# Spec transversal WEB — Escritorio (refactor "Hogar → Finanzas")

Depende de `00-contrato.md`. Cada semana S1..S6 entrega mobile + web juntas; este documento define la parte web de cada una.
Rutas reales hoy: `src/app/plan/{page,gastos,ingresos,tarjetas,prestamos,patrimonio,presupuesto,categorias,por-confirmar,exportar,perfil,apple-pay,mas}`, componentes en `src/components/plan/*` (`plan-nav.tsx`, `entries-client.tsx`, `entry-sheet.tsx`, `month-client.tsx`, `plan-ui.tsx`, ...), lógica en `src/lib/plan/*`.

## 1. Objetivo y "Listo cuando"

**Objetivo**: la web `/plan` deja de ser un clon angosto del mobile (`max-w-lg`, nav inferior flotante) y pasa a ser una app de escritorio: sidebar fija, contenido multi-columna, Movimientos como tabla densa, selector de finanza con Omero y color por finanza, y todo el modelo nuevo (cuentas, vínculos, contactos, grupos) visible y operable. En pantallas < 1024 px conserva el comportamiento actual (nav inferior, una columna).

**Listo cuando** (global, al cerrar S6):
1. A >= 1280 px, `/plan` muestra sidebar + 3 paneles lado a lado (Resumen | Movimientos | Pendientes) sin scroll horizontal.
2. El selector de finanza (sidebar) cambia la finanza activa y el color/acento de toda la UI sin recargar; "Todas" agrega las finanzas accesibles.
3. `/plan/movimientos` es una tabla con búsqueda por `refCode`, filtros por finanza, cuenta, tipo, categoría, mes y origen, orden por columna y acciones masivas (mover a finanza).
4. Cada semana S1..S6 tiene su pantalla web en producción con el mismo contrato de API que mobile (sin endpoints solo-web).
5. A < 1024 px nada del flujo actual se rompe (regresión manual en las 12 rutas existentes).

## 2. Alcance / Fuera de alcance

**Alcance**: shell de escritorio, tokens compartidos, mascota Omero en web, Movimientos tabla, paneles, pantallas web por semana, atajos de teclado básicos, estados vacíos/carga/error.
**Fuera de alcance**: app nativa de escritorio, SSO, rediseño de login (`src/app/login`), la sección legacy fuera de `/plan` (`dashboard`, `tdc`, `movimientos` raíz del MVP viejo: no se tocan; el nuevo es `/plan/movimientos`), reportes/PDF (siguen en `exportar`), offline, drag & drop de movimientos, edición inline en celdas (v2).

## 3. Spec funcional

### 3.1 Layout de escritorio
- **Sidebar** (240 px, colapsable a 72 px iconos): logo + Omero chico; **selector de finanza** arriba (lista con punto de color, tipo PERSONAL/SHARED, "Todas"); navegación: Inicio (Mes), Movimientos, Tarjetas, Cuentas, Préstamos, Patrimonio, Presupuesto, Contactos, Grupos, Pendientes (badge), Más (categorías, exportar, perfil). Pie: mes selector + toggle tema.
- **Topbar** (56 px): breadcrumb, búsqueda global (Cmd/Ctrl+K: por `refCode` `MOV-XXXX`, descripción, contacto), botón "Cargar" (abre drawer lateral derecho en lugar del bottom-sheet de `entry-sheet.tsx`).
- **Contenido**: grilla de 12 columnas, `max-w-[1600px]`, gap 16/24. Breakpoints: `>=1280` 3 paneles; `1024-1279` 2 paneles (Pendientes pasa a drawer); `<1024` layout mobile actual (nav inferior).
- **Paneles de Inicio**: izquierda Resumen del mes (héroe disponible, barras por categoría, presupuesto), centro Movimientos recientes (últimos 15, compacto, link a tabla), derecha Pendientes (por confirmar, cuotas por vencer, deudas, "me deben", invitaciones).

### 3.2 Selector de finanza y color
- La finanza activa vive en cookie `omero_finance` (leída en server, para SSR sin parpadeo) y se envía como header `x-finance-id` en cada fetch (`api()` de `plan-ui.tsx` es el único punto). Valor especial `all`.
- Cada `Household.color` genera `--finance` y `--finance-subtle` en el contenedor raíz de la app; reemplaza el violeta fijo de `--accent` solo en elementos "de finanza" (punto del selector, borde superior del panel, chip de la tabla, botón primario). Estados semánticos (verde/rojo/ámbar) no cambian.
- Omero en el selector: la mascota cambia de `mood` al cambiar de finanza (`feliz` al entrar a una compartida, `calma` en personal) y muestra una frase de `useMascotLine` equivalente.

### 3.3 Movimientos (tabla densa) — `/plan/movimientos`
Columnas: fecha, **refCode** (monoespaciado, copiable), descripción, categoría, **finanza** (chip con color), **cuenta**, tipo (ingreso/gasto), monto (ARS/USD con snapshot), neto vinculado (gasto − `EntryLink`, ver contrato 4), origen (`MANUAL|COVERAGE|LOAN_OUT|GROUP|GROUP_BACK` con ícono), estado (confirmado/pendiente).
- Filas de 36 px, header sticky, paginación por cursor (50), orden por fecha/monto/finanza.
- Filtros (barra superior, estado en URL `?q=&finance=&account=&kind=&cat=&source=&period=`): búsqueda de texto + `refCode` exacto o prefijo, multiselect de finanza, cuenta, rango de mes.
- Fila de otra finanza no accesible: "Otra finanza · $monto · MOV-XXXX", sin descripción ni categoría, no editable (contrato 5).
- Selección múltiple -> "Mover a finanza" (acción S1) y "Vincular a gasto" (S3).
- Clic en fila abre panel de detalle a la derecha (vínculos, cobertura, grupo, historial de cuenta).
- Totales del filtro en footer sticky.

### 3.4 Casos borde
- Usuario con una sola finanza: el selector se muestra igual pero sin "Todas" ni "Mover a".
- Finanza sin permiso de escritura (VIEWER): botones de edición deshabilitados con tooltip "Solo lectura".
- Mes no iniciado: reutilizar `NotStartedNotice` de `plan-ui.tsx` dentro del panel Resumen.
- Tabla vacía por filtros: estado vacío con Omero `atento` + "Limpiar filtros".
- Moneda mixta en "Todas": totales por moneda y total convertido con tasa del snapshot de cada fila.

### 3.5 Textos clave
"Finanza activa", "Todas las finanzas", "Otra finanza", "Mover a finanza", "Buscar por MOV-XXXX, descripción o contacto", "Pendientes", "Solo lectura".

## 4. Spec técnico

### 4.1 Convenciones de este Next.js (verificado en `node_modules/next/dist/docs`)
- Next 16.2.2: el archivo `src/proxy.ts` **reemplaza a `middleware`** (`03-file-conventions/proxy.md`: "middleware is deprecated and renamed to proxy"). Ya existe `src/proxy.ts`; si hay que leer/propagar la finanza activa se hace ahí o en route handlers, nunca creando `middleware.ts`.
- Layouts anidados y route groups (`layout.md`, `route-groups.md`): usar un grupo `src/app/plan/(escritorio)/` solo si hace falta separar el shell; preferido: reescribir `src/app/plan/layout.tsx` con shell responsive (sidebar `hidden lg:flex`, `PlanNav` `lg:hidden`).
- **Parallel routes** (`parallel-routes.md`): slots `@resumen`, `@movimientos`, `@pendientes` en `src/app/plan/` para Inicio. Regla del doc: si un slot es dinámico, todos los del mismo nivel lo son (ya usamos `export const dynamic = "force-dynamic"`). Requieren `default.tsx`. Alternativa más simple si el equipo prefiere: componentes servidor lado a lado en `page.tsx` con `Suspense`; se decide al implementar S1 (riesgo 7.1).
- Páginas siguen siendo `async` con `searchParams` como promesa (patrón actual `planPageData(searchParams)` en `src/lib/plan/page.ts`). Antes de codear cada pantalla, releer `layout.md`, `page.md` y `parallel-routes.md` (AGENTS.md).
- Tailwind 4 (`@import "tailwindcss"`), shadcn en `src/components/ui`.

### 4.2 Tokens de diseño compartidos
Fuente única: `mobile/src/design-system/tokens/*` (`palette`, `spacing` base 4, `radius`, `sizes`, `themes` tranqui/atrevido). La web hoy usa otro sistema (zinc + violeta, variables `--bg-primary`, `--accent` en `src/app/globals.css`). Plan:
1. Extraer los tokens puros (sin imports de `react-native`) a `src/lib/design/tokens.ts` — `palette.ts`, `spacing.ts`, `radius.ts` ya son datos puros; `elevation.ts`/`sizes.ts` quedan en mobile. `mobile` pasa a re-exportar desde allí (mismo precedente que `mobile/src/domain/monthPlan.ts`, que ya importa `../../../src/lib/plan/core.ts`).
2. Script `scripts/gen-tokens-css.ts` genera `src/app/tokens.generated.css` con `--omero-*` por tema; `globals.css` mapea los nombres actuales (`--bg-primary` -> `--omero-bg`, etc.) para no reescribir componentes existentes.
3. Mapeo de temas: modo web claro = `tranqui`, oscuro = `atrevido` (el toggle actual `ThemeProvider` se mantiene; `theme-init.js` ya evita el flash).
4. Color de finanza: paleta `Household.color` restringida al array `palette.tranqui.categorical` (8 tonos) para consistencia; guardado como hex, validado en API (S1).
5. Densidad: escritorio usa escala 4/8/12/16/24; texto base 14 px (tabla 13 px); touch 44 px solo en `<1024`.
6. Sin sombras salvo el brillo de atrevido (regla de `elevation.ts`).

### 4.3 Qué se comparte con mobile vs. qué es propio
| Se comparte (una sola fuente) | Propio de web | Propio de mobile |
|---|---|---|
| `src/lib/plan/*` (core, access, resumen, voice parsing): tipos DTO, `fmtMoney`, `isValidPeriod`, `canAccess` | Shell: sidebar, topbar, drawer, tabla, atajos, Cmd+K | Tab bar flotante, bottom sheets, voz nativa, háptica, notificaciones |
| Contratos API `/api/plan/*` (`{error}`, `POST /:id`) y header `x-finance-id` | `src/components/plan/*` (React DOM + Tailwind) | `mobile/src/features/*` (React Native) |
| Tokens (§4.2) y claves de color por finanza | CSS generado, `next/font` Geist | `ThemeProvider` RN, fuentes Expo |
| Textos: mover claves de `mobile/src/i18n/locales` a JSON neutro `src/lib/i18n/es/*.json` (mascotas, estados vacíos) y consumirlos en web con un `t()` mínimo | `t()` mínimo web (sin i18next) | `i18next` |
| Definición de mascotas (`registry.ts`, `types.ts`, líneas `MascotMoment`) | Render SVG DOM | Render `react-native-svg` |

Regla: lógica de negocio nueva (vínculos, cobertura, reparto de grupo, neto) va en `src/lib/plan/*` con Jest y se consume en ambos; si una función necesita `react-native` o `next`, no va ahí.

### 4.4 Mascota Omero en web
Fuentes: `mobile/src/mascots/omero/Drawing.tsx` (+ `Nest.tsx`), `parts/{parts,nest,mood}.tsx`, `Mascot.tsx`, `registry.ts`, `types.ts` (`Mood = calma|feliz|atento|festeja`, `Mode` = modo del tema), `useMascotLine.ts`. Los dibujos usan solo `Circle/Ellipse/Path` de `react-native-svg` y `palette.art.omero`.
- Enfoque: **shim de SVG DOM** — `src/components/omero/svg-shim.tsx` exporta `Svg, Circle, Ellipse, Path, G, Rect, ...` como elementos DOM; un alias de TS/bundler (`react-native-svg` -> shim) **solo en el import de los dibujos** no es viable sin tocar mobile, por eso: script `scripts/gen-mascots-web.ts` copia `mobile/src/mascots/{omero,parts,types,registry}` a `src/components/omero/generated/` reemplazando `from "react-native-svg"` por el shim y `from "../../design-system"` por `@/lib/design/tokens`. El generado no se edita a mano y se commitea.
- Componente `<OmeroMascot mood size />` + hook `useMascotLine(moment)` (lectura del JSON compartido de §4.3).
- Dónde aparece: sidebar (36 px), selector de finanza, estados vacíos, panel Pendientes ("todo al día" -> `feliz`), toasts de éxito (`festeja`), login. Respeta `prefers-reduced-motion`.
- Solo Omero en v1 web; pincho/mati/zorro quedan detrás de la preferencia de perfil existente (`profile-client.tsx`) si mobile ya la expone (riesgo 7.2).

### 4.5 Componentes web nuevos (`src/components/plan/desktop/`)
`app-sidebar.tsx`, `finance-switcher.tsx`, `topbar.tsx`, `command-search.tsx`, `entry-drawer.tsx` (variante escritorio de `entry-sheet.tsx`, mismo formulario), `movements-table.tsx`, `movements-filters.tsx`, `movement-detail-panel.tsx`, `summary-panel.tsx`, `pending-panel.tsx`, `finance-chip.tsx`, `omero-empty.tsx`. Tabla: `<table>` semántica + `@tanstack/react-table` (agregar dependencia, riesgo 7.3) con virtualización no necesaria a 50 filas/página.

### 4.6 Endpoints
La web **no crea endpoints propios**; consume los de cada semana. Único añadido transversal (acordar con S1): `GET /api/plan/entries?finance=&account=&q=&refCode=&kind=&cat=&source=&period=&cursor=` con permisos vía `canAccess`, respuesta `{ items: EntryDTO[], nextCursor, totals }`. Se implementa en S1 con filtros finanza/q y se extiende en S2 (cuenta) y S3 (refCode, source). Es el mismo que usa mobile Movimientos.

## 5. Plan por semana (mobile + web salen juntas)

| Sem | Pantalla / componente web | Listo cuando |
|---|---|---|
| **S1** Finanzas | Shell de escritorio completo (`layout.tsx`, sidebar, topbar, `PlanNav` solo `<lg`), `finance-switcher` con color y Omero, tokens compartidos (§4.2), cookie + header `x-finance-id`, `/plan/movimientos` v1 (tabla con filtros finanza/texto/mes y acción masiva "Mover a finanza"), Inicio en 3 paneles con datos de la finanza activa, pantalla "Finanzas" (crear/renombrar/color/miembros y roles) | Cambiar de finanza en el selector recolorea la UI y filtra Inicio/Movimientos sin recargar; "Todas" suma las accesibles; mover 3 movimientos a otra finanza desde la tabla refleja el cambio en ambas finanzas; un VIEWER ve todo en solo lectura; `<1024px` sigue funcionando como hoy |
| **S2** Cuentas | `/plan/cuentas` (lista + saldo por cuenta, detalle, transferencias `PlanAccountTransfer`), columna y filtro **cuenta** en la tabla, campo cuenta obligatorio en `entry-drawer`, `/plan/tarjetas` con titular (`Card.ownerUserId`), finanzas asociadas (`CardFinance`) y **reparto del pago de resumen por finanza** | Se crea cuenta, se transfiere entre cuentas y el saldo cuadra; todo movimiento muestra su cuenta; pagar un resumen repartido entre 2 finanzas genera un movimiento por finanza que suma el total; filtrar por cuenta en la tabla coincide con el saldo de la cuenta |
| **S3** Vínculos y cobertura | Columnas **refCode** y **origen**, búsqueda por `MOV-XXXX`, panel de detalle con `EntryLink` (vincular ingreso -> gasto, tipo `REIMBURSEMENT|BUSINESS`), neto y excedente; pantalla **Cobertura entre finanzas** (`FinanceCoverage`), arrastre de resumen (`carryOver`) visible en Tarjetas; fila "Otra finanza · monto · MOV-XXXX" | Vincular un reintegro a un gasto muestra gasto neto correcto (mín. 0, excedente como ingreso) en tabla y Resumen; buscar un `refCode` de otra finanza devuelve la fila anonimizada; una cobertura crea movimientos `COVERAGE` en ambas finanzas |
| **S4** Contactos y préstamos | `/plan/contactos` (CRUD, invitar por email -> `Invite`, estado vinculado), `/plan/prestamos` con contraparte contacto o finanza (`LOAN_OUT`), toggle de inclusión en `/plan/patrimonio`, panel Pendientes con invitaciones y cuotas a cobrar | Crear contacto, prestarle (`LOAN_OUT` genera el egreso en la cuenta elegida), registrar la devolución y ver el efecto en Patrimonio con el toggle on/off; invitación pendiente aparece en Pendientes |
| **S5** Grupos (gastos) | `/plan/grupos` lista + `/plan/grupos/[id]` en 2 columnas: gastos del grupo (tabla) y saldos por miembro; alta de `GroupExpense` con reparto (`GroupExpenseShare`) igualitario/porcentual/monto; movimientos origen `GROUP` en la tabla general | Crear grupo con miembros usuario y contacto, cargar un gasto repartido y ver quién debe a quién; mi parte aparece como `GROUP` en Movimientos de la finanza elegida |
| **S6** Grupos (liquidación) | Liquidar deuda (`GroupSettlement`) con asistente de lado a lado (deudas simplificadas | confirmación), movimientos `GROUP_BACK`, Pendientes con "te deben / debés" por grupo; **pulido final**: atajos (`g m`, `/`, Cmd+K), estados vacíos con Omero, a11y, regresión completa | Liquidar un saldo deja el grupo en cero y genera movimientos `GROUP_BACK` correctos en ambas puntas; Lighthouse a11y >= 90 en Inicio y Movimientos; checklist del "Listo cuando" global (§1) pasa completo |

## 6. Plan de tareas (transversal)
1. Tokens puros -> `src/lib/design/tokens.ts`; mobile re-exporta. *(base de todo; bloquea 3, 5)*
2. Script `gen-tokens-css.ts` + mapeo en `globals.css`. *(tras 1)*
3. Shell: `layout.tsx` responsive, `app-sidebar`, `topbar`, ocultar `PlanNav` en `lg`. *(tras 2; paralelizable con 4)*
4. Script `gen-mascots-web.ts` + shim + `<OmeroMascot>`; JSON de líneas compartido. *(tras 1; paralelizable con 3)*
5. `finance-switcher`, cookie `omero_finance`, header `x-finance-id` en `api()` de `plan-ui.tsx`, CSS vars `--finance*`. *(tras 3 y 4; requiere API S1)*
6. `movements-table` + filtros + estado en URL + detalle. *(tras 5; endpoint de §4.6)*
7. Inicio en 3 paneles (`summary-panel`, `pending-panel`, reuso de `month-client.tsx`). *(tras 5; paralelizable con 6)*
8. `entry-drawer` reemplazando sheet en `>=lg`. *(paralelizable con 6)*
9. Por semana: pantallas de la tabla §5 (cada una depende de la API de su semana).
10. Cierre S6: atajos, a11y, regresión.

## 7. Tests
- **Unitarios (Jest, `src/lib/plan`)**: parseo/serialización de filtros URL <-> query, formateo del `refCode`, agregación "Todas" multimoneda, mapeo color de finanza -> variables, `canAccess` para UI (solo lectura).
- **Integración**: `GET /api/plan/entries` con filtros combinados y fila anonimizada de otra finanza; header `x-finance-id` inválido -> `{ error }` 403.
- **E2E manual (navegador de escritorio 1440/1280/1024/390 px + iPhone para el responsive)**: checklist de "Listo cuando" por semana; ambos temas; navegación por teclado; `prefers-reduced-motion`. Playwright (ya configurado) para 3 flujos: cambiar finanza, buscar refCode, mover movimientos.

## 8. Riesgos

- Generar el código de mascotas copiando de `mobile/` acopla web a la estructura de mobile; alternativa de largo plazo: paquete `packages/mascots`.
- La cookie de finanza activa se valida contra `canAccess` en servidor (decidido en S1: el header/cookie nunca se confía).
- Sin entidades nuevas fuera del contrato; el único endpoint transversal es el listado de §4.6.

## 9. Contrato entre semanas (web)
- **S1 deja**: shell, tokens, switcher, tabla v1, endpoint de listado, cookie/header. **S2 asume** esos y agrega cuenta.
- **S2 deja**: columna/filtro cuenta, cuentas y tarjetas con reparto. **S3 asume** que el listado soporta `account` y que la tabla admite columnas condicionales.
- **S3 deja**: `refCode`, `source`, panel de detalle con vínculos, anonimizado. **S4 asume** el panel de detalle extensible y Pendientes con secciones registrables.
- **S4 deja**: contactos, invitaciones, préstamos `LOAN_OUT`, toggle Patrimonio. **S5 asume** el selector de contacto/usuario reutilizable (`person-picker.tsx`).
- **S5 deja**: grupos y gastos repartidos (`GROUP`). **S6 asume** saldos por miembro calculados en `src/lib/plan/groups.ts` y cierra con `GROUP_BACK`, atajos y a11y.

---

## 10. 💬 Preguntas para charlar

> Cómo usar esta sección: cada pregunta vive en **un solo spec** (el de menor número que la toca) aunque afecte a otros; las demás semanas la referencian por su código (`Q-Sx-n`). Respondé en la línea **Respuesta**. Al ejecutar un spec, todas las respuestas de esta sección y las de los specs anteriores forman parte de su contexto.

**Q-W-1 · Paneles: parallel routes o `Suspense`**
Las parallel routes obligan a que todos los slots del nivel sean dinámicos y requieren `default.tsx`.
- Recomendación: server components con `Suspense` (más simple).
- **Respuesta:** _(pendiente)_

**Q-W-2 · Mascotas secundarias en la web**
pincho, mati y zorro además de Omero.
- Recomendación: solo Omero.
- **Respuesta:** _(pendiente)_

**Q-W-3 · Dependencia `@tanstack/react-table`**
Para la tabla densa de Movimientos.
- Recomendación: aceptarla; evita reinventar orden y selección.
- **Respuesta:** _(pendiente)_

**Q-W-4 · Contraste del acento por finanza en tema oscuro**
Validar AA del color de cada finanza sobre el fondo.
- Recomendación: validar la paleta completa antes de S1 web.
- **Respuesta:** _(pendiente)_

