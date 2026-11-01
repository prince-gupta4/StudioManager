import pino from "pino";
import { env } from "./env.js";
export const logger = pino({
    level: env.NODE_ENV === "development" ? "debug" : "info",
    redact: ["req.headers.cookie", "req.headers.authorization", "*.password", "*.token"],
});
