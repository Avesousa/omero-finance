# Estado de ejecución del refactor

Revisión: 4 de noviembre de 2026.

El plan vigente sigue el [contrato compartido](00-contrato.md). `docs/plan.md` corresponde a la app clásica eliminada.

| Etapa | Estado en el repositorio |
|---|---|
| S1 — Dueño y finanzas | Backend desplegado y backfill aplicado; usuario confirmó prueba en iPhone de login, estabilidad, creación de Hogar y selector Personal/Hogar. Release EAS y resto de la matriz E2E pendientes de verificación. |
| S2 — Cuentas y tarjetas | Especificada; pendiente implementación y respuestas de la sección 9. |
| S3 — Vínculos | Especificada; pendiente implementación. |
| S4 — Contactos y deudas | Especificada; pendiente implementación. |
| S5–6 — Grupos | Especificada; pendiente implementación. |
| Web escritorio | Selector mínimo de S1 implementado; layout de escritorio pendiente. |

## Publicación de S1

El PR #23 (`feat/app-datos-reales`) es anterior a S1 y no incluye `/api/plan/finances`.
Publicar S1 requiere integrar `feat/finanzas-s1-duenio-finanzas` en la rama de producción.

1. Revisar que el destino de `DATABASE_URL` sea el correcto (`DATABASE_URL_UNPOOLED` tiene prioridad para migraciones si está definida) y aplicar las migraciones pendientes con `npx prisma migrate deploy` antes de habilitar el backend nuevo. La migración de S1 es `20261101195318_add_finance_owner_members`; agrega columnas y la tabla de miembros.
2. Verificar que Vercel publique el commit integrado. `GET /api/plan/finances` sin sesión debe devolver 401, no 404.
3. Con sesión, verificar listado de finanzas y creación de Hogar (201), selección, miembros y aislamiento de datos.
4. Revisar el backfill con `npx tsx prisma/backfill/finanzas-s1.ts --dry-run`. El script prioriza `.env.local` sobre `.env`: verificar el host que imprime.
5. Ejecutar el backfill sin `--dry-run` únicamente tras confirmación explícita, como exige la spec S1. Asigna el hogar existente a su dueño y crea finanzas personales para los demás usuarios: puede cambiar qué datos ve cada uno. Comparar los totales del dueño antes/después.
6. Completar E2E en iPhone y release EAS.

El merge y el deployment no confirman por sí solos la aplicación de migraciones ni la ejecución del backfill.

## Verificación del 4 de noviembre de 2026

- Se aplicó el backfill de producción con autorización explícita: un hogar recibió dueño, se crearon dos membresías y una Personal adicional, y se actualizó la finanza predeterminada de un usuario.
- Se compararon los registros de las finanzas existentes antes/después: meses, categorías, recurrencias, movimientos, presupuestos, compras, resúmenes, patrimonio, préstamos y tarjetas sin cambios. La segunda simulación no dejó tareas pendientes.
- Avelino tiene acceso a su Personal (Casa Figueira) y FigueHome. María tiene su Personal independiente.
- Se corrigió en mobile la recuperación de acceso previa al backfill: no seleccionar explícitamente un hogar que solo funciona como predeterminado; ignorar rechazos de pedidos de una selección anterior. Evita el ciclo de respuestas 200/403 y recargas de Home.
- Validación del fix: 142 tests de mobile y 47 de integración; TypeScript de mobile y lint de los archivos modificados pasan. El usuario confirmó la prueba en iPhone.
- Expo local apunta a producción; las variables de entorno permanecen fuera de Git.
