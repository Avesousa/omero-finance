// Integración: usa la base local de .env.local. Los tests unitarios no necesitan esto.
import { config } from "dotenv";

if (process.env.INTEGRATION === "1") {
  if (process.env.TEST_DATABASE_URL) {
    if (!/@(localhost|127\.0\.0\.1)(:|\/)/.test(process.env.TEST_DATABASE_URL)) throw new Error("TEST_DATABASE_URL debe ser local");
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  } else config({ path: ".env.local", override: true });
}
