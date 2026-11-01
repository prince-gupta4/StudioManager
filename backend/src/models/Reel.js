import mongoose from "mongoose";

const { Schema } = mongoose;
const reelSchema = new Schema({
    reelId: { type: String, required: true, unique: true },
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: "Project" },
    contract: { type: Schema.Types.ObjectId, ref: "Contract" },
    billingCycle: { type: Schema.Types.ObjectId, ref: "BillingCycle" },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, maxlength: 3000 },
    category: { type: String, trim: true, maxlength: 100 },
    referenceUrl: { type: String, trim: true, maxlength: 1000 },
    script: { type: String, maxlength: 10000 },
    priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal" },
    footageSource: { type: String, enum: ["agency", "client", "hybrid"], required: true },
    shootingRequired: { type: Boolean, default: false },
    editingRequired: { type: Boolean, default: true },
    marketingRequired: { type: Boolean, default: false },
    assignedShooter: { type: Schema.Types.ObjectId, ref: "User" },
    assignedEditor: { type: Schema.Types.ObjectId, ref: "User" },
    assignedMarketer: { type: Schema.Types.ObjectId, ref: "User" },
    plannedShootDate: Date,
    editingDeadline: Date,
    finalDeadline: Date,
    status: { type: String, enum: ["idea", "planned", "ready_for_shooting", "shooting_scheduled", "shooting_in_progress", "footage_received", "editing_queue", "editing_in_progress", "internal_review", "client_review", "revision_requested", "revision_in_progress", "approved", "ready_for_delivery", "delivered", "marketing_preparation", "scheduled", "published", "completed", "on_hold", "cancelled"], default: "idea", index: true },
    billableService: { type: Schema.Types.ObjectId, ref: "Service" },
    revisionCount: { type: Number, min: 0, default: 0 },
    approvedVersion: { type: Schema.Types.ObjectId, ref: "ReelVersion" },
    notes: { type: String, maxlength: 5000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
reelSchema.index({ client: 1, status: 1, finalDeadline: 1 });
reelSchema.index({ project: 1, createdAt: -1 });
export const Reel = mongoose.models.Reel || mongoose.model("Reel", reelSchema);
