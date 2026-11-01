import mongoose from "mongoose";

const { Schema } = mongoose;
const approvalSchema = new Schema({
    reel: { type: Schema.Types.ObjectId, ref: "Reel", required: true, index: true },
    version: { type: Schema.Types.ObjectId, ref: "ReelVersion", required: true },
    decision: { type: String, enum: ["approved", "rejected"], required: true },
    feedback: { type: String, maxlength: 3000 },
    approvedAt: Date,
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
export const Approval = mongoose.models.Approval || mongoose.model("Approval", approvalSchema);
