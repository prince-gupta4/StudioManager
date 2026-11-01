import mongoose from "mongoose";

const { Schema } = mongoose;
export const permissions = [
    "dashboard:read",
    "clients:read",
    "clients:write",
    "services:read",
    "services:write",
    "contracts:read",
    "contracts:write",
    "projects:read",
    "projects:write",
    "production:read",
    "production:write",
    "finance:read",
    "finance:write",
    "expenses:read",
    "expenses:write",
    "media:read",
    "media:write",
    "team:read",
    "team:write",
];
const roleSchema = new Schema({
    name: { type: String, required: true, unique: true, trim: true },
    permissions: [{ type: String, enum: permissions }],
    isSystem: { type: Boolean, default: true },
}, { timestamps: true });
export const Role = mongoose.models.Role || mongoose.model("Role", roleSchema);
