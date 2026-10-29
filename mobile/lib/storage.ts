import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

// Token de sesión: Keychain/Keystore en el teléfono. En web (solo para probar) SecureStore no
// existe: se guarda en localStorage vía AsyncStorage, y si tampoco está, en memoria.
const memory = new Map<string, string>();
const isWeb = Platform.OS === "web";

export async function secureGet(key: string): Promise<string | null> {
  try {
    if (!isWeb) return await SecureStore.getItemAsync(key);
    return (await AsyncStorage.getItem(key)) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

export async function secureSet(key: string, value: string | null): Promise<void> {
  if (value == null) memory.delete(key);
  else memory.set(key, value);
  try {
    if (!isWeb) {
      if (value == null) await SecureStore.deleteItemAsync(key);
      else await SecureStore.setItemAsync(key, value);
    } else if (value == null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, value);
  } catch {
    /* queda en memoria */
  }
}

/** Preferencias chicas (qué número ver, detalle abierto…). */
export async function prefGet(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function prefSet(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    /* no pasa nada */
  }
}
