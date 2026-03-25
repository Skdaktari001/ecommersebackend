import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import userModel from "./models/userModel.js";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error("❌ MONGODB_URI is undefined. Check your .env file.");
  process.exit(1);
}

await mongoose.connect(MONGO_URI);
console.log("✅ Connected to MongoDB");

const password = "YourRealAdminPassword"; // remember this password

const hashedPassword = await bcrypt.hash(password, 10);

await userModel.create({
  name: "Adminuser",
  email: "admin001@example.com",
  password: hashedPassword,
  isAdmin: true,
});

console.log("✅ Admin created correctly");
process.exit();
