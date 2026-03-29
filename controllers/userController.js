import prisma from "../config/prisma.js";
import validator from "validator";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { passwordRegex } from "../utils/validation.js";

// ---------------------- TOKEN ----------------------
const createToken = (id, isAdmin = false) => {
  return jwt.sign({ id, isAdmin }, process.env.JWT_SECRET, { expiresIn: "24h" });
};

// ---------------------- GET CURRENT USER ----------------------
const getCurrentUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        profileImage: user.profileImage,
        phone: user.phone,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch user data"
    });
  }
};

// ---------------------- USER LOGIN ----------------------
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("🔐 USER LOGIN ATTEMPT");
    console.log("📧 Email received:", email);

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      console.log("❌ User not found in DB");
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Check if user is active
    if (user.isActive === false) {
      console.log("❌ User account is deactivated");
      return res.status(403).json({
        success: false,
        message: "Account is deactivated. Please contact support."
      });
    }

    console.log("✅ User found:", {
      id: user.id,
      isAdmin: user.isAdmin,
    });

    const isMatch = await bcrypt.compare(password, user.password);
    console.log("🔍 Password match result:", isMatch);

    if (!isMatch) {
      console.log("❌ Password mismatch");
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const token = createToken(user.id, user.isAdmin);
    console.log("✅ Login successful");

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        profileImage: user.profileImage
      }
    });
  } catch (error) {
    console.error("🔥 Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login"
    });
  }
};

// ---------------------- USER REGISTER ----------------------
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    console.log("📝 REGISTER ATTEMPT:", email);

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const exists = await prisma.user.findUnique({
      where: { email }
    });

    if (exists) {
      console.log("⚠️ User already exists");
      return res.status(409).json({
        success: false,
        message: "User already exists"
      });
    }

    if (!validator.isEmail(email)) {
      console.log("❌ Invalid email format");
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email"
      });
    }

    if (!passwordRegex.test(password)) {
      console.log("❌ Weak password attempt");
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long, and include uppercase, lowercase, a number, and a special character.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    console.log("🔐 Password hashed successfully");

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        isAdmin: false,
        isActive: true
      }
    });

    console.log("✅ User saved:", user.id);

    const token = createToken(user.id, user.isAdmin);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error("🔥 Register error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during registration"
    });
  }
};

// ---------------------- ADMIN LOGIN ----------------------
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("🛡️ ADMIN LOGIN ATTEMPT");
    console.log("📧 Email received:", email);

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const adminUser = await prisma.user.findUnique({
      where: { email }
    });

    if (!adminUser) {
      console.log("❌ User not found");
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Check if user is actually an admin
    if (!adminUser.isAdmin) {
      console.log("❌ User is not an admin");
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required."
      });
    }

    // Check if admin is active
    if (adminUser.isActive === false) {
      console.log("❌ Admin account is deactivated");
      return res.status(403).json({
        success: false,
        message: "Admin account is deactivated"
      });
    }

    console.log("✅ Admin found:", {
      id: adminUser.id,
      isAdmin: adminUser.isAdmin,
    });

    const isMatch = await bcrypt.compare(password, adminUser.password);
    console.log("🔍 Password match result:", isMatch);

    if (!isMatch) {
      console.log("❌ Admin password mismatch");
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const token = createToken(adminUser.id, true);
    console.log("✅ Admin login successful");

    res.json({
      success: true,
      token,
      user: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        isAdmin: adminUser.isAdmin,
        profileImage: adminUser.profileImage
      }
    });
  } catch (error) {
    console.error("🔥 Admin login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during admin login"
    });
  }
};

// ---------------------- CREATE ADMIN (WITH SECRET) ----------------------
const createAdminWithSecret = async (req, res) => {
  try {
    const { name, email, password, adminSecret } = req.body;

    console.log("🛠️ CREATE ADMIN (WITH SECRET) ATTEMPT:", email);

    // Validate all required fields
    if (!name || !email || !password || !adminSecret) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    if (adminSecret !== process.env.ADMIN_SECRET) {
      console.log("❌ Invalid admin secret");
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    // Validate email
    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email"
      });
    }

    // Validate password strength
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long, and include uppercase, lowercase, a number, and a special character.",
      });
    }

    const exists = await prisma.user.findUnique({
      where: { email }
    });

    if (exists) {
      console.log("⚠️ User already exists");
      return res.status(409).json({
        success: false,
        message: "User already exists"
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const admin = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        isAdmin: true,
        isActive: true
      }
    });

    console.log("✅ Admin created successfully");

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        isAdmin: admin.isAdmin
      }
    });
  } catch (error) {
    console.error("🔥 Create admin error:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating admin"
    });
  }
};

