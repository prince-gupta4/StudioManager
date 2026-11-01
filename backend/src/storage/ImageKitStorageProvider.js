import ImageKit from "@imagekit/nodejs";
import { createReadStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";

export class ImageKitStorageProvider {
    constructor() {
        this.client = new ImageKit({ privateKey: env.IMAGEKIT_PRIVATE_KEY });
    }

    async upload(sourcePath, { folder, extension }) {
        const result = await this.client.files.upload({
            file: createReadStream(sourcePath),
            fileName: `${randomUUID()}.${extension}`,
            folder: `/reelmanager/${folder}`,
            useUniqueFileName: true,
        });
        return { key: result.filePath, providerFileId: result.fileId };
    }

    async get(key) {
        const { Readable } = await import("node:stream");
        const response = await fetch(this.generateSignedUrl(key));
        if (!response.ok || !response.body)
            throw new Error(`ImageKit file retrieval failed with status ${response.status}.`);
        return Readable.fromWeb(response.body);
    }

    async delete(_key, providerFileId) {
        if (!providerFileId)
            throw new Error("ImageKit file ID is missing.");
        await this.client.files.delete(providerFileId);
    }

    async exists(_key, providerFileId) {
        if (!providerFileId)
            return false;
        try {
            await this.client.files.get(providerFileId);
            return true;
        } catch (error) {
            if (error?.status === 404)
                return false;
            throw error;
        }
    }

    async getMetadata(_key, providerFileId) {
        const details = await this.client.files.get(providerFileId);
        return { sizeBytes: details.size, modifiedAt: details.updatedAt };
    }

    generateSignedUrl(key) {
        return this.client.helper.buildSrc({
            urlEndpoint: env.IMAGEKIT_URL_ENDPOINT,
            src: key,
            signed: true,
            expiresIn: 300,
        });
    }

    generateAccessUrl(asset) {
        return this.generateSignedUrl(asset.key);
    }
}
