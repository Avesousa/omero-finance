// Metro necesita ver la lógica pura de la web (src/lib/plan/core.ts) que vive fuera de mobile/.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "../src/lib/plan")];

module.exports = config;
