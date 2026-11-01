import mongoose from "mongoose";

const { Schema } = mongoose;
const paymentSchema = new Schema({
    invoice: { type: Schema.Types.ObjectId, ref: "Invoice", required: true, index: true },
    amountPaise: { type: Number, min: 1, required: true },
    date: { type: Date, required: true },
    method: { type: String, enum: ["cash", "upi", "bank_transfer", "cheque", "online", "other"], required: true },
    reference: { type: String, trim: true, maxlength: 180 },
    notes: { type: String, maxlength: 2000 },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
paymentSchema.index({ date: -1 });
export const Payment = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);
