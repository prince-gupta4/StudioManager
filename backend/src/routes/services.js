import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { authenticate, requirePermission } from "../middlewares/authenticate.js";
import { Service } from "../models/Service.js";
import { HttpError } from "../utils/http-error.js";
export const servicesRouter = Router();
servicesRouter.use(authenticate);
const serviceSchema = z.object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(1000).optional(),
    category: z.string().trim().max(100).optional(),
    unit: z.string().trim().min(1).max(40),
    defaultRatePaise: z.number().int().min(0).max(100_000_000_000),
    billingType: z.enum(["one_time", "recurring", "per_unit", "custom"]),
    taxRateBasisPoints: z.number().int().min(0).max(10000).default(0),
    active: z.boolean().default(true),
});
servicesRouter.get("/", requirePermission("services:read"), async (_req, res, next) => {
    try {
        const items = await Service.find().sort({ name: 1 }).lean();
        res.json({ items });
    }
    catch (error) {
        next(error);
    }
});
servicesRouter.post("/", requirePermission("services:write"), async (req, res, next) => {
    try {
        const input = serviceSchema.parse(req.body);
        const item = await Service.create({ ...input, createdBy: req.user.id });
        res.status(201).json({ item });
    }
    catch (error) {
        next(error);
    }
});
servicesRouter.patch("/:id", requirePermission("services:write"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid service ID.");
        const input = serviceSchema.partial().parse(req.body);
        const item = await Service.findByIdAndUpdate(req.params.id, { $set: input }, { new: true, runValidators: true }).lean();
        if (!item)
            throw new HttpError(404, "Service not found.");
        res.json({ item });
    }
    catch (error) {
        next(error);
    }
});
