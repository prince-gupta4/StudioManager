import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { authenticate, requirePermission } from "../middlewares/authenticate.js";
import { Client } from "../models/Client.js";
import { Contract } from "../models/Contract.js";
import { Project } from "../models/Project.js";
import { Reel } from "../models/Reel.js";
import { ProductionTask } from "../models/ProductionTask.js";
import { MediaAsset } from "../models/MediaAsset.js";
import { ReelVersion } from "../models/ReelVersion.js";
import { Revision } from "../models/Revision.js";
import { Approval } from "../models/Approval.js";
import { PublishingRecord } from "../models/PublishingRecord.js";
import { User } from "../models/User.js";
import { Service } from "../models/Service.js";
import { HttpError } from "../utils/http-error.js";

export const productionRouter = Router();
productionRouter.use(authenticate);
const objectId = z.string().refine(mongoose.isValidObjectId, "Invalid record ID.");
const projectInput = z.object({
    name: z.string().trim().min(1).max(180),
    client: objectId,
    contract: objectId.optional().or(z.literal("")),
    description: z.string().max(5000).optional(),
    status: z.enum(["planning", "active", "on_hold", "completed", "cancelled"]).default("planning"),
    startDate: z.coerce.date().optional(),
    deadline: z.coerce.date().optional(),
});
const reelInput = z.object({
    client: objectId,
    project: objectId.optional().or(z.literal("")),
    contract: objectId.optional().or(z.literal("")),
    title: z.string().trim().min(1).max(180),
    description: z.string().max(3000).optional(),
    category: z.string().max(100).optional(),
    referenceUrl: z.string().url().max(1000).optional().or(z.literal("")),
    script: z.string().max(10000).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    footageSource: z.enum(["agency", "client", "hybrid"]),
    shootingRequired: z.boolean().default(false),
    editingRequired: z.boolean().default(true),
    marketingRequired: z.boolean().default(false),
    assignedShooter: objectId.optional().or(z.literal("")),
    assignedEditor: objectId.optional().or(z.literal("")),
    assignedMarketer: objectId.optional().or(z.literal("")),
    plannedShootDate: z.coerce.date().optional(),
    editingDeadline: z.coerce.date().optional(),
    finalDeadline: z.coerce.date().optional(),
    status: z.enum(["idea", "planned", "ready_for_shooting", "shooting_scheduled", "shooting_in_progress", "footage_received", "editing_queue", "editing_in_progress", "internal_review", "client_review", "revision_requested", "revision_in_progress", "approved", "ready_for_delivery", "delivered", "marketing_preparation", "scheduled", "published", "completed", "on_hold", "cancelled"]).default("idea"),
    billableService: objectId.optional().or(z.literal("")),
    notes: z.string().max(5000).optional(),
});
const taskInput = z.object({
    kind: z.enum(["shooting", "editing", "marketing", "other"]),
    title: z.string().trim().min(1).max(180),
    assignedTo: objectId.optional().or(z.literal("")),
    startDate: z.coerce.date().optional(),
    deadline: z.coerce.date().optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    status: z.enum(["todo", "in_progress", "blocked", "completed", "cancelled"]).default("todo"),
    instructions: z.string().max(3000).optional(),
    estimatedMinutes: z.number().int().min(0).optional(),
    actualMinutes: z.number().int().min(0).optional(),
});
function pageParams(query) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    return { page, limit };
}
async function ensureClient(clientId) {
    if (!await Client.exists({ _id: clientId, archivedAt: null }))
        throw new HttpError(404, "Client not found.");
}
async function validateOptionalReferences(input, model, key, label) {
    if (input[key] && !await model.exists({ _id: input[key] }))
        throw new HttpError(404, `${label} not found.`);
}
async function ensureReferenceBelongs(model, id, clientId, label) {
    if (id && !await model.exists({ _id: id, client: clientId }))
        throw new HttpError(400, `${label} must belong to the selected client.`);
}

productionRouter.get("/team/assignees", requirePermission("production:read"), async (_req, res, next) => {
    try {
        const items = await User.find({ active: true }).select("name role").populate("role", "name").sort({ name: 1 }).lean();
        res.json({ items: items.map((item) => ({ id: item._id, name: item.name, role: item.role?.name })) });
    } catch (error) { next(error); }
});

