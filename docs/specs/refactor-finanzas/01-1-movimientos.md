# S1.1 — Movimientos completos y vencidos visibles

Estado: implementado en mobile en `feat/finanzas-s1-1-movimientos`; validación manual en iPhone pendiente. La adaptación web queda pendiente. Paso previo a S2.

## Alcance solicitado

La pantalla Movimientos de la finanza activa reúne lo que ya existe en la app:

1. Gastos cargados, incluidos los fijos.
2. Pagos de deudas/cuotas.
3. Pagos de resúmenes de tarjetas de crédito.
4. Ingresos.
5. En el filtro Gastos, un aviso superior de obligaciones vencidas sin pagar.

No incorpora funciones futuras de S2–S6. No depende de cuentas, transferencias, reparto de resúmenes, vínculos, contactos ni grupos. Mobile y web comparten las reglas funcionales; no requiere el nuevo layout de escritorio.

## Presentación acordada

- Conservar la pantalla actual con selector de mes, búsqueda y filtros **Todas / Ingresos / Gastos**. No crear pantallas o secciones separadas por tipo.
- La lista muestra movimientos reales, agrupados por fecha del más reciente al más antiguo. Todas reúne ingresos y gastos; Ingresos muestra ingresos registrados/cobrados; Gastos incluye gastos cargados, fijos pagados, pagos de deudas y pagos de resúmenes. Una cuota pagada aparece una sola vez, aunque provenga de un gasto generado.
- **Solo en Gastos**, mostrar arriba un aviso de pagos ya vencidos: fijos, cuotas de deudas y resúmenes reales sin pagar cuya fecha de vencimiento sea anterior a hoy. Mostrar nombre, importe y vencimiento. Es un aviso, no un movimiento realizado ni una sección general de pendientes. Al pagar, desaparece del aviso y el pago aparece en la lista.
- No mostrar próximos vencimientos, pendientes futuros ni propuestas de meses no iniciados en la lista de movimientos. El objetivo de S1.1 es corregir que la pantalla muestre proyecciones en lugar de reflejar las operaciones reales.

Una compra con tarjeta no es un pago de resumen: no se agrega como otra salida de dinero en este historial. El pago del resumen se representa una sola vez por resumen con el modelo actual. Esta vista no cambia el cálculo de presupuesto ni `buildSummary`.

## Fechas y totales

- Vencido = obligación real sin pagar y fecha de vencimiento < fecha local de hoy. Lo que vence hoy todavía no integra el aviso de vencidos.
- No inferir vencimientos a partir de la fecha de carga. Los resúmenes usan `PlanCardStatement.dueDate`; para fijos/cuotas hay que verificar el significado de `PlanEntry.date` antes de usarlo como vencimiento.
- No confundir fecha de vencimiento con fecha de pago. Tarjetas dispone de `paidAt`; verificar qué fecha de pago conservan actualmente fijos y cuotas. No inventar fechas históricas faltantes.
- Los totales de esta pantalla corresponden a movimientos reales del filtro. El aviso de vencidos no suma como gasto realizado. No duplicar el pago de una cuota. Estos totales no modifican los del presupuesto.

## Decisiones por cerrar

1. Propuesta: el aviso superior incluye también vencidos de meses anteriores de la finanza activa, aunque el historial esté filtrado por mes. Indicar el período en cada fila.
2. Propuesta: tocar un vencido abre el flujo existente para pagarlo (fijo, Deudas o Tarjetas), respetando permisos de S1.
3. Confirmar las reglas de fechas y totales al revisar los flujos existentes; no modificar presupuesto como efecto secundario de completar esta pantalla.

## Referencias de implementación actuales

- `mobile/src/data/movements.ts`: arma la lista desde entradas, incluidos fijos y cuotas; actualmente no incorpora resúmenes como filas ni separa vencidos arriba.
- `mobile/src/features/movements/MovementsScreen.tsx`: pantalla con mes, búsqueda, filtros y grupos por día/próximos/sin fecha.
- `prisma/schema.prisma`: `PlanEntry` y `PlanCardStatement` como fuentes actuales.

