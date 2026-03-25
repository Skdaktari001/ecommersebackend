import axios from 'axios';
import crypto from 'crypto';
import prisma from '../config/prisma.js';

/**
 * Paystack Payment Controller
 */

// Initialize a transaction
const initializeTransaction = async (req, res) => {
    try {
        const { orderId, email, amount } = req.body;

        if (!orderId || !email || !amount) {
            return res.status(400).json({
                success: false,
                message: "Order ID, email, and amount are required"
            });
        }

        const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
        
        // Paystack expects amount in kobo (multiply by 100)
        const paystackAmount = Math.round(parseFloat(amount) * 100);

        const response = await axios.post(
            'https://api.paystack.co/transaction/initialize',
            {
                email,
                amount: paystackAmount,
                reference: orderId, // We use the orderId as the reference
                callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-payment`
            },
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data.status) {
            res.json({
                success: true,
                data: response.data.data // contains authorization_url and reference
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Paystack initialization failed"
            });
        }
    } catch (error) {
        console.error("Paystack Initialize Error:", error.response ? error.response.data : error.message);
        res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};

// Verify a transaction manually (fallback)
const verifyTransaction = async (req, res) => {
    try {
        const { reference } = req.params;

        if (!reference) {
            return res.status(400).json({
                success: false,
                message: "Reference is required"
            });
        }

        const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

        const response = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET}`
                }
            }
        );

        if (response.data.status && response.data.data.status === 'success') {
            // Update order in database
            const order = await prisma.order.update({
                where: { id: reference },
                data: {
                    isPaid: true,
                    status: 'paid'
                }
            });

            res.json({
                success: true,
                message: "Payment verified successfully",
                order
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Payment verification failed or pending"
            });
        }
    } catch (error) {
        console.error("Paystack Verify Error:", error.response ? error.response.data : error.message);
        res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};

// Webhook for Paystack events
const webhook = async (req, res) => {
    try {
        const hash = crypto
            .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
            .update(JSON.stringify(req.body))
            .digest('hex');

        if (hash === req.headers['x-paystack-signature']) {
            const event = req.body;

            console.log('Paystack Webhook Event Received:', event.event);

            if (event.event === 'charge.success') {
                const reference = event.data.reference;
                
                // Update order status
                await prisma.order.update({
                    where: { id: reference },
                    data: {
                        isPaid: true,
                        status: 'paid'
                    }
                });
                
                console.log(`Order ${reference} marked as PAID via Webhook`);
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error("Paystack Webhook Error:", error.message);
        res.sendStatus(500);
    }
};

export {
    initializeTransaction,
    verifyTransaction,
    webhook
};
