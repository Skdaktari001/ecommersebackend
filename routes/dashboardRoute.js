import express from 'express';
import {
    getDashboardStats,
    getSalesAnalytics,
    getTopProducts,
    getUserAnalytics,
    getInventoryAnalytics,
    getCategorySales,
    getRecentActivities
} from '../controllers/dashboardController.js';
import authMiddleware from '../middleware/auth.js';
import adminMiddleware from '../middleware/adminAuth.js';

const dashboardRouter = express.Router();

// All dashboard routes require admin authentication
dashboardRouter.get('/stats', authMiddleware, adminMiddleware, getDashboardStats);
dashboardRouter.get('/sales', authMiddleware, adminMiddleware, getSalesAnalytics);
dashboardRouter.get('/top-products', authMiddleware, adminMiddleware, getTopProducts);
dashboardRouter.get('/users', authMiddleware, adminMiddleware, getUserAnalytics);
dashboardRouter.get('/inventory', authMiddleware, adminMiddleware, getInventoryAnalytics);
dashboardRouter.get('/category-sales', authMiddleware, adminMiddleware, getCategorySales);
dashboardRouter.get('/recent-activities', authMiddleware, adminMiddleware, getRecentActivities);

export default dashboardRouter;