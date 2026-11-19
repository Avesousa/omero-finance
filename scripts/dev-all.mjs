#!/usr/bin/env node
/**
 * Levanta todo el entorno local con un solo comando y lo baja entero con Ctrl+C:
 *   1. Postgres local (datos en ~/.omero-pg, puerto 5434) — solo lo detiene si lo arrancó este script.
 *   2. Migraciones + datos de prueba (seed idempotente) sobre esa base local.
 *   3. Backend (next dev, puerto 3001).
 *   4. Expo (mobile) apuntando al backend por la IP de la Mac en la red.
 *
 * Todo corre con el entorno de `.env.dev` (imponiéndose a .env y .env.local): nunca toca la base real.
 *
 *   npm run dev:all
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { networkInterfaces, homedir } from "node:os";
import { createConnection } from "node:net";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const PG_PORT = 5434;
const API_PORT = 3001;
const PG_DATA = process.env.OMERO_PG_DATA ?? join(homedir(), ".omero-pg");
const PG_BIN = process.env.OMERO_PG_BIN ?? "/usr/local/opt/postgresql@15/bin";

function loadDevEnv() {
  const file = join(ROOT, ".env.dev");
  if (!existsSync(file)) fail("Falta .env.dev (entorno local). Restauralo desde git.");
  const env = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*?)"?\s*$/);
    if (m) env[m[1]] = m[2];
  }
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(env.DATABASE_URL ?? "")) fail(".env.dev debe apuntar a una base local (DATABASE_URL).");
  return { ...env, OMERO_DEV_ENV: "1" };
}

const log = (m) => console.log(`\x1b[36m[dev]\x1b[0m ${m}`);
const fail = (m) => { console.error(`\x1b[31m[dev]\x1b[0m ${m}`); process.exit(1); };

const isOpen = (port) => new Promise((resolve) => {
  const s = createConnection({ host: "127.0.0.1", port });
  s.once("connect", () => { s.destroy(); resolve(true); });
  s.once("error", () => resolve(false));
});

const lanIp = () => {
  for (const list of Object.values(networkInterfaces()))
    for (const i of list ?? []) if (i.family === "IPv4" && !i.internal && /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(i.address)) return i.address;
  return null;
};

let startedPg = false;
let back = null;
let expo = null;
let closing = false;

function stopPg() {
  if (!startedPg) return;
  log("Deteniendo Postgres…");
  spawnSync(join(PG_BIN, "pg_ctl"), ["-D", PG_DATA, "-m", "fast", "stop"], { stdio: "ignore" });
  startedPg = false;
}

function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  log("Cerrando todo…");
  for (const c of [expo, back]) {
    if (!c || c.exitCode !== null) continue;
    try { process.kill(-c.pid, "SIGTERM"); } catch { try { c.kill("SIGTERM"); } catch {} }
  }
  setTimeout(() => {
    for (const c of [expo, back]) if (c && c.exitCode === null) { try { process.kill(-c.pid, "SIGKILL"); } catch {} }
    stopPg();
    process.exit(code);
  }, 1500);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("SIGHUP", () => shutdown(0));
process.on("exit", () => { if (startedPg) stopPg(); });

async function main() {
  const devEnv = { ...process.env, ...loadDevEnv() };
  // 1) Postgres
  if (await isOpen(PG_PORT)) log(`Postgres ya está corriendo en :${PG_PORT} (no lo toco al salir).`);
  else {
    if (!existsSync(join(PG_BIN, "pg_ctl"))) fail(`No encuentro pg_ctl en ${PG_BIN}. Definí OMERO_PG_BIN.`);
    if (!existsSync(PG_DATA)) fail(`No encuentro los datos de Postgres en ${PG_DATA}. Definí OMERO_PG_DATA.`);
    log(`Arrancando Postgres (${PG_DATA}, :${PG_PORT})…`);
    const r = spawnSync(join(PG_BIN, "pg_ctl"), ["-D", PG_DATA, "-o", `-p ${PG_PORT}`, "-l", join(PG_DATA, "log.txt"), "-w", "start"], { stdio: "inherit" });
    if (r.status !== 0) fail("Postgres no arrancó (mirá ~/.omero-pg/log.txt).");
    startedPg = true;
  }

  // La base propia del proyecto (el mismo Postgres puede alojar otras): se crea si falta.
  const dbName = decodeURIComponent(new URL(devEnv.DATABASE_URL).pathname.slice(1));
  const psql = (sql) => spawnSync(join(PG_BIN, "psql"), ["-h", "127.0.0.1", "-p", String(PG_PORT), "-U", new URL(devEnv.DATABASE_URL).username, "-d", "postgres", "-Atc", sql], { encoding: "utf8" });
  if (!psql(`select 1 from pg_database where datname='${dbName.replace(/'/g, "''")}'`).stdout.trim()) {
    log(`Creando la base "${dbName}"…`);
    const c = psql(`create database "${dbName.replace(/"/g, '""')}"`);
    if (c.status !== 0) fail(`No pude crear la base: ${c.stderr}`);
  }

  // Migraciones y datos de prueba sobre la base local (el entorno viene de .env.dev, nunca de .env.local).
  log("Aplicando migraciones pendientes…");
  const m = spawnSync("npx", ["prisma", "migrate", "deploy"], { cwd: ROOT, stdio: "ignore", env: devEnv });
  if (m.status !== 0) fail("No pude aplicar las migraciones (corré `npm run dev:all` con la base arriba o `npx prisma migrate deploy`).");
  log("Cargando datos de prueba (avelino@omero.local / maria@omero.local, clave omero123)…");
  const sd = spawnSync("npx", ["tsx", "scripts/seed-local.ts"], { cwd: ROOT, stdio: "ignore", env: devEnv });
  if (sd.status !== 0) log("⚠ El seed falló (`npx tsx scripts/seed-local.ts` muestra el error); sigo igual.");

  // 3) Backend
  if (await isOpen(API_PORT)) fail(`El puerto ${API_PORT} ya está en uso. Cerrá lo que lo ocupa y reintentá.`);
  log(`Arrancando backend en :${API_PORT}…`);
  back = spawn("npx", ["next", "dev", "--webpack", "-p", String(API_PORT)], { cwd: ROOT, detached: true, stdio: ["ignore", "pipe", "pipe"], env: devEnv });
  const pipe = (stream, out) => stream.on("data", (d) => String(d).split("\n").filter(Boolean).forEach((l) => out.write(`\x1b[2m[back]\x1b[0m ${l}\n`)));
  pipe(back.stdout, process.stdout); pipe(back.stderr, process.stderr);
  back.on("exit", (code) => { if (!closing) { console.error(`[dev] El backend se cerró (código ${code}).`); shutdown(1); } });

  for (let i = 0; i < 60 && !(await isOpen(API_PORT)); i++) await new Promise((r) => setTimeout(r, 1000));
  if (!(await isOpen(API_PORT))) fail("El backend no respondió en 60 s.");

  // 4) Expo
  const ip = lanIp();
  if (!ip) log("No encontré IP de red local: Expo usará lo que diga mobile/.env.local.");
  const apiUrl = ip ? `http://${ip}:${API_PORT}` : undefined;
  log(`Arrancando Expo${apiUrl ? ` → API ${apiUrl}` : ""}…`);
  expo = spawn("npx", ["expo", "start", "-c"], {
    cwd: join(ROOT, "mobile"),
    stdio: "inherit",
    env: { ...process.env, EXPO_PUBLIC_DATA_SOURCE: "api", EXPO_PUBLIC_VOICE_SOURCE: "mock", ...(apiUrl ? { EXPO_PUBLIC_API_URL: apiUrl } : {}) },
  });
  expo.on("exit", () => { if (!closing) shutdown(0); });
}

main().catch((e) => { console.error(e); shutdown(1); });
