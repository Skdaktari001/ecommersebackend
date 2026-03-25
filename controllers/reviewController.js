import prisma from "../config/prisma.js";
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_SECRET_KEY
});

// ==================== SUBMIT REVIEW ====================
const submitReview = async (req, res) => {
    try {
        const userId = req.user.id;
        const { productId, orderId, rating, title, description } = req.body;

        console.log('📝 Submitting review:', { userId, productId, orderId });

        // Validate required fields
        if (!productId || !orderId || !rating || !title || !description) {
            return res.status(400).json({
                success: false,
                message: "All fields are required: productId, orderId, rating, title, description"
            });
        }

        // Validate rating
        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5"
            });
        }

        // Check if order exists and is delivered
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true }
        });

        if (!order || order.userId !== userId || order.status !== 'delivered') {
            return res.status(403).json({
                success: false,
                message: "Order not found or not delivered. You can only review delivered products."
            });
        }

        // Check if product exists in the order
        const productInOrder = order.items.find(item =>
            item.productId === productId
        );

        if (!productInOrder) {
            return res.status(403).json({
                success: false,
                message: "This product was not in your order"
            });
        }

        // Check if review already exists
        const existingReview = await prisma.review.findUnique({
            where: {
                userId_productId_orderId: {
                    userId,
                    productId,
                    orderId
                }
            }
        });

        if (existingReview) {
            return res.status(409).json({
                success: false,
                message: "You have already reviewed this product from this order"
            });
        }

        // Handle image uploads
        let imageUrls = [];
        if (req.files && req.files.images) {
            const images = Array.isArray(req.files.images) ? req.files.images : [req.files.images];

            imageUrls = await Promise.all(
                images.map(async (image) => {
                    const result = await cloudinary.uploader.upload(image.path, {
                        folder: 'review_images',
                        resource_type: 'image'
                    });
                    return result.secure_url;
                })
            );
        }

        // Create review with image relation using a transaction
        const review = await prisma.$transaction(async (prisma) => {
            const newReview = await prisma.review.create({
                data: {
                    userId,
                    productId,
                    orderId,
                    rating: parseInt(rating),
                    title: title.trim(),
                    description: description.trim(),
                    status: 'approved',
                    verifiedPurchase: true,
                    images: {
                        create: imageUrls.map(url => ({
                            imageUrl: url
                        }))
                    }
                },
                include: {
                    user: {
                        select: {
                            name: true,
                            profileImage: true
                        }
                    },
                    images: true
                }
            });
            return newReview;
        });


        // Update product review statistics
        await updateProductReviewStats(productId);

        res.status(201).json({
            success: true,
            message: "Review submitted successfully",
            review
        });

    } catch (error) {
        console.error('Submit review error:', error);

        if (error.code === 'P2002') {
            return res.status(409).json({
                success: false,
                message: "You have already reviewed this product from this order"
            });
        }

        res.status(500).json({
            success: false,
            message: error.message || "Failed to submit review"
        });
    }
};

// ==================== GET PRODUCT REVIEWS ====================
const getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;
        const {
            page = 1,
            limit = 10,
            rating,
            sort = 'recent',
            status = 'approved'
        } = req.query;

        console.log('📋 Fetching reviews for product:', productId);

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required"
            });
        }

        // Build filter
        const where = { productId, status };
        if (rating) where.rating = parseInt(rating);

        // Build sort
        let orderBy = {};
        switch (sort) {
            case 'recent':
                orderBy = { createdAt: 'desc' };
                break;
            case 'helpful':
                orderBy = [{ helpfulVotes: 'desc' }, { createdAt: 'desc' }];
                break;
            case 'high-rating':
                orderBy = [{ rating: 'desc' }, { createdAt: 'desc' }];
                break;
            case 'low-rating':
                orderBy = [{ rating: 'asc' }, { createdAt: 'desc' }];
                break;
            default:
                orderBy = { createdAt: 'desc' };
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const totalReviews = await prisma.review.count({ where });

        // Fetch reviews with related images
        const reviews = await prisma.review.findMany({
            where,
            include: {
                user: {
                    select: {
                        name: true,
                        profileImage: true
                    }
                },
                images: true
            },
            orderBy,
            skip,
            take: parseInt(limit)
        });

        // Get review summary
        const reviewSummary = await getReviewSummary(productId);

        res.json({
            success: true,
            reviews,
            summary: reviewSummary,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalReviews / limit),
                totalReviews,
                hasNextPage: skip + reviews.length < totalReviews,
                hasPrevPage: page > 1
            }
        });

    } catch (error) {
        console.error('Get product reviews error:', error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch reviews"
        });
    }
};

