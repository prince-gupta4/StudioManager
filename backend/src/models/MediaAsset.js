import mongoose from "mongoose";

const { Schema } = mongoose;
const mediaAssetSchema = new Schema({
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: "Project" },
    reel: { type: Schema.Types.ObjectId, ref: "Reel", index: true },
    category: { type: String, enum: ["raw_footage", "final_video", "draft", "thumbnail", "image", "document", "contract", "invoice", "brand_asset", "attachment"], required: true },
    provider: { type: String, enum: ["local", "imagekit"], required: true },
    key: { type: String, required: true },
    providerFileId: String,
    originalName: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, min: 1, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    archivedAt: { type: Date, default: null },
}, { timestamps: true });

mediaAssetSchema.index({ client: 1, category: 1, createdAt: -1 });
export const MediaAsset = mongoose.models.MediaAsset || mongoose.model("MediaAsset", mediaAssetSchema);
