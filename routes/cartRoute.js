import express from 'express'
import authMiddleware from '../middleware/auth.js'
import { 
    addToCart, 
    updateCart, 
    getUserCart, 
    removeFromCart,
    clearCart 
} from '../controllers/cartController.js'

const cartRouter = express.Router()

// All cart routes require authentication
cartRouter.get('/', authMiddleware, getUserCart);           // GET /api/cart - Get cart
cartRouter.post('/add', authMiddleware, addToCart);         // POST /api/cart/add - Add item
cartRouter.put('/update', authMiddleware, updateCart);      // PUT /api/cart/update - Update item
cartRouter.delete('/remove', authMiddleware, removeFromCart); // DELETE /api/cart/remove - Remove item
cartRouter.delete('/clear', authMiddleware, clearCart);     // DELETE /api/cart/clear - Clear cart

export default cartRouter;