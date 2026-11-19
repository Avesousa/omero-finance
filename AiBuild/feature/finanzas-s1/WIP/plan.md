# Plan S1

Fuente: `docs/specs/refactor-finanzas/01-semana-1-duenio-y-finanzas.md` §5 (bloques A–E, paralelismo marcado). Estado y dependencias en `meta.json` (`needs_db` = requiere el branch de Neon).

- T000 [A] Verificar docs de Next (prioridad entries/move, cookies/headers) (dep: —)
- T001 [A] Prisma: enums, columnas Household, FinanceMember, relaciones; SQL de migración; generate (dep: —) · DB
- T002 [A] Backfill prisma/backfill/finanzas-s1.ts con --dry-run (dep: T001) · DB
- T003 [B] src/lib/plan/access.ts + tests (dep: T001)
- T004 [B] src/lib/plan/finances.ts + tests (dep: T001)
- T005 [B] withSession/withUser con acción obligatoria; loadPlan devuelve finance (dep: T003, T004)
- T006 [C] Migrar rutas 1-7 (dep: T005)
- T007 [C] Migrar rutas 8-14 (dep: T005)
- T008 [C] Migrar rutas 16-24 (dep: T005)
- T009 [C] Migrar rutas 25-28 (dep: T005)
- T010 [C] Endpoints finances, members, finances/active (dep: T005)
- T011 [C] entries/move (dep: T005)
- T012 [C] Verificación de exhaustividad + tsc (dep: T006, T007, T008, T009, T010, T011)
- T012b [C] Suite de integración completa (R8) (dep: T012) · DB
- T013 [D] Mobile: api.ts header + ActiveFinanceProvider (dep: T010)
- T014 [D] Mobile: tema/borde por finanza (dep: T013)
- T015 [D] Mobile: FinanceSwitcher + FinanceSheet (dep: T013)
- T016 [D] Mobile: Crear Hogar y miembros (dep: T013)
- T017 [D] Mobile: Mover a finanza (dep: T013, T011)
- T018 [D] Mobile: modo Lector + i18n + tipos (dep: T013)
- T019 [D] Web mínimo (cookie, selector, borde) (dep: T010)
- T020 [E] Backfill en producción (requiere confirmación explícita) (dep: T012b) · DB
- T021 [E] E2E manual en iPhone + release EAS (dep: T013, T019, T020)