## Criterios de aceptación

- Un gasto, un ingreso, una cuota pagada y un resumen pagado se encuentran en Movimientos, sin duplicados.
- Se conservan Todas / Ingresos / Gastos, mes y búsqueda en una única pantalla.
- Un fijo, una cuota o un resumen vencido sin pagar aparece como aviso arriba únicamente en Gastos; pagarlo actualiza la lista y retira el aviso.
- No aparecen pendientes futuros ni proyecciones como movimientos; los vencidos no inflan los totales realizados.
- Un pago realizado deja de figurar como vencido; un vencimiento de hoy no dice «vencido».
- Cambiar de finanza respeta aislamiento y roles; VIEWER no recibe acciones de pago.
- No se introducen dependencias de S2 ni cambia el resultado del presupuesto por agregar filas a la pantalla.

## Validación de la primera implementación mobile

- Se mantienen filtros, búsqueda y selector de mes incluso cuando no hay movimientos, para poder acceder al aviso de Gastos.
- El aviso usa vencimientos del mes seleccionado. Incluir meses anteriores sigue siendo una propuesta no acordada.
- Los resúmenes exponen `paidAt` desde el backend y se agrupan por día de Buenos Aires. Si falta la fecha histórica de pago, aparecen en «Sin fecha».
- Fijos y cuotas conservan la fecha disponible en la entrada; el modelo actual no guarda una fecha de pago separada. No se introducen migraciones en S1.1.
- Tocar un resumen lleva a Tarjetas; una cuota, a Deudas; un fijo vencido, a Gastos fijos. Se conservan los permisos de lectura de S1.

## Ampliación — Cobro de ingresos recurrentes

Rama: `fix/ingresos-recurrentes-cobrados`.

- Confirmar un ingreso recurrente desde el chat abre el formulario para revisar cobro y fecha.
- Crear un ingreso recurrente permite indicar «Ya lo cobré» (activado por defecto) y fecha de cobro. Desactivarlo conserva el ingreso por confirmar, fuera del historial realizado.
- En Movimientos → Ingresos, «Confirmar ingresos» permite abrir ingresos recurrentes existentes del mes y confirmar el cobro sin crear otro registro. Editar estos ingresos no aplica cambios a la regla futura por defecto.
- `PlanEntry.collectedAt` (DATE nullable) guarda la fecha real del cobro sin reutilizar el vencimiento. El historial usa esa fecha cuando existe. No se infieren ni completan fechas históricas automáticamente.
- La API acepta `isDone` y `collectedAt` al crear un ingreso fijo y al actualizar un ingreso. Deshacer un cobro borra `collectedAt`; fechas imposibles o futuras se rechazan. Clientes anteriores sin estos campos conservan el comportamiento al crear fijos pendientes.
- La regla recurrente no almacena el estado de cobro: iniciar el siguiente mes genera el ingreso pendiente y sin fecha de cobro.
- Migración: `20261104170000_income_collection_date`. Debe aplicarse antes de desplegar el backend que lee la columna. Este cambio no requiere ejecutar el backfill de S2 ni modificar su esquema.
- Verificación: tests de mobile, validación de cobros y endpoints sobre PostgreSQL temporal local. Prueba manual en iPhone pendiente.

### Prueba manual

1. Con la migración y backend nuevos disponibles, crear un sueldo recurrente con «Ya lo cobré» activado; verificar fecha y monto en Movimientos → Ingresos.
2. Crear otro con la opción desactivada: no aparece en el historial; sí en «Confirmar ingresos».
3. Abrir uno de los sueldos existentes desde «Confirmar ingresos», activar «Ya lo cobré», elegir fecha y guardar. Verificar que aparece una sola vez y sale de la lista por confirmar.
4. Editar el sueldo cobrado y desactivar el cobro: vuelve a confirmación y no cuenta como movimiento realizado.
5. Iniciar el siguiente mes: el sueldo recurrente vuelve a generarse pendiente, sin copiar la fecha ni el estado de cobro anterior.
