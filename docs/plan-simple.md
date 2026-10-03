# Plan simple (`/plan`)

Sección nueva, aparte de la app clásica, pensada para cargar rápido y con poca fricción.
Usa los mismos tokens de diseño (`globals.css`) y componentes base (`components/ui`).
La app clásica no cambia: se entra desde **Más → Plan simple** y se vuelve desde **Plan → Más → App clásica**.

## Puesta en marcha

```bash
git switch -c feat/plan-simple     # los cambios están sin commitear sobre main
npx prisma migrate dev             # aplica 20261002120000_add_plan_simple y regenera el cliente
npm run dev                        # http://localhost:3000/plan
```

La migración solo **crea** tablas y enums nuevos (`Plan*`); no modifica ni borra nada existente.
El SQL se escribió a mano siguiendo las convenciones de Prisma (no se pudo descargar el
schema engine en el entorno donde se generó). Si `migrate dev` detecta alguna diferencia mínima,
va a proponer una migración de ajuste: es seguro aceptarla.

Las categorías por defecto se crean solas la primera vez que el hogar entra a `/plan`.

## Pantallas

| Ruta | Qué hace |
|---|---|
| `/plan` | **Mi mes**: número único "Disponible", desglose, alertas y presupuesto vs. gasto. Si el mes no está iniciado muestra el **inicio de mes guiado**. |
| `/plan/ingresos` | Ingresos fijos (con regla de recurrencia) y otros ingresos del mes. |
| `/plan/gastos` | Gastos fijos (tildables como pagados) y gastos del mes. |
| `/plan/tarjetas` | Resúmenes a pagar (total, mínimo, USD, vencimiento), compras en cuotas y cuotas a futuro. |
| `/plan/presupuesto` | Presupuesto por categoría contra lo gastado. |
| `/plan/patrimonio` | Lo que tenés, lo que debés y el neto mes a mes. |
| `/plan/categorias` | Categorías de gastos y de ingresos. |

El mes se elige con `?period=YYYY-MM` y se mantiene al navegar.

## Usarla en el iPhone como app

La app es instalable (PWA): no pasa por el App Store y se actualiza sola con cada deploy.

1. Abrí la URL de producción en **Safari** e iniciá sesión.
2. Tocá **Compartir → Agregar a inicio**.
3. Abrila desde el ícono: arranca en `/plan`, a pantalla completa.

Qué hay detrás: `src/app/manifest.ts` (nombre, ícono, `start_url: /plan`), `src/app/apple-icon.png`,
`public/icons/*`, pantallas de arranque en `public/splash/*` (listadas en `src/lib/apple-startup.ts`)
y `src/components/plan/app-shell.tsx` (aviso de instalación y refresco de datos al volver a la app).
La app instalada guarda su propia sesión, separada de Safari; dura 30 días.
Sin conexión no funciona: todos los datos se leen del servidor.

Para publicarla más adelante en el App Store, el camino es envolver esta misma web con Capacitor
(proyecto de Xcode + cuenta de Apple Developer). Apple suele rechazar apps que son solo un sitio
envuelto, así que conviene sumar algo nativo (notificaciones de vencimientos, Face ID, widgets).

## Reglas de cálculo

Toda la lógica está en `src/lib/plan/core.ts` (pura, con tests en `core.test.ts`).

- **Fijos**: una regla (`PlanRecurring`) guarda el monto *por vez* y la frecuencia.
  Cada mes genera un movimiento por `monto × veces en el mes`
  (mensual 1, quincenal 2, diario = días del mes, semanal = veces que cae ese día: 4 o 5).
  El monto del mes se puede editar sin tocar la regla, o guardarlo como base para los meses siguientes.
- **Disponible** = ingresos − gastos fijos − gastos del mes − tarjetas.
- **Tarjetas** cuentan por lo que se paga en el mes: el resumen si está cargado
  (total, mínimo u otro monto) o, si todavía no llegó, la suma de cuotas cargadas (estimado).
  Las compras con tarjeta no suman en otras categorías, para no contar dos veces.
- **Presupuesto**: el gasto real de cada categoría sale de los movimientos;
  el de "Tarjetas de crédito" sale de los resúmenes. Estados: ok, cerca del tope (≥ 85 %), excedido.
- **Ingresos con destino**: un ingreso puede destinarse a una categoría de gasto
  (por ejemplo, ahorro); aparece marcado en esa línea del presupuesto.
- **Dólares**: cada mes guarda su tipo de cambio (`PlanMonth.usdRate`) y con ese se pasa todo a pesos.

## Código

```
prisma/migrations/20261002120000_add_plan_simple/   tablas Plan*
src/lib/plan/core.ts        lógica pura + formato
src/lib/plan/server.ts      carga de datos y helpers de API (sesión, validación)
src/lib/plan/page.ts        sesión + mes para las páginas
src/app/plan/**             páginas (server components)
src/app/api/plan/**         rutas (todas filtran por householdId)
src/components/plan/**      componentes cliente
```

Cambios en archivos existentes: `prisma/schema.prisma` (modelos nuevos y relaciones inversas),
`src/components/layout/bottom-nav.tsx` (se oculta dentro de `/plan`) y `src/app/mas/page.tsx` (link a Plan simple).
