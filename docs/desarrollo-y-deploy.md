# Backend, Expo y migraciones

## P2022 en login tras S1

El login consulta `User` incluyendo su `Household`. Se confirmó que la base de Neon no tenía `Household.kind`, `ownerUserId`, `color` ni la tabla `FinanceMember`: faltaba la migración `20261101195318_add_finance_owner_members`.

Generar el cliente Prisma no aplica migraciones. `vercel.json` establece `npm run build:vercel` como comando de build. En producción (`VERCEL_ENV=production`), ejecuta `npm run db:migrate` antes de compilar y detiene el build si la migración falla. Previews y builds locales no migran automáticamente; deben migrar su base de prueba por separado.

Configurar `DATABASE_URL` en Vercel para la base correspondiente al entorno. `DATABASE_URL_UNPOOLED` tiene prioridad para migraciones si está definida; ambas deben apuntar a la misma base. No hace falta cambiar una conexión correcta para resolver P2022: hace falta aplicar la migración.

Las migraciones aplicadas no se revierten si luego falla la compilación. Mantener compatibilidad con la versión publicada. El backfill de S1 no se ejecuta durante el build y sigue requiriendo la confirmación explícita indicada en su spec.

## Expo construido en local con backend de producción

En `mobile/.env.local`:

```env
EXPO_PUBLIC_API_URL=https://omero-finance.vercel.app
```

Este archivo tiene prioridad sobre `mobile/.env` y no se versiona. Recargar Expo por completo tras cambiar la URL. Construir la app en la Mac no requiere un backend local: los datos se consultan y guardan en el backend indicado por esta variable.

## Validación local del 4 de noviembre de 2026

- Migraciones aplicadas sobre una base temporal Postgres local, sin modificar Neon.
- 46 tests de integración pasan, incluidos creación de hogar y permisos por rol.
- Login, listado de finanzas y datos del mes responden HTTP 200 por Wi-Fi.
- Se comprobó un bundle iOS con la URL local durante esa prueba; luego se restauró la URL de producción por pedido del usuario.
- E2E manual en iPhone pendiente de confirmación. Producción sigue pendiente de migración hasta publicar este fix o aplicarla explícitamente.
