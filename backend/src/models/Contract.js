import mongoose from "mongoose";

const { Schema } = mongoose;
const lineSchema = new Schema({
    service: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    description: { type: String, trim: true, maxlength: 500 },
    quantity: { type: Number, min: 0, required: true },
    unit: { type: String, required: true, trim: true, maxlength: 40 },
    ratePaise: { type: Number, min: 0, required: true },
    includedQuantity: { type: Number, min: 0, default: 0 },
    additionalUnitRatePaise: { type: Number, min: 0, default: 0 },
    billingFrequency: { type: String, enum: ["one_time", "monthly", "quarterly", "annually", "custom"], default: "monthly" },
    taxRateBasisPoints: { type: Number, min: 0, max: 10000, default: 0 },
    recurring: { type: Boolean, default: true },
    carryForwardUnused: { type: Boolean, default: false },
    billOnCompletion: { type: Boolean, default: false },
}, { _id: true });

const contractSchema = new Schema({
    number: { type: String, required: true, unique: true, trim: true },
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    billingFrequency: { type: String, enum: ["monthly", "quarterly", "annually", "custom", "one_time"], default: "monthly" },
    billingDay: { type: Number, min: 1, max: 28, default: 1 },
    paymentDueDays: { type: Number, min: 0, max: 365, default: 15 },
    currency: { type: String, default: "INR", enum: ["INR"] },
    status: { type: String, enum: ["draft", "active", "paused", "cancelled", "expired"], default: "draft", index: true },
    terms: { type: String, maxlength: 10000 },
    notes: { type: String, maxlength: 5000 },
    items: { type: [lineSchema], validate: (items) => items.length > 0 },
    renewalEnabled: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

contractSchema.index({ client: 1, status: 1 });
export const Contract = mongoose.models.Contract || mongoose.model("Contract", contractSchema);
