import mongoose from "mongoose";

const { Schema } = mongoose;
const expenseSchema = new Schema({
    title: { type: String, required: true, trim: true, maxlength: 180 },
    amountPaise: { type: Number, min: 1, required: true },
    category: { type: String, required: true, trim: true, maxlength: 100 },
    date: { type: Date, required: true, index: true },
    paymentMethod: { type: String, enum: ["cash", "upi", "bank_transfer", "card", "other"], default: "other" },
    client: { type: Schema.Types.ObjectId, ref: "Client", index: true },
    project: { type: Schema.Types.ObjectId, ref: "Project", index: true },
    notes: { type: String, maxlength: 3000 },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    archivedAt: { type: Date, default: null },
}, { timestamps: true });
export const Expense = mongoose.models.Expense || mongoose.model("Expense", expenseSchema);
