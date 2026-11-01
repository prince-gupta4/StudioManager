import { app } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { seedDefaultRoles } from "./config/seed-default-roles.js";
import mongoose from "mongoose";
await connectDatabase();
await seedDefaultRoles();
const server = app.listen(env.API_PORT, () => {
    logger.info({ port: env.API_PORT }, "ReelManager API is listening");
});
async function shutdown(signal) {
    logger.info({ signal }, "Shutting down");
    server.close(async (error) => {
        if (error)
            logger.error({ err: error }, "HTTP server shutdown failed");
        await mongoose.disconnect();
        process.exit(error ? 1 : 0);
    });
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
