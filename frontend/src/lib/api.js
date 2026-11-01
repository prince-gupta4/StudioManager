const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const GET_CACHE_TTL_MS = 60_000;
const MAX_CACHED_GETS = 200;
const getCache = new Map();
const pendingGets = new Map();
let cacheVersion = 0;

function cacheKey(url) {
    const parsed = new URL(url);
    parsed.searchParams.sort();
    return `${parsed.pathname}${parsed.search}`;
}

function clonePayload(payload) {
    return payload === undefined ? undefined : structuredClone(payload);
}

function cacheGet(key, payload) {
    const now = Date.now();
    for (const [cachedKey, entry] of getCache) {
        if (entry.expiresAt <= now)
            getCache.delete(cachedKey);
    }
    while (getCache.size >= MAX_CACHED_GETS)
        getCache.delete(getCache.keys().next().value);
    getCache.set(key, { payload, expiresAt: now + GET_CACHE_TTL_MS });
}

export function clearApiCache() {
    cacheVersion += 1;
    getCache.clear();
    pendingGets.clear();
}

export async function api(path, init = {}) {
    const { skipCache = false, ...requestInit } = init;
    const method = (requestInit.method || "GET").toUpperCase();
    const url = `${apiBase}/api${path}`;
    const cacheable = method === "GET";
    const useCache = cacheable && !skipCache;
    const version = cacheVersion;
    const key = cacheable ? `${version}:${cacheKey(url)}` : null;

    if (useCache) {
        const cached = getCache.get(key);
        if (cached) {
            if (cached.expiresAt > Date.now())
                return clonePayload(cached.payload);
            getCache.delete(key);
        }
        const pending = pendingGets.get(key);
        if (pending)
            return clonePayload(await pending);
    }

    const isFormData = typeof FormData !== "undefined" && requestInit.body instanceof FormData;
    const request = async () => {
        const response = await fetch(url, {
            ...requestInit,
            credentials: "include",
            headers: {
                ...(requestInit.body && !isFormData ? { "Content-Type": "application/json" } : {}),
                ...requestInit.headers,
            },
        });
        if (response.status === 204) {
            if (method !== "GET")
                clearApiCache();
            return undefined;
        }
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (response.status === 401) {
                clearApiCache();
                if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login"))
                    window.location.assign("/login");
            }
            throw new Error(payload.error || `Request failed (${response.status}).`);
        }
        if (method !== "GET")
            clearApiCache();
        else if (key && version === cacheVersion)
            cacheGet(key, payload);
        return payload;
    };

    if (!key || skipCache)
        return request();

    const pending = request();
    pendingGets.set(key, pending);
    const clearPending = () => {
        if (pendingGets.get(key) === pending)
            pendingGets.delete(key);
    };
    pending.then(clearPending, clearPending);
    return clonePayload(await pending);
}

export async function downloadFile(path, filename) {
    const response = await fetch(`${apiBase}/api${path}`, { credentials: "include" });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401) {
            clearApiCache();
            if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login"))
                window.location.assign("/login");
        }
        throw new Error(payload.error || `Download failed (${response.status}).`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { apiBase };