productionRouter.get("/contract-options", requirePermission("projects:read"), async (_req, res, next) => {
    try {
        const items = await Contract.find({ status: { $in: ["draft", "active"] } }).select("number title client status").populate("client", "name").sort({ createdAt: -1 }).lean();
        res.json({ items });
    } catch (error) { next(error); }
});

productionRouter.get("/projects", requirePermission("projects:read"), async (req, res, next) => {
    try {
        const { page, limit } = pageParams(req.query);
        const filter = { archivedAt: null };
        if (typeof req.query.client === "string" && mongoose.isValidObjectId(req.query.client))
            filter.client = req.query.client;
        if (typeof req.query.status === "string")
            filter.status = req.query.status;
        const [items, total] = await Promise.all([
            Project.find(filter).populate("client", "name").populate("contract", "number title").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            Project.countDocuments(filter),
        ]);
        res.json({ items, page, limit, total, pages: Math.ceil(total / limit) });
    } catch (error) { next(error); }
});

productionRouter.post("/projects", requirePermission("projects:write"), async (req, res, next) => {
    try {
        const input = projectInput.parse(req.body);
        await ensureClient(input.client);
        await validateOptionalReferences(input, Contract, "contract", "Contract");
        await ensureReferenceBelongs(Contract, input.contract, input.client, "Contract");
        const item = await Project.create({ ...input, contract: input.contract || undefined, createdBy: req.user.id });
        res.status(201).json({ item });
    } catch (error) { next(error); }
});

productionRouter.patch("/projects/:id", requirePermission("projects:write"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid project ID.");
        const input = projectInput.partial().parse(req.body);
        const existing = await Project.findOne({ _id: req.params.id, archivedAt: null }).select("client contract").lean();
        if (!existing)
            throw new HttpError(404, "Project not found.");
        if (input.client)
            await ensureClient(input.client);
        await validateOptionalReferences(input, Contract, "contract", "Contract");
        await ensureReferenceBelongs(Contract, input.contract === undefined ? existing.contract : input.contract, input.client || existing.client, "Contract");
        const update = { ...input };
        if (input.contract === "")
            update.contract = null;
        const item = await Project.findOneAndUpdate({ _id: req.params.id, archivedAt: null }, { $set: update }, { new: true, runValidators: true }).populate("client", "name").lean();
        if (!item)
            throw new HttpError(404, "Project not found.");
        res.json({ item });
    } catch (error) { next(error); }
});

productionRouter.get("/reels", requirePermission("production:read"), async (req, res, next) => {
    try {
        const { page, limit } = pageParams(req.query);
        const filter = {};
        for (const field of ["client", "project", "status"]) {
            if (typeof req.query[field] === "string")
                filter[field] = req.query[field];
        }
        const [items, total] = await Promise.all([
            Reel.find(filter).populate("client", "name").populate("project", "name").populate("assignedShooter assignedEditor assignedMarketer", "name").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            Reel.countDocuments(filter),
        ]);
        res.json({ items, page, limit, total, pages: Math.ceil(total / limit) });
    } catch (error) { next(error); }
});

