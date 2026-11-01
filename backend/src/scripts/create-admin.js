import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDatabase } from "../config/database.js";
import { seedDefaultRoles } from "../config/seed-default-roles.js";
import { Role } from "../models/Role.js";
import { User } from "../models/User.js";
const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 6) {
    throw new Error("Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD (at least 6 characters) before running create-admin.");
}
try {
    await connectDatabase();
    await seedDefaultRoles();
    const email = ADMIN_EMAIL.trim().toLowerCase();
    if (await User.exists({ email }))
        throw new Error("An account already exists for that email address.");
    const ownerRole = await Role.findOne({ name: "Owner" });
    if (!ownerRole)
        throw new Error("Owner role could not be initialized.");
    await User.create({
        name: ADMIN_NAME.trim(),
        email,
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
        role: ownerRole._id,
    });
    console.log(`Administrator account created for ${email}.`);
}
finally {
    await mongoose.disconnect();
}
