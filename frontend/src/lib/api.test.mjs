import assert from "node:assert/strict";
import { test } from "node:test";
import { api, clearApiCache } from "./api.js";

function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

test("reuses successful GET responses across equivalent query strings", async () => {
    clearApiCache();
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
        calls += 1;
        return jsonResponse({ items: ["cached"] });
    };

    try {
        const first = await api("/clients?page=1&limit=10");
        const second = await api("/clients?limit=10&page=1");

        assert.deepEqual(first, { items: ["cached"] });
        assert.deepEqual(second, first);
        assert.equal(calls, 1);
        assert.notEqual(first, second);
    } finally {
        globalThis.fetch = originalFetch;
        clearApiCache();
    }
});

test("deduplicates concurrent GET requests", async () => {
    clearApiCache();
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return jsonResponse({ user: { name: "Owner" } });
    };

    try {
        const [first, second] = await Promise.all([api("/auth/me"), api("/auth/me")]);

        assert.deepEqual(first, second);
        assert.equal(calls, 1);
    } finally {
        globalThis.fetch = originalFetch;
        clearApiCache();
    }
});

test("successful mutations invalidate cached GET responses", async () => {
    clearApiCache();
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async (_url, init) => {
        calls += 1;
        return init.method === "POST"
            ? jsonResponse({ item: { id: "created" } }, 201)
            : jsonResponse({ count: calls });
    };

    try {
        await api("/clients");
        await api("/clients", { method: "POST", body: JSON.stringify({ name: "Client" }) });
        const updated = await api("/clients");

        assert.equal(calls, 3);
        assert.deepEqual(updated, { count: 3 });
    } finally {
        globalThis.fetch = originalFetch;
        clearApiCache();
    }
});

test("supports a forced GET refresh without replacing cache behavior", async () => {
    clearApiCache();
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => jsonResponse({ count: ++calls });

    try {
        assert.deepEqual(await api("/dashboard/summary"), { count: 1 });
        assert.deepEqual(await api("/dashboard/summary", { skipCache: true }), { count: 2 });
        assert.deepEqual(await api("/dashboard/summary"), { count: 2 });
        assert.equal(calls, 2);
    } finally {
        globalThis.fetch = originalFetch;
        clearApiCache();
    }
});
