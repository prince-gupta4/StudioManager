import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { authenticate, requirePermission } from "../middlewares/authenticate.js";
import { Client } from "../models/Client.js";
import { HttpError } from "../utils/http-error.js";
export const clientsRouter = Router();
clientsRouter.use(authenticate);
const contactSchema = z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(254).optional().or(z.literal("")),
    phone: z.string().trim().max(40).optional(),
    designation: z.string().trim().max(120).optional(),
    isPrimary: z.boolean().optional(),
});
const clientSchema = z.object({
    name: z.string().trim().min(1).max(160),
    type: z.enum(["business", "individual"]).optional(),
    status: z.enum(["lead", "active", "inactive"]).optional(),
    contacts: z.array(contactSchema).max(50).optional(),
    email: z.string().trim().email().max(254).optional().or(z.literal("")),
    phone: z.string().trim().max(40).optional(),
    website: z.string().trim().max(300).optional(),
    billingAddress: z.string().trim().max(1000).optional(),
    gstin: z.string().trim().max(20).optional(),
    pan: z.string().trim().max(20).optional(),
    source: z.string().trim().max(120).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
    notes: z.string().max(5000).optional(),
});
function parsePage(value, fallback) {
    const parsed = Number(value ?? fallback);
    if (!Number.isInteger(parsed) || parsed < 1)
        throw new HttpError(400, "Invalid pagination parameter.");
    return parsed;
}
clientsRouter.get("/", requirePermission("clients:read"), async (req, res, next) => {
    try {
        const page = parsePage(req.query.page, 1);
        const limit = Math.min(parsePage(req.query.limit, 20), 100);
        const status = typeof req.query.status === "string" ? req.query.status : undefined;
        const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
        const filter = { archivedAt: null };
        if (status && ["lead", "active", "inactive"].includes(status))
            filter.status = status;
        if (search) {
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            filter.$or = [
                { name: { $regex: escaped, $options: "i" } },
                { email: { $regex: escaped, $options: "i" } },
                { phone: { $regex: escaped, $options: "i" } },
            ];
        }
        const [items, total] = await Promise.all([
            Client.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            Client.countDocuments(filter),
        ]);
        res.json({ items, page, limit, total, pages: Math.ceil(total / limit) });
    }
    catch (error) {
        next(error);
    }
});
clientsRouter.post("/", requirePermission("clients:write"), async (req, res, next) => {
    try {
        const input = clientSchema.parse(req.body);
        const client = await Client.create({ ...input, createdBy: req.user.id });
        res.status(201).json({ item: client });
    }
    catch (error) {
        next(error);
    }
});
clientsRouter.get("/:id", requirePermission("clients:read"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid client ID.");
        const client = await Client.findOne({ _id: req.params.id, archivedAt: null }).lean();
        if (!client)
            throw new HttpError(404, "Client not found.");
        res.json({ item: client });
    }
    catch (error) {
        next(error);
    }
});
clientsRouter.patch("/:id", requirePermission("clients:write"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid client ID.");
        const input = clientSchema.partial().parse(req.body);
        const client = await Client.findOneAndUpdate({ _id: req.params.id, archivedAt: null }, { $set: input }, { new: true, runValidators: true }).lean();
        if (!client)
            throw new HttpError(404, "Client not found.");
        res.json({ item: client });
    }
    catch (error) {
        next(error);
    }
});
clientsRouter.delete("/:id", requirePermission("clients:write"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid client ID.");
        const client = await Client.findOneAndUpdate({ _id: req.params.id, archivedAt: null }, { $set: { archivedAt: new Date(), status: "archived" } }, { new: true });
        if (!client)
            throw new HttpError(404, "Client not found.");
        res.status(204).end();
    }
    catch (error) {
        next(error);
    }
});
