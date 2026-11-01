import mongoose from "mongoose";

const { Schema } = mongoose;
const projectSchema = new Schema({
    name: { type: String, required: true, trim: true, maxlength: 180 },
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    contract: { type: Schema.Types.ObjectId, ref: "Contract" },
    description: { type: String, maxlength: 5000 },
    status: { type: String, enum: ["planning", "active", "on_hold", "completed", "cancelled"], default: "planning", index: true },
    startDate: Date,
    deadline: Date,
    archivedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
projectSchema.index({ client: 1, status: 1 });
export const Project = mongoose.models.Project || mongoose.model("Project", projectSchema);
