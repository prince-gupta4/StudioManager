import mongoose from "mongoose";

const { Schema } = mongoose;
const contactSchema = new Schema({
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    designation: { type: String, trim: true },
    isPrimary: { type: Boolean, default: false },
}, { _id: true });
const clientSchema = new Schema({
    name: { type: String, required: true, trim: true, maxlength: 160 },
    type: { type: String, enum: ["business", "individual"], default: "business" },
    status: { type: String, enum: ["lead", "active", "inactive", "archived"], default: "lead" },
    contacts: { type: [contactSchema], default: [] },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
    billingAddress: { type: String, trim: true },
    gstin: { type: String, trim: true, uppercase: true },
    pan: { type: String, trim: true, uppercase: true },
    source: { type: String, trim: true },
    tags: [{ type: String, trim: true }],
    notes: { type: String, maxlength: 5000 },
    archivedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
clientSchema.index({ name: "text", email: "text", phone: "text" });
clientSchema.index({ status: 1, createdAt: -1 });
export const Client = mongoose.models.Client || mongoose.model("Client", clientSchema);
