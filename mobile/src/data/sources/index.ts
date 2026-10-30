import type { DataSource } from "./DataSource";
import { apiSource } from "./api";
import { mockSource } from "./mock";

export type DataSourceKind = "mock" | "api";

/** `EXPO_PUBLIC_DATA_SOURCE=api` usa el backend; cualquier otra cosa (o nada) usa mock. */
export const DATA_SOURCE: DataSourceKind = process.env.EXPO_PUBLIC_DATA_SOURCE === "api" ? "api" : "mock";

export const dataSource: DataSource = DATA_SOURCE === "api" ? apiSource : mockSource;
export type { DataSource } from "./DataSource";
