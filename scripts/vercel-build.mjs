import { spawnSync } from "node:child_process";

function run(script) {
  const result = spawnSync("npm", ["run", script], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Un preview puede compartir la conexión de producción: no modificar su schema.
// VERCEL_ENV distingue producción de previews, a diferencia de NODE_ENV.
if (process.env.VERCEL_ENV === "production") {
  run("db:migrate");
} else {
  console.log("Sin migración automática: migrar la base de prueba por separado si corresponde.");
}

run("build");
