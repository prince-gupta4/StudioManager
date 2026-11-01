import { Role, permissions } from "../models/Role.js";
const all = [...permissions];
const finance = ["finance:read", "finance:write", "expenses:read", "expenses:write"];
const production = ["production:read", "production:write", "projects:read", "projects:write"];
const clients = ["clients:read", "clients:write"];
const media = ["media:read", "media:write"];
const defaults = [
    { name: "Owner", permissions: all },
    { name: "Administrator", permissions: all },
    { name: "Manager", permissions: all },
    { name: "Editor", permissions: ["dashboard:read", "clients:read", ...production, ...media] },
    { name: "Shooter", permissions: ["dashboard:read", "clients:read", ...production, ...media] },
    { name: "Marketing Executive", permissions: ["dashboard:read", ...clients, ...production, ...media] },
    { name: "Accountant", permissions: ["dashboard:read", ...clients, "services:read", "contracts:read", ...finance, ...media] },
];
export async function seedDefaultRoles() {
    for (const role of defaults) {
        await Role.updateOne({ name: role.name }, { $set: { permissions: role.permissions } }, { upsert: true });
    }
}