// ==================== GET USER REVIEWS ====================
const getUserReviews = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10 } = req.query;

        console.log('📋 Fetching reviews for user:', userId);

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const totalReviews = await prisma.review.count({ where: { userId } });

        // Fetch reviews with product details and images
        const reviews = await prisma.review.findMany({
            where: { userId },
            include: {
                product: {
                    select: {
                        name: true,
                        images: true,
                        price: true
                    }
                },
                images: true
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: parseInt(limit)
        });

        res.json({
            success: true,
            reviews,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalReviews / limit),
                totalReviews,
                hasNextPage: skip + reviews.length < totalReviews,
                hasPrevPage: page > 1
            }
        });

    } catch (error) {
        console.error('Get user reviews error:', error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch user reviews"
        });
    }
};

// ==================== DELETE REVIEW (USER) ====================
const deleteUserReview = async (req, res) => {
    try {
        const userId = req.user.id;
        const { reviewId } = req.params;

        console.log('🗑️ User deleting review:', { userId, reviewId });

        if (!reviewId) {
            return res.status(400).json({
                success: false,
                message: "Review ID is required"
            });
        }

        // Find review
        const review = await prisma.review.findUnique({
            where: { id: reviewId },
            include: { images: true }
        });

        if (!review || review.userId !== userId) {
            return res.status(404).json({
                success: false,
                message: "Review not found or you don't have permission to delete it"
            });
        }

        const productId = review.productId;

        // Delete images from Cloudinary
        if (review.images && review.images.length > 0) {
            await Promise.all(
                review.images.map(async (img) => {
                    try {
                        const publicId = img.imageUrl.split('/').pop().split('.')[0];
                        await cloudinary.uploader.destroy(`review_images/${publicId}`);
                    } catch (cloudinaryError) {
                        console.warn('Could not delete image:', cloudinaryError.message);
                    }
                })
            );
        }

        // Delete review
        await prisma.review.delete({
            where: { id: reviewId }
        });

        // Update product review statistics
        await updateProductReviewStats(productId);

        res.json({
            success: true,
            message: "Review deleted successfully"
        });

    } catch (error) {
        console.error('Delete user review error:', error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to delete review"
        });
    }
};

// ==================== DELETE REVIEW (ADMIN) ====================
const deleteReviewAdmin = async (req, res) => {
    try {
        const { reviewId } = req.params;

        console.log('👑 Admin deleting review:', reviewId);

        if (!reviewId) {
            return res.status(400).json({
                success: false,
                message: "Review ID is required"
            });
        }

        // Find review
        const review = await prisma.review.findUnique({
            where: { id: reviewId },
            include: { images: true }
        });

        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Review not found"
            });
        }

        const productId = review.productId;

        // Delete images from Cloudinary
        if (review.images && review.images.length > 0) {
            await Promise.all(
                review.images.map(async (img) => {
                    try {
                        const publicId = img.imageUrl.split('/').pop().split('.')[0];
                        await cloudinary.uploader.destroy(`review_images/${publicId}`);
                    } catch (cloudinaryError) {
                        console.warn('Could not delete image:', cloudinaryError.message);
                    }
                })
            );
        }

        // Delete review
        await prisma.review.delete({
            where: { id: reviewId }
        });

        // Update product review statistics
        await updateProductReviewStats(productId);

        res.json({
            success: true,
            message: "Review deleted successfully by admin"
        });

    } catch (error) {
        console.error('Delete admin review error:', error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to delete review"
        });
    }
};

