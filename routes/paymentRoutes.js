import express from 'express';
import { initializeTransaction, verifyTransaction, webhook } from '../controllers/paystackController.js';
import authUser from '../middleware/auth.js';

const paymentRouter = express.Router();

// Initialize payment (requires auth)
paymentRouter.post('/paystack/initialize', authUser, initializeTransaction);

// Verify payment (usually redirected from frontend)
paymentRouter.get('/paystack/verify/:reference', verifyTransaction);

// Webhook (no auth, signature verified in controller)
paymentRouter.post('/paystack/webhook', webhook);

export default paymentRouter;
