import { env } from "../config/env.js";
import { LocalStorageProvider } from "./LocalStorageProvider.js";
import { ImageKitStorageProvider } from "./ImageKitStorageProvider.js";

export const storage = env.STORAGE_LOCAL === "1"
    ? new LocalStorageProvider()
    : new ImageKitStorageProvider();