// ==================== UPDATE REVIEW ====================
const updateReview = async (req, res) => {
    try {
        const userId = req.user.id;
        const { reviewId } = req.params;
        const { rating, title, description } = req.body;

        console.log('🔄 Updating review:', { userId, reviewId });

        if (!reviewId) {
            return res.status(400).json({
                success: false,
                message: "Review ID is required"
            });
        }

        // Find review
        const review = await prisma.review.findUnique({
            where: { id: reviewId },
            include: { images: true }
        });

        if (!review || review.userId !== userId) {
            return res.status(404).json({
                success: false,
                message: "Review not found or you don't have permission to update it"
            });
        }

        // Update fields
        const updates = {};
        if (rating !== undefined) {
            if (rating < 1 || rating > 5) {
                return res.status(400).json({
                    success: false,
                    message: "Rating must be between 1 and 5"
                });
            }
            updates.rating = parseInt(rating);
        }
        if (title !== undefined) updates.title = title.trim();
        if (description !== undefined) updates.description = description.trim();

        // Handle new image uploads (append)
        if (req.files && req.files.images) {
            const images = Array.isArray(req.files.images) ? req.files.images : [req.files.images];

            const newImageUrls = await Promise.all(
                images.map(async (image) => {
                    const result = await cloudinary.uploader.upload(image.path, {
                        folder: 'review_images',
                        resource_type: 'image'
                    });
                    return result.secure_url;
                })
            );

            await prisma.reviewImage.createMany({
                data: newImageUrls.map(url => ({
                    reviewId,
                    imageUrl: url
                }))
            });
        }

        // Update review
        const updatedReview = await prisma.review.update({
            where: { id: reviewId },
            data: updates,
            include: {
                user: {
                    select: {
                        name: true,
                        profileImage: true
                    }
                },
                images: true
            }
        });

        // Update product review statistics if rating changed
        if (rating !== undefined) {
            await updateProductReviewStats(review.productId);
        }

        res.json({
            success: true,
            message: "Review updated successfully",
            review: updatedReview
        });

    } catch (error) {
        console.error('Update review error:', error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to update review"
        });
    }
};

// ==================== ADMIN: GET ALL REVIEWS ====================
const getAllReviewsAdmin = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            rating,
            productId,
            search
        } = req.query;

        console.log('👑 Admin fetching all reviews');

        // Build filter
        const where = {};
        if (status) where.status = status;
        if (rating) where.rating = parseInt(rating);
        if (productId) where.productId = productId;

        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { user: { name: { contains: search, mode: 'insensitive' } } },
                { product: { name: { contains: search, mode: 'insensitive' } } }
            ];
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const totalReviews = await prisma.review.count({ where });

        // Fetch reviews with populated data
        const reviews = await prisma.review.findMany({
            where,
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                },
                product: {
                    select: {
                        name: true,
                        images: true
                    }
                },
                images: true
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: parseInt(limit)
        });

        res.json({
            success: true,
            reviews,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalReviews / limit),
                totalReviews,
                hasNextPage: skip + reviews.length < totalReviews,
                hasPrevPage: page > 1
            }
        });

    } catch (error) {
        console.error('Admin get all reviews error:', error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch reviews"
        });
    }
};

// ==================== ADMIN: UPDATE REVIEW STATUS ====================
const updateReviewStatus = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { status } = req.body;

        console.log('👑 Admin updating review status:', { reviewId, status });

        if (!reviewId || !status) {
            return res.status(400).json({
                success: false,
                message: "Review ID and status are required"
            });
        }

        const validStatuses = ['pending', 'approved', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        const review = await prisma.review.findUnique({
            where: { id: reviewId }
        });

        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Review not found"
            });
        }

        const oldStatus = review.status;

        const updatedReview = await prisma.review.update({
            where: { id: reviewId },
            data: { status },
            include: { images: true }
        });

        // If changing from approved to something else, or vice versa, update product stats
        if (oldStatus === 'approved' || status === 'approved') {
            await updateProductReviewStats(review.productId);
        }

        res.json({
            success: true,
            message: "Review status updated successfully",
            review: updatedReview
        });

    } catch (error) {
        console.error('Update review status error:', error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to update review status"
        });
    }
};

// ==================== REPORT REVIEW ====================
// Note: Reports table is not in new schema, skipping or using a simple implementation
const reportReview = async (req, res) => {
    res.status(501).json({ success: false, message: "Report feature not implemented in normalized schema" });
};

