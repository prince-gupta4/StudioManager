import mongoose from "mongoose";

const { Schema } = mongoose;
const serviceSchema = new Schema({
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, maxlength: 1000 },
    category: { type: String, trim: true },
    unit: { type: String, required: true, trim: true },
    defaultRatePaise: { type: Number, required: true, min: 0 },
    billingType: { type: String, enum: ["one_time", "recurring", "per_unit", "custom"], default: "per_unit" },
    taxRateBasisPoints: { type: Number, min: 0, max: 10000, default: 0 },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
serviceSchema.index({ name: 1 }, { unique: true });
export const Service = mongoose.models.Service || mongoose.model("Service", serviceSchema);
