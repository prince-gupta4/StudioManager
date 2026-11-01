import mongoose from "mongoose";

const { Schema } = mongoose;
const userSchema = new Schema({
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: Schema.Types.ObjectId, ref: "Role", required: true },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
}, { timestamps: true });
export const User = mongoose.models.User || mongoose.model("User", userSchema);
