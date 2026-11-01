import mongoose from "mongoose";

const { Schema } = mongoose;
const snapshotItemSchema = new Schema({
    contractItemId: { type: Schema.Types.ObjectId, required: true },
    service: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    description: String,
    unit: String,
    ratePaise: { type: Number, min: 0, required: true },
    entitlementQuantity: { type: Number, min: 0, default: 0 },
    includedQuantity: { type: Number, min: 0, default: 0 },
    additionalUnitRatePaise: { type: Number, min: 0, default: 0 },
    taxRateBasisPoints: { type: Number, min: 0, max: 10000, default: 0 },
    assignedQuantity: { type: Number, min: 0, default: 0 },
    completedQuantity: { type: Number, min: 0, default: 0 },
    approvedQuantity: { type: Number, min: 0, default: 0 },
    deliveredQuantity: { type: Number, min: 0, default: 0 },
    billableQuantity: { type: Number, min: 0, default: 0 },
    additionalQuantity: { type: Number, min: 0, default: 0 },
}, { _id: false });

const billingCycleSchema = new Schema({
    contract: { type: Schema.Types.ObjectId, ref: "Contract", required: true },
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ["open", "invoiced", "closed"], default: "open" },
    items: { type: [snapshotItemSchema], default: [] },
    invoice: { type: Schema.Types.ObjectId, ref: "Invoice" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

billingCycleSchema.index({ contract: 1, startDate: 1, endDate: 1 }, { unique: true });
export const BillingCycle = mongoose.models.BillingCycle || mongoose.model("BillingCycle", billingCycleSchema);
