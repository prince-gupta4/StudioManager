import mongoose from "mongoose";

const { Schema } = mongoose;
const quotationItemSchema = new Schema({
    service: { type: Schema.Types.ObjectId, ref: "Service" },
    description: { type: String, required: true, maxlength: 500 },
    quantity: { type: Number, min: 0.0001, required: true },
    unit: { type: String, required: true, maxlength: 40 },
    ratePaise: { type: Number, min: 0, required: true },
    discountPaise: { type: Number, min: 0, default: 0 },
    taxRateBasisPoints: { type: Number, min: 0, max: 10000, default: 0 },
    taxPaise: { type: Number, min: 0, required: true },
    totalPaise: { type: Number, min: 0, required: true },
}, { _id: false });
const quotationSchema = new Schema({
    number: { type: String, required: true, unique: true },
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    title: { type: String, required: true, maxlength: 180 },
    issueDate: { type: Date, required: true },
    validUntil: { type: Date, required: true },
    status: { type: String, enum: ["draft", "sent", "accepted", "rejected", "expired", "converted"], default: "draft", index: true },
    items: { type: [quotationItemSchema], required: true },
    subtotalPaise: { type: Number, min: 0, required: true },
    discountPaise: { type: Number, min: 0, default: 0 },
    taxPaise: { type: Number, min: 0, required: true },
    totalPaise: { type: Number, min: 0, required: true },
    terms: { type: String, maxlength: 5000 },
    convertedContract: { type: Schema.Types.ObjectId, ref: "Contract" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
quotationSchema.index({ client: 1, status: 1, issueDate: -1 });
export const Quotation = mongoose.models.Quotation || mongoose.model("Quotation", quotationSchema);
