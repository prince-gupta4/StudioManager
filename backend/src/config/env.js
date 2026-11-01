import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const rootEnvPath = fileURLToPath(new URL("../../../.env", import.meta.url));
const backendEnvPath = fileURLToPath(new URL("../../.env", import.meta.url));
const envPath = existsSync(rootEnvPath) ? rootEnvPath : backendEnvPath;
dotenv.config({ path: envPath });

const schema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    API_PORT: z.coerce.number().int().positive().default(4000),
    FRONTEND_URL: z.string().url().default("http://localhost:3000"),
    MONGODB_URI: z.string().min(1),
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
    COOKIE_SECURE: z.enum(["0", "1"]).default("0"),
    STORAGE_LOCAL: z.enum(["0", "1"]).default("1"),
    STORAGE_PROVIDER: z.enum(["local", "imagekit"]).default("local"),
    LOCAL_STORAGE_PATH: z.string().default("./storage"),
    UPLOAD_MAX_BYTES: z.coerce.number().int().min(1024).max(5_000_000_000).default(536870912),
    IMAGEKIT_PUBLIC_KEY: z.string().optional(),
    IMAGEKIT_PRIVATE_KEY: z.string().optional(),
    IMAGEKIT_URL_ENDPOINT: z.preprocess(
        (value) => value === "" ? undefined : value,
        z.string().url().optional(),
    ),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(
        `Invalid environment configuration: ${details}. Copy .env.example to .env in the project root, then set MONGODB_URI and a SESSION_SECRET of at least 32 characters.`,
    );
}
if (parsed.data.STORAGE_LOCAL === "1" && parsed.data.STORAGE_PROVIDER !== "local") {
    throw new Error("STORAGE_LOCAL=1 requires STORAGE_PROVIDER=local.");
}
if (parsed.data.STORAGE_LOCAL === "0") {
    if (parsed.data.STORAGE_PROVIDER !== "imagekit") {
        throw new Error("STORAGE_LOCAL=0 requires STORAGE_PROVIDER=imagekit.");
    }
    if (!parsed.data.IMAGEKIT_PUBLIC_KEY || !parsed.data.IMAGEKIT_PRIVATE_KEY || !parsed.data.IMAGEKIT_URL_ENDPOINT) {
        throw new Error("ImageKit storage requires IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT.");
    }
}
export const env = {
    ...parsed.data,
    cookieSecure: parsed.data.COOKIE_SECURE === "1" || parsed.data.NODE_ENV === "production",
};
