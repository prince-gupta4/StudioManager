import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/http-error.js";
export async function authenticate(req, _res, next) {
    try {
        const token = req.cookies?.session;
        if (typeof token !== "string")
            throw new HttpError(401, "Authentication required.");
        const claims = jwt.verify(token, env.SESSION_SECRET);
        const user = await User.findById(claims.sub).populate("role", "name permissions");
        if (!user || !user.active) {
            throw new HttpError(401, "Session is no longer valid.");
        }
        const role = user.role;
        req.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: role.name,
            permissions: role.permissions,
        };
        next();
    }
    catch (error) {
        next(error instanceof jwt.JsonWebTokenError ? new HttpError(401, "Session is invalid or expired.") : error);
    }
}
export function requirePermission(permission) {
    return (req, _res, next) => {
        if (!req.user?.permissions.includes(permission)) {
            next(new HttpError(403, "You do not have permission to perform this action."));
            return;
        }
        next();
    };
}
