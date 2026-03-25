import express from 'express';
import { 
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
} from '../controllers/reviewController.js';
import authMiddleware from '../middleware/auth.js';
import adminMiddleware from '../middleware/adminAuth.js';
import { reviewUpload, handleMulterError } from '../middleware/multer.js';

const router = express.Router();

// User routes (require authentication)
router.post('/submit', 
    authMiddleware, 
    reviewUpload.array('images', 4), 
    handleMulterError,
    submitReview
);

router.get('/user', authMiddleware, getUserReviews);
router.get('/reviewable-orders', authMiddleware, getReviewableOrders);

router.put('/:reviewId', 
    authMiddleware, 
    reviewUpload.array('images', 4), 
    handleMulterError,
    updateReview
);

router.delete('/user/:reviewId', authMiddleware, deleteUserReview);
router.post('/:reviewId/report', authMiddleware, reportReview);
router.post('/:reviewId/helpful', authMiddleware, voteHelpful);

// Public routes
router.get('/product/:productId', getProductReviews);

// Admin routes (require admin authentication)
router.get('/admin/all', authMiddleware, adminMiddleware, getAllReviewsAdmin);
router.put('/admin/:reviewId/status', authMiddleware, adminMiddleware, updateReviewStatus);
router.delete('/admin/:reviewId', authMiddleware, adminMiddleware, deleteReviewAdmin);

export default router;