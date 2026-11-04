import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFiles: ["<rootDir>/jest.env.ts"],
  // Las pruebas de integración (base local real) solo corren con INTEGRATION=1: npm run test:int
  testPathIgnorePatterns: process.env.INTEGRATION === "1" ? [] : ["\\.int\\.test\\.ts$"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["<rootDir>/src/**/*.test.ts?(x)", "<rootDir>/src/**/*.test.tsx"],
};

export default createJestConfig(config);
