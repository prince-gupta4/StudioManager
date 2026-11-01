import mongoose from "mongoose";

const { Schema } = mongoose;
const reelVersionSchema = new Schema({
    reel: { type: Schema.Types.ObjectId, ref: "Reel", required: true, index: true },
    mediaAsset: { type: Schema.Types.ObjectId, ref: "MediaAsset", required: true },
    version: { type: Number, min: 1, required: true },
    notes: { type: String, maxlength: 3000 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
reelVersionSchema.index({ reel: 1, version: 1 }, { unique: true });
export const ReelVersion = mongoose.models.ReelVersion || mongoose.model("ReelVersion", reelVersionSchema);
