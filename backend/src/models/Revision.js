import mongoose from "mongoose";

const { Schema } = mongoose;
const revisionSchema = new Schema({
    reel: { type: Schema.Types.ObjectId, ref: "Reel", required: true, index: true },
    version: { type: Schema.Types.ObjectId, ref: "ReelVersion" },
    source: { type: String, enum: ["internal", "client"], required: true },
    reason: { type: String, required: true, trim: true, maxlength: 3000 },
    status: { type: String, enum: ["open", "in_progress", "resolved"], default: "open" },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    resolvedAt: Date,
}, { timestamps: true });
export const Revision = mongoose.models.Revision || mongoose.model("Revision", revisionSchema);
