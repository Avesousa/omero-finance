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
| `/plan` | **Mi mes**: arriba se elige qué número ver en grande, **Disponible** o **Libre** (se recuerda en el dispositivo); el otro queda debajo. Desglose, alertas y presupuesto vs. gasto. Si el mes no está iniciado muestra el **inicio de mes guiado**. |
| `/plan/ingresos` | Ingresos fijos (con regla de recurrencia) y otros ingresos del mes. |
| `/plan/gastos` | Gastos fijos (tildables como pagados) y gastos del mes. |
| `/plan/tarjetas` | Resúmenes a pagar (total, mínimo, USD, vencimiento), compras en cuotas y cuotas a futuro. |
| `/plan/prestamos` | Préstamos y deudas: lo que debo y lo que me deben, con cuotas, interés y saldo. |
| `/plan/presupuesto` | Presupuesto por categoría contra lo gastado. |
| `/plan/patrimonio` | Lo que tenés, lo que debés y el neto mes a mes. |
| `/plan/categorias` | Categorías de gastos y de ingresos. |
| `/plan/exportar` | Resumen del mes en Markdown o JSON para copiar, compartir o descargar (`src/lib/plan/export.ts`). |

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
- **Disponible** = ingresos − lo que ya salió: gastos del mes, fijos y cuotas tildados como pagados y
  resúmenes de tarjeta pagados. Lo cargado y todavía sin pagar sigue en el disponible.
- **Libre** = disponible − reservado. Por categoría se reserva lo que falta gastar del presupuesto o,
  si lo cargado lo supera (o no hay presupuesto), lo que falta pagar. Equivale a
  ingresos − Σ máx(presupuesto, cargado). Pagar algo ya previsto baja el disponible y no el libre;
  pasarse del presupuesto o gastar fuera de él baja los dos.
- **Tarjetas** cuentan por lo que se paga en el mes: el resumen si está cargado
  (total, mínimo u otro monto) o, si todavía no llegó, la suma de cuotas cargadas (estimado).
  Las compras con tarjeta no suman en otras categorías, para no contar dos veces.
- **Tarjetas, cómo se identifican**: banco + marca + titular ("Banco Nación · Visa · Avelino").
  Si a una tarjeta vieja le faltan esos datos se muestra su nombre heredado hasta que se edite.
  Desde *Tarjetas → Administrar tarjetas* se agregan, editan y eliminan (`/api/plan/cards`);
  eliminar una tarjeta borra también sus compras y resúmenes de Plan simple, previa confirmación.
- **Préstamos y deudas** (`PlanLoan`): *Debo* genera gastos (categoría "Deudas y préstamos")
  y *Me deben* genera ingresos ("Cobro de deudas"). Tres modalidades:
  - *Cuota fija*: capital + N cuotas. El primer mes usa la cuota cargada o, si no hay,
    la del sistema francés con el interés; los meses siguientes proponen la cuota del mes anterior.
  - *Cuotas variables*: un monto por mes (`PlanLoanScheduleItem`).
  - *Sin cuotas*: saldo + pago sugerido por mes (sin pasarse del saldo) y fecha límite opcional.
  - **Interés** opcional en % diario, semanal, quincenal o mensual. Al generar la cuota del mes se calcula
    sobre el saldo pendiente: tasa × veces en el mes (misma regla que los fijos). Interés simple.
  - Cada cuota es un `PlanEntry` con `loanId` (uno por préstamo y mes) que se genera al iniciar el mes
    (editable en el inicio guiado) o al cargar el préstamo si su mes ya está iniciado.
  - Saldo = inicial + intereses generados − cuotas pagadas. Al tildar la última cuota (o saldar el saldo)
    el préstamo se cierra solo; si se destilda, se reabre.
  - En Patrimonio el saldo aparece solo (no se carga a mano). Eliminar un préstamo borra sus cuotas, previa confirmación.
  - **Cuotas anteriores**: las cuotas saldadas antes de usar la app se cargan como pagadas en sus meses
    (*Préstamos → Cargar cuotas ya pagadas*, o "Cuotas que ya pagaste" al dar de alta). Corrigen el número
    de cuota y el saldo sin tocar el mes en curso; con interés, cada una lo calcula sobre el saldo de su mes
    y se recalcula el de las pendientes (`pastPaymentPlan`, `addPastPayments`).
  - En Patrimonio la deuda cuenta desde el mes en que se cargó, aunque su primera cuota sea más adelante.
- Las cuotas de préstamos que pago descuentan del disponible al tildarlas. Las cuotas que **me deben**
  suman como ingreso recién cuando se tildan como cobradas; hasta entonces figuran aparte como
  "Por cobrar" y no entran en el disponible, el presupuesto ni los ingresos destinados (`isReceivable`).
- **Presupuesto**: el gasto real de cada categoría sale de los movimientos;
  el de "Tarjetas de crédito" sale de los resúmenes. Estados: ok, cerca del tope (≥ 85 %), excedido.
- **Ingresos con destino**: un ingreso puede destinarse a una categoría de gasto
  (por ejemplo, ahorro); aparece marcado en esa línea del presupuesto.
- **Dólares**: cada mes guarda su tipo de cambio (`PlanMonth.usdRate`) y con ese se pasa todo a pesos.

## Código

```
prisma/migrations/20261002120000_add_plan_simple/   tablas Plan*
prisma/migrations/20261003120000_add_plan_loans/    préstamos y deudas (solo agrega)
src/lib/plan/core.ts        lógica pura + formato
src/lib/plan/server.ts      carga de datos y helpers de API (sesión, validación)
src/lib/plan/loans.ts       préstamos: validación, generación de cuotas y cierre
src/lib/plan/page.ts        sesión + mes para las páginas
src/app/plan/**             páginas (server components)
src/app/api/plan/**         rutas (todas filtran por householdId)
src/components/plan/**      componentes cliente
```

Cambios en archivos existentes: `prisma/schema.prisma` (modelos nuevos y relaciones inversas),
`src/components/layout/bottom-nav.tsx` (se oculta dentro de `/plan`) y `src/app/mas/page.tsx` (link a Plan simple).
