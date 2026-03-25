import prisma from "../config/prisma.js"

const placeOrder = async (req, res) => {
    try {
        const userId = req.user.id; // Get userId from authenticated user
        const { items, amount, address, paymentMethod = "COD" } = req.body;

        console.log('📦 Placing order for user:', userId);
        console.log('📝 Order items:', items);
        console.log('💰 Amount:', amount);

        if (!items || !amount || !address) {
            return res.status(400).json({
                success: false,
                message: "All fields are required: items, amount, address"
            });
        }

        // Validate items structure
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Items must be a non-empty array"
            });
        }

        // Use a transaction to ensure order and items are created together
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create the order
            const order = await tx.order.create({
                data: {
                    userId,
                    totalAmount: parseFloat(amount),
                    address: address, // Saving as JSON for simplicity, or we could link to UserAddress
                    paymentMethod,
                    isPaid: paymentMethod !== "COD",
                    status: 'pending',
                    items: {
                        create: items.map(item => ({
                            productId: item.id || item.productId,
                            quantity: item.quantity,
                            price: parseFloat(item.price)
                        }))
                    }
                },
                include: {
                    items: true
                }
            });

            // 2. Clear user's cart (now cartItems table)
            await tx.cartItem.deleteMany({
                where: { userId }
            });

            return order;
        });

        console.log('✅ Order placed and cart cleared. Order ID:', result.id);

        res.json({
            success: true,
            message: "Order Placed Successfully",
            orderId: result.id,
            order: result
        })
    } catch (error) {
        console.log("❌ Place order error:", error)
        res.status(500).json({
            success: false,
            message: error.message || "Failed to place order"
        })
    }
}

// Placing orders using stripe method
const placeOrderStripe = async (req, res) => {
    try {
        console.log('💳 Stripe payment attempt');

        const userId = req.user.id;
        const { items, amount, address } = req.body;

        if (!items || !amount || !address) {
            return res.status(400).json({
                success: false,
                message: "All fields are required: items, amount, address"
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            const order = await tx.order.create({
                data: {
                    userId,
                    totalAmount: parseFloat(amount),
                    address: address,
                    paymentMethod: "Stripe",
                    isPaid: false, // Will be updated via webhook
                    status: 'pending',
                    items: {
                        create: items.map(item => ({
                            productId: item.id || item.productId,
                            quantity: item.quantity,
                            price: parseFloat(item.price)
                        }))
                    }
                }
            });
            return order;
        });

        res.json({
            success: true,
            message: "Stripe payment initiated",
            orderId: result.id,
            requiresPayment: true,
            paymentMethod: "stripe"
        });
    } catch (error) {
        console.log("❌ Stripe order error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Stripe payment failed"
        });
    }
}

// Placing orders using Razorpay method
const placeOrderRazorpay = async (req, res) => {
    try {
        console.log('💳 Razorpay payment attempt');

        const userId = req.user.id;
        const { items, amount, address } = req.body;

        if (!items || !amount || !address) {
            return res.status(400).json({
                success: false,
                message: "All fields are required: items, amount, address"
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            const order = await tx.order.create({
                data: {
                    userId,
                    totalAmount: parseFloat(amount),
                    address: address,
                    paymentMethod: "Razorpay",
                    isPaid: false, // Will be updated via webhook
                    status: 'pending',
                    items: {
                        create: items.map(item => ({
                            productId: item.id || item.productId,
                            quantity: item.quantity,
                            price: parseFloat(item.price)
                        }))
                    }
                }
            });
            return order;
        });

        res.json({
            success: true,
            message: "Razorpay payment initiated",
            orderId: result.id,
            requiresPayment: true,
            paymentMethod: "razorpay",
            order: result
        });
    } catch (error) {
        console.log("❌ Razorpay order error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Razorpay payment failed"
        });
    }
}

