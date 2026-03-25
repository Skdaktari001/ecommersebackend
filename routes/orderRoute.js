import express from 'express'
import { 
  placeOrder, 
  placeOrderRazorpay, 
  placeOrderStripe, 
  placeOrderPaystack,
  updateStatus, 
  allOrders, 
  userOrders 
} from '../controllers/orderController.js'
import authMiddleware from '../middleware/auth.js'
import adminMiddleware from '../middleware/adminAuth.js'

const orderRouter = express.Router()

// ==================== USER ROUTES (AUTHENTICATED) ====================
// Order placement
orderRouter.post('/place', authMiddleware, placeOrder);
orderRouter.post('/stripe', authMiddleware, placeOrderStripe);
orderRouter.post('/razorpay', authMiddleware, placeOrderRazorpay);
orderRouter.post('/paystack', authMiddleware, placeOrderPaystack);

// User order history
orderRouter.get('/user', authMiddleware, userOrders);

// ==================== ADMIN ROUTES ====================
// Get all orders
orderRouter.get('/', authMiddleware, adminMiddleware, allOrders);

// Update order status
orderRouter.put('/:orderId/status', authMiddleware, adminMiddleware, updateStatus);

export default orderRouter;