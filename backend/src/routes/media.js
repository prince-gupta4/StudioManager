import { Router } from "express";
import multer from "multer";
import { fileTypeFromFile } from "file-type";
import { mkdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import { env } from "../config/env.js";
import { authenticate, requirePermission } from "../middlewares/authenticate.js";
import { Client } from "../models/Client.js";
import { MediaAsset } from "../models/MediaAsset.js";
import { Project } from "../models/Project.js";
import { Reel } from "../models/Reel.js";
import { storage } from "../storage/index.js";
import { HttpError } from "../utils/http-error.js";
import { logger } from "../config/logger.js";

export const mediaRouter = Router();
mediaRouter.use(authenticate);
const temporaryDirectory = path.join(tmpdir(), "reelmanager-uploads");
const allowedTypes = new Map([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
    ["image/gif", "gif"],
    ["video/mp4", "mp4"],
    ["video/quicktime", "mov"],
    ["video/webm", "webm"],
    ["video/x-matroska", "mkv"],
    ["application/pdf", "pdf"],
]);
const upload = multer({
    storage: multer.diskStorage({
        destination: async (_req, _file, callback) => {
            try {
                await mkdir(temporaryDirectory, { recursive: true });
                callback(null, temporaryDirectory);
            } catch (error) { callback(error, temporaryDirectory); }
        },
        filename: (_req, _file, callback) => callback(null, `${crypto.randomUUID()}.upload`),
    }),
    limits: { fileSize: env.UPLOAD_MAX_BYTES, files: 1 },
    fileFilter: (_req, file, callback) => {
        if (!allowedTypes.has(file.mimetype)) {
            callback(new HttpError(415, "This file type is not supported."));
            return;
        }
        callback(null, true);
    },
});
const uploadMetadata = z.object({
    client: z.string().refine(mongoose.isValidObjectId),
    project: z.string().refine(mongoose.isValidObjectId).optional(),
    reel: z.string().refine(mongoose.isValidObjectId).optional(),
    category: z.enum(["raw_footage", "final_video", "draft", "thumbnail", "image", "document", "contract", "invoice", "brand_asset", "attachment"]),
});

function isAuthorized(req, permission) {
    return req.user.permissions.includes(permission);
}

mediaRouter.get("/", requirePermission("media:read"), async (req, res, next) => {
    try {
        const filter = { archivedAt: null };
        if (typeof req.query.client === "string" && mongoose.isValidObjectId(req.query.client))
            filter.client = req.query.client;
        if (typeof req.query.reel === "string" && mongoose.isValidObjectId(req.query.reel))
            filter.reel = req.query.reel;
        if (typeof req.query.category === "string")
            filter.category = req.query.category;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 24));
        const [items, total] = await Promise.all([
            MediaAsset.find(filter).populate("client", "name").populate("reel", "title reelId").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            MediaAsset.countDocuments(filter),
        ]);
        res.json({
            items: items.map((item) => {
                const { key: _key, providerFileId: _providerFileId, ...safeItem } = item;
                return { ...safeItem, accessUrl: storage.generateAccessUrl(item) };
            }),
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        });
    } catch (error) { next(error); }
});

mediaRouter.post("/", (req, res, next) => {
    if (!isAuthorized(req, "media:write")) {
        next(new HttpError(403, "You do not have permission to upload media."));
        return;
    }
    upload.single("file")(req, res, (error) => {
        if (error) {
            next(error);
            return;
        }
        next();
    });
}, async (req, res, next) => {
    const file = req.file;
    if (!file) {
        next(new HttpError(400, "Choose a file to upload."));
        return;
    }
    let stored;
    try {
        const metadata = uploadMetadata.parse(req.body);
        const client = await Client.findOne({ _id: metadata.client, archivedAt: null });
        if (!client)
            throw new HttpError(404, "Client not found.");
        if (metadata.reel && !await Reel.exists({ _id: metadata.reel, client: metadata.client }))
            throw new HttpError(404, "Reel not found for this client.");
        if (metadata.project && !await Project.exists({ _id: metadata.project, client: metadata.client }))
            throw new HttpError(404, "Project not found for this client.");
        const detectedType = await fileTypeFromFile(file.path);
        if (!detectedType || detectedType.mime !== file.mimetype || !allowedTypes.has(detectedType.mime)) {
            throw new HttpError(415, "File content does not match an allowed file type.");
        }
        const safeOriginalName = path.basename(file.originalname).replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 255);
        stored = await storage.upload(file.path, {
            folder: `clients/${metadata.client}/${metadata.category}`,
            extension: allowedTypes.get(detectedType.mime),
        });
        const asset = await MediaAsset.create({
            client: metadata.client,
            project: metadata.project,
            reel: metadata.reel,
            category: metadata.category,
            provider: env.STORAGE_LOCAL === "1" ? "local" : "imagekit",
            key: stored.key,
            providerFileId: stored.providerFileId,
            originalName: safeOriginalName,
            mimeType: detectedType.mime,
            sizeBytes: file.size,
            createdBy: req.user.id,
        });
        const { key: _key, providerFileId: _providerFileId, ...safeAsset } = asset.toObject();
        res.status(201).json({ item: { ...safeAsset, accessUrl: storage.generateAccessUrl(asset) } });
    } catch (error) {
        if (stored) {
            try { await storage.delete(stored.key, stored.providerFileId); }
            catch (cleanupError) {
                logger.error({ err: cleanupError, assetKey: stored.key }, "Failed to clean up uploaded file after database error");
                next(new AggregateError([error, cleanupError], "Media upload failed and provider cleanup also failed."));
                return;
            }
        }
        next(error);
    } finally {
        await unlink(file.path).catch((error) => {
            if (error?.code !== "ENOENT")
                logger.error({ err: error, tempPath: file.path }, "Failed to remove temporary upload file");
        });
    }
});

mediaRouter.get("/:id/content", requirePermission("media:read"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid media ID.");
        const asset = await MediaAsset.findOne({ _id: req.params.id, archivedAt: null }).lean();
        if (!asset)
            throw new HttpError(404, "Media not found.");
        if (!await storage.exists(asset.key, asset.providerFileId))
            throw new HttpError(404, "Stored media is unavailable.");
        if (asset.provider === "imagekit") {
            res.redirect(302, storage.generateAccessUrl(asset));
            return;
        }
        res.setHeader("Content-Type", asset.mimeType);
        res.setHeader("Content-Length", asset.sizeBytes);
        res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(asset.originalName)}`);
        res.setHeader("Cache-Control", "private, no-store");
        await pipeline(await storage.get(asset.key), res);
    } catch (error) {
        if (res.headersSent) {
            res.destroy(error);
            return;
        }
        next(error);
    }
});

mediaRouter.get("/:id/metadata", requirePermission("media:read"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid media ID.");
        const asset = await MediaAsset.findOne({ _id: req.params.id, archivedAt: null }).lean();
        if (!asset)
            throw new HttpError(404, "Media not found.");
        const details = await storage.getMetadata(asset.key, asset.providerFileId);
        const { key: _key, providerFileId: _providerFileId, ...safeAsset } = asset;
        res.json({ item: { ...safeAsset, ...details } });
    } catch (error) { next(error); }
});

mediaRouter.delete("/:id", requirePermission("media:write"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid media ID.");
        const asset = await MediaAsset.findOne({ _id: req.params.id, archivedAt: null });
        if (!asset)
            throw new HttpError(404, "Media not found.");
        await storage.delete(asset.key, asset.providerFileId);
        asset.archivedAt = new Date();
        await asset.save();
        res.status(204).end();
    } catch (error) { next(error); }
});
