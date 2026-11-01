import { connectDatabase } from "../config/database.js";
import { seedDefaultRoles } from "../config/seed-default-roles.js";
import mongoose from "mongoose";
try {
    await connectDatabase();
    await seedDefaultRoles();
    console.log("Default roles are ready.");
}
finally {
    await mongoose.disconnect();
}
