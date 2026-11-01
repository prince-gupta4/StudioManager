import mongoose from "mongoose";

const { Schema } = mongoose;
const publishingRecordSchema = new Schema({
    reel: { type: Schema.Types.ObjectId, ref: "Reel", required: true, index: true },
    platform: { type: String, trim: true, maxlength: 100 },
    accountName: { type: String, trim: true, maxlength: 160 },
    scheduledAt: Date,
    publishedAt: Date,
    externalUrl: { type: String, trim: true, maxlength: 1000 },
    notes: { type: String, maxlength: 3000 },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
export const PublishingRecord = mongoose.models.PublishingRecord || mongoose.model("PublishingRecord", publishingRecordSchema);
