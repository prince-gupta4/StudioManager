import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";
const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
export function requireSameOrigin(req, _res, next) {
    if (safeMethods.has(req.method)) {
        next();
        return;
    }
    const origin = req.get("origin");
    if (!origin || origin !== env.FRONTEND_URL) {
        next(new HttpError(403, "Request origin is not allowed."));
        return;
    }
    next();
}
