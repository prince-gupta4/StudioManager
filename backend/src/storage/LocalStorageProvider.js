import { createReadStream } from "node:fs";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

export class LocalStorageProvider {
    constructor() {
        this.root = path.resolve(env.LOCAL_STORAGE_PATH);
    }

    resolve(key) {
        const absolute = path.resolve(this.root, key);
        if (!absolute.startsWith(`${this.root}${path.sep}`))
            throw new HttpError(400, "Invalid stored file key.");
        return absolute;
    }

    async upload(sourcePath, { folder, extension }) {
        const key = path.join(folder, `${randomUUID()}.${extension}`);
        const destination = this.resolve(key);
        await mkdir(path.dirname(destination), { recursive: true });
        await rename(sourcePath, destination);
        return { key };
    }

    get(key) {
        return createReadStream(this.resolve(key));
    }

    async delete(key) {
        try {
            await unlink(this.resolve(key));
        } catch (error) {
            if (error?.code !== "ENOENT")
                throw error;
        }
    }

    async exists(key) {
        try {
            await stat(this.resolve(key));
            return true;
        } catch (error) {
            if (error?.code === "ENOENT")
                return false;
            throw error;
        }
    }

    async getMetadata(key) {
        const details = await stat(this.resolve(key));
        return { sizeBytes: details.size, modifiedAt: details.mtime };
    }

    generateAccessUrl(asset) {
        return `/api/media/${asset._id}/content`;
    }
}
