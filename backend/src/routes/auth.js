import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { authenticate } from "../middlewares/authenticate.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/http-error.js";
export const authRouter = Router();
const credentialsSchema = z.object({
    email: z.string().email().max(254).transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(200),
});
authRouter.post("/login", async (req, res, next) => {
    try {
        const credentials = credentialsSchema.parse(req.body);
        const user = await User.findOne({ email: credentials.email }).select("+passwordHash");
        const valid = user ? await bcrypt.compare(credentials.password, user.passwordHash) : false;
        if (!user || !valid || !user.active)
            throw new HttpError(401, "Email or password is incorrect.");
        await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
        const token = jwt.sign({}, env.SESSION_SECRET, { subject: user.id, expiresIn: "12h" });
        res.cookie("session", token, {
            httpOnly: true,
            secure: env.cookieSecure,
            sameSite: env.cookieSameSite,
            path: "/",
            maxAge: 12 * 60 * 60 * 1000,
        });
        res.json({ user: { id: user.id, name: user.name, email: user.email } });
    }
    catch (error) {
        next(error);
    }
});
authRouter.post("/logout", (_req, res) => {
    res.clearCookie("session", { httpOnly: true, secure: env.cookieSecure, sameSite: env.cookieSameSite, path: "/" });
    res.status(204).end();
});
authRouter.get("/me", authenticate, (req, res) => {
    res.json({ user: req.user });
});

authRouter.post("/change-password", authenticate, async (req, res, next) => {
    try {
        const input = z.object({
            currentPassword: z.string().min(1).max(200),
            newPassword: z.string().min(12).max(200),
        }).parse(req.body);
        const user = await User.findById(req.user.id).select("+passwordHash");
        if (!user || !await bcrypt.compare(input.currentPassword, user.passwordHash))
            throw new HttpError(400, "Current password is incorrect.");
        user.passwordHash = await bcrypt.hash(input.newPassword, 12);
        await user.save();
        res.status(204).end();
    } catch (error) { next(error); }
});
