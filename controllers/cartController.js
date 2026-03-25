import prisma from "../config/prisma.js";

// ==================== ADD TO CART ====================
const addToCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const { itemId, size } = req.body;

        console.log('🛒 Adding to cart:', { userId, itemId, size });

        // Validate input
        if (!itemId || !size) {
            return res.status(400).json({
                success: false,
                message: "All fields are required: itemId, size"
            });
        }

        // Check if item already exists in cart for this user and size
        const existingItem = await prisma.cartItem.findFirst({
            where: {
                userId,
                productId: itemId,
                size
            }
        });

        let cartItem;
        if (existingItem) {
            // Update quantity
            cartItem = await prisma.cartItem.update({
                where: { id: existingItem.id },
                data: {
                    quantity: {
                        increment: 1
                    }
                }
            });
        } else {
            // Create new cart item
            cartItem = await prisma.cartItem.create({
                data: {
                    userId,
                    productId: itemId,
                    size,
                    quantity: 1
                }
            });
        }

        // Fetch full cart to return to frontend
        const fullCart = await getFormattedCart(userId);

        res.json({
            success: true,
            message: "Product added to cart successfully",
            cartData: fullCart
        });
    } catch (error) {
        console.error("Add to cart error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to add product to cart"
        });
    }
}

// ==================== UPDATE CART ====================
const updateCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const { itemId, size, quantity } = req.body;

        console.log('🔄 Updating cart:', { userId, itemId, size, quantity });

        // Validate input
        if (!itemId || !size || quantity === undefined) {
            return res.status(400).json({
                success: false,
                message: "All fields are required: itemId, size, quantity"
            });
        }

        if (quantity <= 0) {
            // Remove item
            await prisma.cartItem.deleteMany({
                where: {
                    userId,
                    productId: itemId,
                    size
                }
            });
        } else {
            // Upsert quantity
            const existingItem = await prisma.cartItem.findFirst({
                where: {
                    userId,
                    productId: itemId,
                    size
                }
            });

            if (existingItem) {
                await prisma.cartItem.update({
                    where: { id: existingItem.id },
                    data: { quantity: parseInt(quantity) }
                });
            } else {
                await prisma.cartItem.create({
                    data: {
                        userId,
                        productId: itemId,
                        size,
                        quantity: parseInt(quantity)
                    }
                });
            }
        }

        // Fetch full cart to return to frontend
        const fullCart = await getFormattedCart(userId);

        res.json({
            success: true,
            message: "Cart updated successfully",
            cartData: fullCart
        });
    } catch (error) {
        console.error("Update cart error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to update cart"
        });
    }
}

// ==================== GET USER CART ====================
const getUserCart = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('📋 Getting cart for user:', userId);

        const cartData = await getFormattedCart(userId);

        res.json({
            success: true,
            cartData,
            message: "Cart data retrieved successfully"
        });
    } catch (error) {
        console.error("Get cart error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to get cart data"
        });
    }
}

// ==================== REMOVE FROM CART ====================
const removeFromCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const { itemId, size } = req.body;

        console.log('🗑️ Removing from cart:', { userId, itemId, size });

        if (!itemId || !size) {
            return res.status(400).json({
                success: false,
                message: "All fields are required: itemId, size"
            });
        }

        await prisma.cartItem.deleteMany({
            where: {
                userId,
                productId: itemId,
                size
            }
        });

        // Fetch full cart to return to frontend
        const fullCart = await getFormattedCart(userId);

        res.json({
            success: true,
            message: "Item removed from cart successfully",
            cartData: fullCart
        });
    } catch (error) {
        console.error("Remove from cart error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to remove item from cart"
        });
    }
}

// ==================== CLEAR CART ====================
const clearCart = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('🧹 Clearing cart for user:', userId);

        await prisma.cartItem.deleteMany({
            where: { userId }
        });

        res.json({
            success: true,
            message: "Cart cleared successfully",
            cartData: {}
        });
    } catch (error) {
        console.error("Clear cart error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to clear cart"
        });
    }
}

// ==================== HELPER: GET FORMATTED CART ====================
// This formats the relational CartItem table into the legacy JSON structure
// expected by the frontend: { productId: { size: quantity } }
const getFormattedCart = async (userId) => {
    const cartItems = await prisma.cartItem.findMany({
        where: { userId }
    });

    const formattedCart = {};
    cartItems.forEach(item => {
        if (!formattedCart[item.productId]) {
            formattedCart[item.productId] = {};
        }
        formattedCart[item.productId][item.size] = item.quantity;
    });

    return formattedCart;
}

export { addToCart, updateCart, getUserCart, removeFromCart, clearCart };
