"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.secureGet = secureGet;
exports.secureSet = secureSet;
exports.prefGet = prefGet;
exports.prefSet = prefSet;
const react_native_1 = require("react-native");
const async_storage_1 = __importDefault(require("@react-native-async-storage/async-storage"));
const SecureStore = __importStar(require("expo-secure-store"));
// Token de sesión: Keychain/Keystore en el teléfono. En web (solo para probar) SecureStore no
// existe: se guarda en localStorage vía AsyncStorage, y si tampoco está, en memoria.
const memory = new Map();
const isWeb = react_native_1.Platform.OS === "web";
async function secureGet(key) {
    try {
        if (!isWeb)
            return await SecureStore.getItemAsync(key);
        return (await async_storage_1.default.getItem(key)) ?? memory.get(key) ?? null;
    }
    catch {
        return memory.get(key) ?? null;
    }
}
async function secureSet(key, value) {
    if (value == null)
        memory.delete(key);
    else
        memory.set(key, value);
    try {
        if (!isWeb) {
            if (value == null)
                await SecureStore.deleteItemAsync(key);
            else
                await SecureStore.setItemAsync(key, value);
        }
        else if (value == null)
            await async_storage_1.default.removeItem(key);
        else
            await async_storage_1.default.setItem(key, value);
    }
    catch {
        /* queda en memoria */
    }
}
/** Preferencias chicas (qué número ver, detalle abierto…). */
async function prefGet(key) {
    try {
        return await async_storage_1.default.getItem(key);
    }
    catch {
        return null;
    }
}
async function prefSet(key, value) {
    try {
        await async_storage_1.default.setItem(key, value);
    }
    catch {
        /* no pasa nada */
    }
}
