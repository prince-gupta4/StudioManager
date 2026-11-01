import { Router } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { z } from "zod";
import { authenticate, requirePermission } from "../middlewares/authenticate.js";
import { Role, permissions } from "../models/Role.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/http-error.js";

export const teamRouter = Router();
teamRouter.use(authenticate);

teamRouter.get("/roles", requirePermission("team:read"), async (_req, res, next) => {
    try {
        const items = await Role.find().select("name permissions isSystem").sort({ name: 1 }).lean();
        res.json({ items, permissions });
    } catch (error) { next(error); }
});

teamRouter.post("/roles", requirePermission("team:write"), async (req, res, next) => {
    try {
        const input = z.object({
            name: z.string().trim().min(2).max(80),
            permissions: z.array(z.enum(permissions)).max(permissions.length),
        }).parse(req.body);
        const item = await Role.create({ ...input, isSystem: false });
        res.status(201).json({ item });
    } catch (error) { next(error); }
});

teamRouter.patch("/roles/:id", requirePermission("team:write"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid role ID.");
        const input = z.object({
            name: z.string().trim().min(2).max(80).optional(),
            permissions: z.array(z.enum(permissions)).max(permissions.length).optional(),
        }).parse(req.body);
        const role = await Role.findOneAndUpdate(
            { _id: req.params.id, isSystem: false },
            { $set: input },
            { new: true, runValidators: true },
        ).lean();
        if (!role)
            throw new HttpError(404, "Custom role not found.");
        res.json({ item: role });
    } catch (error) { next(error); }
});

teamRouter.get("/", requirePermission("team:read"), async (_req, res, next) => {
    try {
        const page = Math.max(1, Number(_req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(_req.query.limit) || 50));
        const filter = {};
        if (_req.query.active === "true")
            filter.active = true;
        if (_req.query.active === "false")
            filter.active = false;
        const [items, total] = await Promise.all([
            User.find(filter).select("name email role active lastLoginAt createdAt").populate("role", "name").sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
            User.countDocuments(filter),
        ]);
        res.json({ items, page, limit, total });
    } catch (error) { next(error); }
});

teamRouter.post("/", requirePermission("team:write"), async (req, res, next) => {
    try {
        const input = z.object({
            name: z.string().trim().min(1).max(120),
            email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
            password: z.string().min(12).max(200),
            role: z.string().refine(mongoose.isValidObjectId),
        }).parse(req.body);
        const role = await Role.findById(input.role).select("name");
        if (!role)
            throw new HttpError(404, "Role not found.");
        if (role.name === "Owner" && req.user.role !== "Owner")
            throw new HttpError(403, "Only an owner can assign the Owner role.");
        const item = await User.create({
            name: input.name,
            email: input.email,
            passwordHash: await bcrypt.hash(input.password, 12),
            role: input.role,
        });
        res.status(201).json({ item: { id: item.id, name: item.name, email: item.email, role: input.role, active: item.active } });
    } catch (error) { next(error); }
});

teamRouter.patch("/:id/status", requirePermission("team:write"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid team member ID.");
        const { active } = z.object({ active: z.boolean() }).parse(req.body);
        const member = await User.findById(req.params.id).populate("role", "name");
        if (!member)
            throw new HttpError(404, "Team member not found.");
        if (!active && member.id === req.user.id)
            throw new HttpError(409, "You cannot deactivate your own account.");
        if (!active && member.role?.name === "Owner") {
            const owners = await User.find({ active: true }).populate("role", "name").select("_id role").lean();
            const ownerCount = owners.filter((user) => user.role?.name === "Owner").length;
            if (ownerCount <= 1)
                throw new HttpError(409, "The last active owner account cannot be deactivated.");
        }
        member.active = active;
        await member.save();
        res.json({ item: { id: member.id, name: member.name, email: member.email, active: member.active } });
    } catch (error) { next(error); }
});