productionRouter.post("/reels", requirePermission("production:write"), async (req, res, next) => {
    try {
        const input = reelInput.parse(req.body);
        await ensureClient(input.client);
        await validateOptionalReferences(input, Project, "project", "Project");
        await validateOptionalReferences(input, Contract, "contract", "Contract");
        await validateOptionalReferences(input, Service, "billableService", "Service");
        await ensureReferenceBelongs(Project, input.project, input.client, "Project");
        await ensureReferenceBelongs(Contract, input.contract, input.client, "Contract");
        for (const [field, label] of [["assignedShooter", "Shooter"], ["assignedEditor", "Editor"], ["assignedMarketer", "Marketer"]]) {
            if (input[field] && !await User.exists({ _id: input[field], active: true }))
                throw new HttpError(404, `${label} not found.`);
        }
        if (input.footageSource === "client" && input.shootingRequired)
            throw new HttpError(400, "Client-provided footage does not require agency shooting.");
        const item = await Reel.create({
            ...input,
            project: input.project || undefined,
            contract: input.contract || undefined,
            assignedShooter: input.assignedShooter || undefined,
            assignedEditor: input.assignedEditor || undefined,
            assignedMarketer: input.assignedMarketer || undefined,
            billableService: input.billableService || undefined,
            reelId: `R-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
            createdBy: req.user.id,
        });
        res.status(201).json({ item });
    } catch (error) { next(error); }
});

productionRouter.patch("/reels/:id", requirePermission("production:write"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid reel ID.");
        const input = reelInput.partial().parse(req.body);
        const existing = await Reel.findById(req.params.id).select("client project contract footageSource shootingRequired").lean();
        if (!existing)
            throw new HttpError(404, "Reel not found.");
        const clientId = input.client || existing.client;
        if (input.client)
            await ensureClient(input.client);
        await validateOptionalReferences(input, Project, "project", "Project");
        await validateOptionalReferences(input, Contract, "contract", "Contract");
        await validateOptionalReferences(input, Service, "billableService", "Service");
        await ensureReferenceBelongs(Project, input.project === undefined ? existing.project : input.project, clientId, "Project");
        await ensureReferenceBelongs(Contract, input.contract === undefined ? existing.contract : input.contract, clientId, "Contract");
        for (const [field, label] of [["assignedShooter", "Shooter"], ["assignedEditor", "Editor"], ["assignedMarketer", "Marketer"]]) {
            if (input[field] && !await User.exists({ _id: input[field], active: true }))
                throw new HttpError(404, `${label} not found.`);
        }
        if ((input.footageSource || existing.footageSource) === "client" && (input.shootingRequired ?? existing.shootingRequired))
            throw new HttpError(400, "Client-provided footage does not require agency shooting.");
        const update = { ...input };
        for (const field of ["project", "contract", "assignedShooter", "assignedEditor", "assignedMarketer", "billableService"]) {
            if (update[field] === "")
                update[field] = null;
        }
        const item = await Reel.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true }).populate("client", "name").lean();
        if (!item)
            throw new HttpError(404, "Reel not found.");
        res.json({ item });
    } catch (error) { next(error); }
});

productionRouter.get("/reels/:id/tasks", requirePermission("production:read"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid reel ID.");
        const items = await ProductionTask.find({ reel: req.params.id }).populate("assignedTo", "name email").sort({ deadline: 1 }).lean();
        res.json({ items });
    } catch (error) { next(error); }
});

productionRouter.post("/reels/:id/tasks", requirePermission("production:write"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid reel ID.");
        if (!await Reel.exists({ _id: req.params.id }))
            throw new HttpError(404, "Reel not found.");
        const input = taskInput.parse(req.body);
        if (input.assignedTo && !await User.exists({ _id: input.assignedTo, active: true }))
            throw new HttpError(404, "Team member not found.");
        const item = await ProductionTask.create({
            ...input,
            assignedTo: input.assignedTo || undefined,
            completedAt: input.status === "completed" ? new Date() : undefined,
            reel: req.params.id,
            createdBy: req.user.id,
        });
        res.status(201).json({ item });
    } catch (error) { next(error); }
});

productionRouter.patch("/tasks/:id", requirePermission("production:write"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid task ID.");
        const input = taskInput.partial().parse(req.body);
        if (input.assignedTo && !await User.exists({ _id: input.assignedTo, active: true }))
            throw new HttpError(404, "Team member not found.");
        const update = { ...input, assignedTo: input.assignedTo || undefined };
        if (input.status === "completed")
            update.completedAt = new Date();
        const item = await ProductionTask.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true }).populate("assignedTo", "name email").lean();
        if (!item)
            throw new HttpError(404, "Production task not found.");
        res.json({ item });
    } catch (error) { next(error); }
});

productionRouter.get("/reels/:id/versions", requirePermission("production:read"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid reel ID.");
        const items = await ReelVersion.find({ reel: req.params.id }).populate("mediaAsset", "originalName mimeType sizeBytes category").populate("uploadedBy", "name").sort({ version: -1 }).lean();
        res.json({ items });
    } catch (error) { next(error); }
});

productionRouter.post("/reels/:id/versions", requirePermission("production:write"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid reel ID.");
        const { mediaAsset, notes } = z.object({
            mediaAsset: objectId,
            notes: z.string().max(3000).optional(),
        }).parse(req.body);
        const reel = await Reel.findById(req.params.id);
        if (!reel)
            throw new HttpError(404, "Reel not found.");
        const asset = await MediaAsset.findOne({
            _id: mediaAsset,
            reel: reel._id,
            client: reel.client,
            category: { $in: ["draft", "final_video"] },
            archivedAt: null,
        });
        if (!asset)
            throw new HttpError(400, "Upload a draft or final video linked to this reel first.");
        const version = (await ReelVersion.countDocuments({ reel: reel._id })) + 1;
        const item = await ReelVersion.create({ reel: reel._id, mediaAsset: asset._id, version, notes, uploadedBy: req.user.id });
        if (asset.category === "final_video")
            reel.status = "ready_for_delivery";
        else if (reel.status === "idea" || reel.status === "planned" || reel.status === "editing_queue")
            reel.status = "internal_review";
        await reel.save();
        res.status(201).json({ item });
    } catch (error) { next(error); }
});

productionRouter.get("/reels/:id/revisions", requirePermission("production:read"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid reel ID.");
        const items = await Revision.find({ reel: req.params.id }).populate("version", "version").populate("requestedBy", "name").sort({ createdAt: -1 }).lean();
        res.json({ items });
    } catch (error) { next(error); }
});

productionRouter.post("/reels/:id/revisions", requirePermission("production:write"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid reel ID.");
        const input = z.object({
            version: objectId.optional(),
            source: z.enum(["internal", "client"]),
            reason: z.string().trim().min(1).max(3000),
        }).parse(req.body);
        const reel = await Reel.findById(req.params.id);
        if (!reel)
            throw new HttpError(404, "Reel not found.");
        if (input.version && !await ReelVersion.exists({ _id: input.version, reel: reel._id }))
            throw new HttpError(404, "Reel version not found.");
        const revision = await Revision.create({ ...input, reel: reel._id, requestedBy: req.user.id });
        await Reel.updateOne({ _id: reel._id }, { $set: { status: "revision_requested" }, $inc: { revisionCount: 1 } });
        res.status(201).json({ item: revision });
    } catch (error) { next(error); }
});

productionRouter.get("/reels/:id/approvals", requirePermission("production:read"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid reel ID.");
        const items = await Approval.find({ reel: req.params.id }).populate("version", "version").populate("recordedBy", "name").sort({ createdAt: -1 }).lean();
        res.json({ items });
    } catch (error) { next(error); }
});

productionRouter.post("/reels/:id/approvals", requirePermission("production:write"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid reel ID.");
        const input = z.object({
            version: objectId,
            decision: z.enum(["approved", "rejected"]),
            feedback: z.string().max(3000).optional(),
        }).parse(req.body);
        const reel = await Reel.findById(req.params.id);
        if (!reel)
            throw new HttpError(404, "Reel not found.");
        if (!await ReelVersion.exists({ _id: input.version, reel: reel._id }))
            throw new HttpError(404, "Reel version not found.");
        const approval = await Approval.create({
            ...input,
            reel: reel._id,
            approvedAt: input.decision === "approved" ? new Date() : undefined,
            recordedBy: req.user.id,
        });
        if (input.decision === "approved") {
            await Reel.updateOne({ _id: reel._id }, { $set: { approvedVersion: input.version, status: "approved" } });
        } else {
            await Reel.updateOne({ _id: reel._id }, { $set: { status: "revision_requested" }, $inc: { revisionCount: 1 } });
            await Revision.create({
                reel: reel._id,
                version: input.version,
                source: "internal",
                reason: input.feedback || "Approval rejected.",
                requestedBy: req.user.id,
            });
        }
        res.status(201).json({ item: approval });
    } catch (error) { next(error); }
});

productionRouter.get("/reels/:id/publishing", requirePermission("production:read"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid reel ID.");
        const items = await PublishingRecord.find({ reel: req.params.id }).populate("recordedBy", "name").sort({ scheduledAt: -1, publishedAt: -1 }).lean();
        res.json({ items });
    } catch (error) { next(error); }
});

productionRouter.post("/reels/:id/publishing", requirePermission("production:write"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid reel ID.");
        const input = z.object({
            platform: z.string().trim().max(100).optional(),
            accountName: z.string().trim().max(160).optional(),
            scheduledAt: z.coerce.date().optional(),
            publishedAt: z.coerce.date().optional(),
            externalUrl: z.string().url().max(1000).optional(),
            notes: z.string().max(3000).optional(),
        }).parse(req.body);
        const reel = await Reel.findById(req.params.id);
        if (!reel)
            throw new HttpError(404, "Reel not found.");
        const item = await PublishingRecord.create({ ...input, reel: reel._id, recordedBy: req.user.id });
        if (input.publishedAt)
            await Reel.updateOne({ _id: reel._id }, { $set: { status: "published" } });
        else if (input.scheduledAt)
            await Reel.updateOne({ _id: reel._id }, { $set: { status: "scheduled" } });
        res.status(201).json({ item });
    } catch (error) { next(error); }
});