// Placing orders using Paystack method
const placeOrderPaystack = async (req, res) => {
    try {
        console.log('💳 Paystack payment attempt');

        const userId = req.user.id;
        const { items, amount, address } = req.body;

        if (!items || !amount || !address) {
            return res.status(400).json({
                success: false,
                message: "All fields are required: items, amount, address"
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            const order = await tx.order.create({
                data: {
                    userId,
                    totalAmount: parseFloat(amount),
                    address: address,
                    paymentMethod: "Paystack",
                    isPaid: false, // Will be updated via webhook or verify call
                    status: 'pending',
                    items: {
                        create: items.map(item => ({
                            productId: item.id || item.productId,
                            quantity: item.quantity,
                            price: parseFloat(item.price)
                        }))
                    }
                }
            });
            return order;
        });

        res.json({
            success: true,
            message: "Paystack order created",
            orderId: result.id,
            amount: result.totalAmount,
            userEmail: req.user.email
        });
    } catch (error) {
        console.log("❌ Paystack order error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Paystack order creation failed"
        });
    }
}

// All orders data for admin panel
const allOrders = async (req, res) => {
    try {
        console.log('📋 Fetching all orders for admin');

        const {
            status,
            payment,
            startDate,
            endDate,
            page = 1,
            limit = 20
        } = req.query;

        // Build filter
        const where = {};
        if (status) where.status = status;
        if (payment !== undefined) where.isPaid = payment === 'true';

        // Date range filter
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const totalOrders = await prisma.order.count({ where });

        // Fetch orders with user details and items
        const orders = await prisma.order.findMany({
            where,
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                },
                items: {
                    include: {
                        product: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: parseInt(limit)
        });

        res.json({
            success: true,
            orders,
            count: orders.length,
            total: totalOrders,
            page: parseInt(page),
            totalPages: Math.ceil(totalOrders / limit)
        });
    } catch (error) {
        console.log("❌ All orders error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch orders"
        });
    }
}

// User order data for frontend
const userOrders = async (req, res) => {
    try {
        const userId = req.user.id; // Get userId from authenticated user

        console.log('📋 Fetching orders for user:', userId);

        const { status, page = 1, limit = 10 } = req.query;

        // Build filter
        const where = { userId };
        if (status) where.status = status;

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const totalOrders = await prisma.order.count({ where });

        const orders = await prisma.order.findMany({
            where,
            include: {
                items: {
                    include: {
                        product: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: parseInt(limit)
        });

        console.log(`📊 Found ${orders.length} orders for user ${userId}`);

        res.json({
            success: true,
            orders,
            count: orders.length,
            total: totalOrders,
            page: parseInt(page),
            totalPages: Math.ceil(totalOrders / limit)
        });
    } catch (error) {
        console.log("❌ User orders error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch user orders"
        });
    }
}

// Update order status
const updateStatus = async (req, res) => {
    try {
        const { orderId } = req.params; // Get orderId from URL params
        const { status } = req.body;

        console.log('🔄 Updating order status:', { orderId, status });

        if (!orderId || !status) {
            return res.status(400).json({
                success: false,
                message: "Order ID and status are required"
            });
        }

        // Map frontend statuses to Prisma enums if necessary
        const statusMap = {
            'Order Placed': 'pending',
            'Packing': 'pending', // No 'packing' in enum, keeping as pending for now
            'Shipped': 'shipped',
            'Out for delivery': 'shipped',
            'Delivered': 'delivered',
            'Cancelled': 'cancelled'
        };

        const mappedStatus = statusMap[status] || status;

        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: { status: mappedStatus }
        });

        if (!updatedOrder) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        console.log('✅ Order status updated:', updatedOrder.status);

        res.json({
            success: true,
            message: "Order Status Updated Successfully",
            order: updatedOrder
        });
    } catch (error) {
        console.log("❌ Update status error:", error);

        res.status(500).json({
            success: false,
            message: error.message || "Failed to update order status"
        });
    }
}

// Get single order by ID
const getOrderById = async (req, res) => {
    try {
        const { orderId } = req.params;

        console.log('📋 Fetching order by ID:', orderId);

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: "Order ID is required"
            });
        }

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: {
                    include: {
                        product: true
                    }
                },
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // Check if user is authorized to view this order
        const userId = req.user.id;
        const isAdmin = req.user.isAdmin;

        if (!isAdmin && order.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to view this order"
            });
        }

        res.json({
            success: true,
            order
        });
    } catch (error) {
        console.log("❌ Get order by ID error:", error);

        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch order"
        });
    }
}

export {
    placeOrder,
    placeOrderRazorpay,
    placeOrderStripe,
    placeOrderPaystack,
    allOrders,
    updateStatus,
    userOrders,
    getOrderById
};