// ==================== VOTE HELPFUL ====================
const voteHelpful = async (req, res) => {
    try {
        const userId = req.user.id;
        const { reviewId } = req.params;

        console.log('👍 Voting helpful:', { userId, reviewId });

        if (!reviewId) {
            return res.status(400).json({
                success: false,
                message: "Review ID is required"
            });
        }

        const updatedReview = await prisma.review.update({
            where: { id: reviewId },
            data: {
                helpfulVotes: {
                    increment: 1
                }
            }
        });

        res.json({
            success: true,
            message: "Thank you for your feedback",
            helpfulVotes: updatedReview.helpfulVotes
        });

    } catch (error) {
        console.error('Vote helpful error:', error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to vote"
        });
    }
};

// ==================== HELPER FUNCTIONS ====================
const updateProductReviewStats = async (productId) => {
    try {
        // Get all approved reviews for this product
        const reviews = await prisma.review.findMany({
            where: {
                productId,
                status: 'approved'
            }
        });

        if (reviews.length === 0) {
            // No reviews, reset stats
            await prisma.product.update({
                where: { id: productId },
                data: {
                    averageRating: 0,
                    totalReviews: 0,
                    reviewCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
                }
            });
            return;
        }

        // Calculate new stats
        const total = reviews.length;
        const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
        const average = sum / total;

        // Count by rating
        const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        reviews.forEach(review => {
            counts[review.rating]++;
        });

        // Update product
        await prisma.product.update({
            where: { id: productId },
            data: {
                averageRating: parseFloat(average.toFixed(1)),
                totalReviews: total,
                reviewCounts: counts
            }
        });

    } catch (error) {
        console.error('Update product stats error:', error);
    }
};

const getReviewSummary = async (productId) => {
    try {
        const product = await prisma.product.findUnique({
            where: { id: productId },
            select: {
                averageRating: true,
                totalReviews: true,
                reviewCounts: true
            }
        });

        return product;
    } catch (error) {
        console.error('Get review summary error:', error);
        return null;
    }
};

// ==================== GET REVIEWABLE ORDERS ====================
const getReviewableOrders = async (req, res) => {
    try {
        const userId = req.user.id;

        console.log('📦 Fetching reviewable orders for user:', userId);

        // Get delivered orders
        const deliveredOrders = await prisma.order.findMany({
            where: {
                userId,
                status: 'Delivered'
            },
            orderBy: { date: 'desc' }
        });

        // Get already reviewed products
        const userReviews = await prisma.review.findMany({
            where: { userId },
            select: {
                productId: true,
                orderId: true
            }
        });

        // Create a map of reviewed products by order
        const reviewedMap = {};
        userReviews.forEach(review => {
            if (!reviewedMap[review.orderId]) {
                reviewedMap[review.orderId] = new Set();
            }
            reviewedMap[review.orderId].add(review.productId);
        });

        // Filter orders with products that haven't been reviewed
        const reviewableOrders = deliveredOrders
            .map(order => {
                const unreviewedItems = order.items.filter(item => {
                    const productId = item.productId || item.id;
                    return !reviewedMap[order.id] ||
                        !reviewedMap[order.id].has(productId);
                });

                if (unreviewedItems.length === 0) return null;

                return {
                    orderId: order.id,
                    orderDate: order.date,
                    items: unreviewedItems.map(item => ({
                        productId: item.productId || item.id,
                        name: item.name,
                        image: item.image || (item.images && item.images[0]),
                        price: item.price,
                        size: item.size,
                        quantity: item.quantity
                    }))
                };
            })
            .filter(order => order !== null);

        res.json({
            success: true,
            orders: reviewableOrders
        });

    } catch (error) {
        console.error('Get reviewable orders error:', error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch reviewable orders"
        });
    }
};

export {
    submitReview,
    getProductReviews,
    getUserReviews,
    deleteUserReview,
    deleteReviewAdmin,
    updateReview,
    getAllReviewsAdmin,
    updateReviewStatus,
    reportReview,
    voteHelpful,
    getReviewableOrders
};
