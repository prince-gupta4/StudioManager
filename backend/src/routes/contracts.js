import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { authenticate, requirePermission } from "../middlewares/authenticate.js";
import { BillingCycle } from "../models/BillingCycle.js";
import { Client } from "../models/Client.js";
import { Contract } from "../models/Contract.js";
import { Service } from "../models/Service.js";
import { HttpError } from "../utils/http-error.js";
import { newDocumentNumber } from "../utils/financials.js";

export const contractsRouter = Router();
contractsRouter.use(authenticate);
const itemSchema = z.object({
    service: z.string().refine(mongoose.isValidObjectId, "Invalid service ID."),
    description: z.string().max(500).optional(),
    quantity: z.number().min(0),
    unit: z.string().trim().min(1).max(40),
    ratePaise: z.number().int().min(0).max(100_000_000_000),
    includedQuantity: z.number().min(0).default(0),
    additionalUnitRatePaise: z.number().int().min(0).default(0),
    billingFrequency: z.enum(["one_time", "monthly", "quarterly", "annually", "custom"]).default("monthly"),
    taxRateBasisPoints: z.number().int().min(0).max(10000).default(0),
    recurring: z.boolean().default(true),
    carryForwardUnused: z.boolean().default(false),
    billOnCompletion: z.boolean().default(false),
});
const contractSchema = z.object({
    client: z.string().refine(mongoose.isValidObjectId, "Invalid client ID."),
    title: z.string().trim().min(1).max(180),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    billingFrequency: z.enum(["monthly", "quarterly", "annually", "custom", "one_time"]).default("monthly"),
    billingDay: z.number().int().min(1).max(28).default(1),
    paymentDueDays: z.number().int().min(0).max(365).default(15),
    status: z.enum(["draft", "active", "paused", "cancelled", "expired"]).default("draft"),
    terms: z.string().max(10000).optional(),
    notes: z.string().max(5000).optional(),
    items: z.array(itemSchema).min(1).max(100),
    renewalEnabled: z.boolean().default(false),
});

contractsRouter.get("/", requirePermission("contracts:read"), async (req, res, next) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
        const filter = {};
        if (typeof req.query.status === "string")
            filter.status = req.query.status;
        if (typeof req.query.client === "string" && mongoose.isValidObjectId(req.query.client))
            filter.client = req.query.client;
        const [items, total] = await Promise.all([
            Contract.find(filter).populate("client", "name").populate("items.service", "name").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            Contract.countDocuments(filter),
        ]);
        res.json({ items, page, limit, total, pages: Math.ceil(total / limit) });
    } catch (error) { next(error); }
});

contractsRouter.post("/", requirePermission("contracts:write"), async (req, res, next) => {
    try {
        const input = contractSchema.parse(req.body);
        if (input.endDate && input.endDate < input.startDate)
            throw new HttpError(400, "Contract end date cannot be before its start date.");
        const client = await Client.findOne({ _id: input.client, archivedAt: null });
        if (!client)
            throw new HttpError(404, "Client not found.");
        const serviceIds = [...new Set(input.items.map((item) => item.service))];
        const serviceCount = await Service.countDocuments({ _id: { $in: serviceIds } });
        if (serviceCount !== serviceIds.length)
            throw new HttpError(400, "One or more selected services do not exist.");
        const itemSnapshot = input.items.map((item) => ({
            ...item,
            service: new mongoose.Types.ObjectId(item.service),
        }));
        const contract = await Contract.create({
            ...input,
            number: newDocumentNumber("CON"),
            items: itemSnapshot,
            createdBy: req.user.id,
        });
        res.status(201).json({ item: contract });
    } catch (error) { next(error); }
});

contractsRouter.patch("/:id/status", requirePermission("contracts:write"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid contract ID.");
        const { status } = z.object({ status: z.enum(["draft", "active", "paused", "cancelled", "expired"]) }).parse(req.body);
        const contract = await Contract.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true, runValidators: true });
        if (!contract)
            throw new HttpError(404, "Contract not found.");
        res.json({ item: contract });
    } catch (error) { next(error); }
});

contractsRouter.post("/:id/billing-cycles", requirePermission("contracts:write"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid contract ID.");
        const dates = z.object({ startDate: z.coerce.date(), endDate: z.coerce.date() }).parse(req.body);
        if (dates.endDate <= dates.startDate)
            throw new HttpError(400, "Billing cycle end date must be after its start date.");
        const contract = await Contract.findById(req.params.id);
        if (!contract)
            throw new HttpError(404, "Contract not found.");
        if (contract.status !== "active")
            throw new HttpError(409, "Billing cycles can only be opened for active contracts.");
        if (dates.startDate < contract.startDate || (contract.endDate && dates.endDate > contract.endDate))
            throw new HttpError(400, "Billing cycle dates must fall within the contract term.");
        const cycle = await BillingCycle.create({
            contract: contract._id,
            client: contract.client,
            ...dates,
            items: contract.items.map((item) => ({
                contractItemId: item._id,
                service: item.service,
                description: item.description,
                unit: item.unit,
                ratePaise: item.ratePaise,
                entitlementQuantity: item.quantity,
                includedQuantity: item.includedQuantity,
                additionalUnitRatePaise: item.additionalUnitRatePaise,
                taxRateBasisPoints: item.taxRateBasisPoints,
            })),
            createdBy: req.user.id,
        });
        res.status(201).json({ item: cycle });
    } catch (error) { next(error); }
});

contractsRouter.patch("/billing-cycles/:cycleId/quantities", requirePermission("contracts:write"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.cycleId))
            throw new HttpError(400, "Invalid billing cycle ID.");
        const { items } = z.object({
            items: z.array(z.object({
                contractItemId: z.string().refine(mongoose.isValidObjectId),
                assignedQuantity: z.number().min(0),
                completedQuantity: z.number().min(0),
                approvedQuantity: z.number().min(0),
                deliveredQuantity: z.number().min(0),
                billableQuantity: z.number().min(0),
                additionalQuantity: z.number().min(0),
            })).min(1).max(100),
        }).parse(req.body);
        const cycle = await BillingCycle.findOne({ _id: req.params.cycleId, status: "open" });
        if (!cycle)
            throw new HttpError(404, "Open billing cycle not found.");
        for (const update of items) {
            const target = cycle.items.find((item) => item.contractItemId.toString() === update.contractItemId);
            if (!target)
                throw new HttpError(400, "The billing cycle does not contain one of the specified contract items.");
            if (update.approvedQuantity > update.completedQuantity || update.deliveredQuantity > update.approvedQuantity ||
                update.billableQuantity > update.completedQuantity) {
                throw new HttpError(400, "Approved, delivered, and billable quantities cannot exceed their workflow quantities.");
            }
            Object.assign(target, update);
        }
        await cycle.save();
        res.json({ item: cycle });
    } catch (error) { next(error); }
});

contractsRouter.get("/billing-cycles", requirePermission("contracts:read"), async (req, res, next) => {
    try {
        const filter = {};
        if (typeof req.query.contract === "string" && mongoose.isValidObjectId(req.query.contract))
            filter.contract = req.query.contract;
        const items = await BillingCycle.find(filter).populate("client", "name").populate("contract", "number title").populate("items.service", "name").sort({ startDate: -1 }).limit(200).lean();
        res.json({ items });
    } catch (error) { next(error); }
});
