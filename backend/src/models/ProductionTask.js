import mongoose from "mongoose";

const { Schema } = mongoose;
const taskSchema = new Schema({
    reel: { type: Schema.Types.ObjectId, ref: "Reel", required: true, index: true },
    kind: { type: String, enum: ["shooting", "editing", "marketing", "other"], required: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", index: true },
    startDate: Date,
    deadline: { type: Date, index: true },
    priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal" },
    status: { type: String, enum: ["todo", "in_progress", "blocked", "completed", "cancelled"], default: "todo", index: true },
    instructions: { type: String, maxlength: 3000 },
    estimatedMinutes: { type: Number, min: 0 },
    actualMinutes: { type: Number, min: 0 },
    completedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
taskSchema.index({ assignedTo: 1, status: 1, deadline: 1 });
export const ProductionTask = mongoose.models.ProductionTask || mongoose.model("ProductionTask", taskSchema);
