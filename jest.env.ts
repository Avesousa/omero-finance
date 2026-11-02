// Integración: usa la base local de .env.local. Los tests unitarios no necesitan esto.
import { config } from "dotenv";

if (process.env.INTEGRATION === "1") config({ path: ".env.local", override: true });
