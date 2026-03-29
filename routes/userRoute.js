import express from 'express'
import { 
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
} from '../controllers/userController.js'
import authMiddleware from '../middleware/auth.js'
import adminMiddleware from '../middleware/adminAuth.js'
import { loginLimiter } from '../middleware/rateLimiter.js'

const userRouter = express.Router();

// ==================== PUBLIC ROUTES ====================
// User registration and login
userRouter.post('/register', loginLimiter, registerUser);
userRouter.post('/login', loginLimiter, loginUser);
userRouter.post('/admin-login', loginLimiter, adminLogin);
userRouter.post('/verify-token', verifyToken);

// Admin creation with secret (for initial setup - keep public for first admin)
userRouter.post('/create-admin-secret', createAdminWithSecret);

// ==================== AUTHENTICATED USER ROUTES ====================
userRouter.get('/me', authMiddleware, getCurrentUser);

// ==================== ADMIN PROTECTED ROUTES ====================
// User management
userRouter.get('/', authMiddleware, adminMiddleware, getAllUsers);
userRouter.get('/admins', authMiddleware, adminMiddleware, getAdmins);
userRouter.post('/create-admin', authMiddleware, adminMiddleware, createAdminByAdmin);

// Individual user operations
userRouter.get('/:userId', authMiddleware, adminMiddleware, getUserById);
userRouter.put('/:userId', authMiddleware, adminMiddleware, updateUser);
userRouter.delete('/:userId', authMiddleware, adminMiddleware, deleteUser);
userRouter.put('/:userId/status', authMiddleware, adminMiddleware, updateUserStatus);

export default userRouter;