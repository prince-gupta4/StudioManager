import mongoose from "mongoose";

const { Schema } = mongoose;
const invoiceItemSchema = new Schema({
    service: { type: Schema.Types.ObjectId, ref: "Service" },
    description: { type: String, required: true },
    quantity: { type: Number, min: 0, required: true },
    unit: { type: String, required: true },
    ratePaise: { type: Number, min: 0, required: true },
    discountPaise: { type: Number, min: 0, default: 0 },
    taxRateBasisPoints: { type: Number, min: 0, max: 10000, default: 0 },
    taxPaise: { type: Number, min: 0, required: true },
    totalPaise: { type: Number, min: 0, required: true },
    hsnSac: String,
}, { _id: false });
const invoiceSchema = new Schema({
    number: { type: String, required: true, unique: true },
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    contract: { type: Schema.Types.ObjectId, ref: "Contract" },
    billingCycle: { type: Schema.Types.ObjectId, ref: "BillingCycle", unique: true, sparse: true },
    issueDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    billingStartDate: Date,
    billingEndDate: Date,
    status: { type: String, enum: ["draft", "issued", "sent", "partially_paid", "paid", "overdue", "cancelled"], default: "draft", index: true },
    currency: { type: String, default: "INR", enum: ["INR"] },
    items: { type: [invoiceItemSchema], required: true },
    subtotalPaise: { type: Number, min: 0, required: true },
    discountPaise: { type: Number, min: 0, default: 0 },
    taxPaise: { type: Number, min: 0, required: true },
    totalPaise: { type: Number, min: 0, required: true },
    amountPaidPaise: { type: Number, min: 0, default: 0 },
    amountDuePaise: { type: Number, min: 0, required: true },
    placeOfSupply: String,
    notes: String,
    issuedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
invoiceSchema.index({ client: 1, status: 1, dueDate: 1 });
export const Invoice = mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema);
