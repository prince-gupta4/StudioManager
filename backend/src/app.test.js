import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/reelmanager-test";
process.env.SESSION_SECRET ??= "a-test-session-secret-with-more-than-32-characters";
process.env.STORAGE_LOCAL ??= "1";
process.env.STORAGE_PROVIDER ??= "local";

const { app } = await import("./app.js");

test("trusts the single Render proxy hop for forwarded client IPs", () => {
    assert.equal(app.get("trust proxy"), 1);
});

test("allows same-site frontend pages to use API-hosted media", async () => {
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");

    try {
        const { port } = server.address();
        const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
            headers: { Origin: process.env.FRONTEND_URL || "http://localhost:3000" },
        });

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { status: "ok" });
        assert.equal(response.headers.get("cross-origin-resource-policy"), "same-site");
        assert.equal(response.headers.get("access-control-allow-origin"), process.env.FRONTEND_URL || "http://localhost:3000");
    } finally {
        server.close();
        await once(server, "close");
    }
});