// ---------------------- CREATE ADMIN (BY EXISTING ADMIN) ----------------------
const createAdminByAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const requestingAdminId = req.user.id;

    console.log("👑 CREATE ADMIN (BY ADMIN) ATTEMPT:", email);
    console.log("Requested by admin:", requestingAdminId);

    // Validate all required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // Validate email
    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email"
      });
    }

    // Validate password strength
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long, and include uppercase, lowercase, a number, and a special character.",
      });
    }

    // Check if user already exists
    const exists = await prisma.user.findUnique({
      where: { email }
    });

    if (exists) {
      console.log("⚠️ User already exists");

      // If user exists and is not admin, make them admin
      if (!exists.isAdmin) {
        const updatedUser = await prisma.user.update({
          where: { id: exists.id },
          data: { isAdmin: true }
        });

        return res.json({
          success: true,
          message: "Existing user promoted to admin successfully",
          user: {
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            isAdmin: true,
            isActive: updatedUser.isActive
          }
        });
      } else {
        return res.status(409).json({
          success: false,
          message: "Admin already exists with this email"
        });
      }
    }

    // Create new admin
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const admin = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        isAdmin: true,
        isActive: true
      }
    });

    console.log("✅ New admin created by admin:", requestingAdminId);

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        isAdmin: admin.isAdmin,
        isActive: admin.isActive
      }
    });
  } catch (error) {
    console.error("🔥 Create admin by admin error:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating admin"
    });
  }
};

// ---------------------- GET ALL USERS ----------------------
const getAllUsers = async (req, res) => {
  try {
    console.log('👥 Fetching all users');

    const { role, search, page = 1, limit = 20 } = req.query;
    const where = {};

    // Filter by role (admin or user)
    if (role === 'admin') {
      where.isAdmin = true;
    } else if (role === 'user') {
      where.isAdmin = false;
    }

    // Search by name or email
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalUsers = await prisma.user.count({ where });

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    });

    res.json({
      success: true,
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        hasNextPage: skip + users.length < totalUsers,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch users"
    });
  }
};

// ---------------------- GET USER BY ID ----------------------
const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('👤 Fetching user by ID:', userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user by ID error:', error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch user"
    });
  }
};

// ---------------------- UPDATE USER ----------------------
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, isAdmin, isActive, phone } = req.body;

    console.log('🔄 Updating user:', userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (isAdmin !== undefined) updateData.isAdmin = isAdmin;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (phone !== undefined) updateData.phone = phone;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      message: "User updated successfully",
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);

    // Handle P2002 duplicate field error from Prisma
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: "Email already exists"
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Failed to update user"
    });
  }
};

// ---------------------- DELETE USER ----------------------
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('🗑️ Deleting user:', userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Prevent admin from deleting themselves
    if (req.user.id === userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account"
      });
    }

    const deletedUser = await prisma.user.delete({
      where: { id: userId }
    });

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error) {
    console.error('Delete user error:', error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete user"
    });
  }
};

// ---------------------- GET ADMINS ----------------------
const getAdmins = async (req, res) => {
  try {
    console.log('👑 Fetching all admins');

    const admins = await prisma.user.findMany({
      where: { isAdmin: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      admins,
      count: admins.length
    });
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch admins"
    });
  }
};

// ---------------------- VERIFY TOKEN ----------------------
const verifyToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: "No token provided"
      });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user to ensure they still exist
    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        profileImage: user.profileImage
      }
    });
  } catch (error) {
    console.error("🔥 Token verification error:", error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: "Invalid token"
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: "Token expired"
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error verifying token"
    });
  }
};

// ---------------------- UPDATE USER STATUS ----------------------
const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { active } = req.body;

    console.log('🔄 Updating user status:', { userId, active });

    if (!userId || active === undefined) {
      return res.status(400).json({
        success: false,
        message: "User ID and status are required"
      });
    }

    // Prevent admin from deactivating themselves
    if (req.user.id === userId && active === false) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account"
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: active }
    });

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      message: `User ${active ? 'activated' : 'deactivated'} successfully`,
      user: updatedUser
    });
  } catch (error) {
    console.log("Update user error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to update user status"
    });
  }
};

export {
  loginUser,
  registerUser,
  adminLogin,
  createAdminWithSecret,
  createAdminByAdmin,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getAdmins,
  verifyToken,
  updateUserStatus,
  getCurrentUser
};