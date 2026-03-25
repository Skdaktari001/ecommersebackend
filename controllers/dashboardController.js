import prisma from "../config/prisma.js";

// ==================== DASHBOARD OVERVIEW ====================
const getDashboardStats = async (req, res) => {
    try {
        console.log('📊 Fetching dashboard stats');

        const today = new Date();
        const startOfToday = new Date(today.setHours(0, 0, 0, 0));

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const startOfWeek = new Date(weekAgo.setHours(0, 0, 0, 0));

        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        const startOfMonth = new Date(monthAgo.setHours(0, 0, 0, 0));

        // Total counts
        const totalOrders = await prisma.order.count();
        const totalUsers = await prisma.user.count();
        const totalProducts = await prisma.product.count();

        // Today's stats
        const todayOrders = await prisma.order.count({
            where: { createdAt: { gte: startOfToday } }
        });
        const todayRevenue = await getRevenueForPeriod(startOfToday);
        const todayUsers = await prisma.user.count({
            where: { createdAt: { gte: startOfToday } }
        });

        // This week's stats
        const weekOrders = await prisma.order.count({
            where: { createdAt: { gte: startOfWeek } }
        });
        const weekRevenue = await getRevenueForPeriod(startOfWeek);

        // This month's stats
        const monthOrders = await prisma.order.count({
            where: { createdAt: { gte: startOfMonth } }
        });
        const monthRevenue = await getRevenueForPeriod(startOfMonth);

        // Order status breakdown (Enums are lowercase in new schema)
        const pendingOrders = await prisma.order.count({ where: { status: 'pending' } });
        const shippedOrders = await prisma.order.count({ where: { status: 'shipped' } });
        const deliveredOrders = await prisma.order.count({ where: { status: 'delivered' } });
        const cancelledOrders = await prisma.order.count({ where: { status: 'cancelled' } });

        // Payment stats
        const paidOrders = await prisma.order.count({ where: { isPaid: true } });
        const unpaidOrders = await prisma.order.count({ where: { isPaid: false } });

        // Average order value
        const revenueAggregate = await prisma.order.aggregate({
            _sum: {
                totalAmount: true
            }
        });
        const totalRevenue = revenueAggregate._sum.totalAmount || 0;
        const averageOrderValue = totalOrders > 0 ? (Number(totalRevenue) / totalOrders).toFixed(2) : 0;

        res.json({
            success: true,
            stats: {
                totals: {
                    revenue: Number(totalRevenue),
                    orders: totalOrders,
                    users: totalUsers,
                    products: totalProducts,
                    averageOrderValue: parseFloat(averageOrderValue)
                },
                today: {
                    revenue: Number(todayRevenue),
                    orders: todayOrders,
                    newUsers: todayUsers
                },
                thisWeek: {
                    revenue: Number(weekRevenue),
                    orders: weekOrders
                },
                thisMonth: {
                    revenue: Number(monthRevenue),
                    orders: monthOrders
                },
                orderStatus: {
                    pending: pendingOrders,
                    packing: 0, // Not in enum anymore, mapped to pending
                    shipped: shippedOrders,
                    delivered: deliveredOrders,
                    cancelled: cancelledOrders
                },
                paymentStatus: {
                    paid: paidOrders,
                    unpaid: unpaidOrders
                }
            }
        });
    } catch (error) {
        console.error('❌ Dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch dashboard stats"
        });
    }
};

// Helper function to calculate revenue for a period
const getRevenueForPeriod = async (startDate) => {
    try {
        const result = await prisma.order.aggregate({
            where: {
                createdAt: { gte: startDate }
            },
            _sum: {
                totalAmount: true
            }
        });
        return result._sum.totalAmount || 0;
    } catch (error) {
        console.error('Revenue calculation error:', error);
        return 0;
    }
};

// ==================== SALES ANALYTICS ====================
const getSalesAnalytics = async (req, res) => {
    try {
        const { period = 'month' } = req.query; // day, week, month, year

        console.log(`📈 Fetching sales analytics for period: ${period}`);

        let salesData = [];
        const now = new Date();

        if (period === 'day') {
            // Last 24 hours by hour
            for (let i = 23; i >= 0; i--) {
                const hourStart = new Date();
                hourStart.setHours(now.getHours() - i, 0, 0, 0);
                const hourEnd = new Date(hourStart);
                hourEnd.setHours(hourStart.getHours() + 1);

                const stats = await prisma.order.aggregate({
                    where: {
                        createdAt: { gte: hourStart, lt: hourEnd }
                    },
                    _count: { _all: true },
                    _sum: { totalAmount: true }
                });

                salesData.push({
                    period: hourStart.getHours().toString().padStart(2, '0') + ':00',
                    orders: stats._count._all,
                    revenue: Number(stats._sum.totalAmount || 0)
                });
            }
        } else if (period === 'week') {
            // Last 7 days
            for (let i = 6; i >= 0; i--) {
                const dayStart = new Date();
                dayStart.setDate(now.getDate() - i);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(dayStart);
                dayEnd.setDate(dayStart.getDate() + 1);

                const stats = await prisma.order.aggregate({
                    where: {
                        createdAt: { gte: dayStart, lt: dayEnd }
                    },
                    _count: { _all: true },
                    _sum: { totalAmount: true }
                });

                salesData.push({
                    period: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
                    orders: stats._count._all,
                    revenue: Number(stats._sum.totalAmount || 0)
                });
            }
        } else if (period === 'month') {
            // Last 30 days
            for (let i = 29; i >= 0; i--) {
                const dayStart = new Date();
                dayStart.setDate(now.getDate() - i);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(dayStart);
                dayEnd.setDate(dayStart.getDate() + 1);

                const stats = await prisma.order.aggregate({
                    where: {
                        createdAt: { gte: dayStart, lt: dayEnd }
                    },
                    _count: { _all: true },
                    _sum: { totalAmount: true }
                });

                salesData.push({
                    period: dayStart.getDate().toString(),
                    orders: stats._count._all,
                    revenue: Number(stats._sum.totalAmount || 0)
                });
            }
        } else if (period === 'year') {
            // Last 12 months
            for (let i = 11; i >= 0; i--) {
                const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

                const stats = await prisma.order.aggregate({
                    where: {
                        createdAt: { gte: monthStart, lt: monthEnd }
                    },
                    _count: { _all: true },
                    _sum: { totalAmount: true }
                });

                salesData.push({
                    period: monthStart.toLocaleDateString('en-US', { month: 'short' }),
                    orders: stats._count._all,
                    revenue: Number(stats._sum.totalAmount || 0)
                });
            }
        }

        res.json({
            success: true,
            period: period,
            analytics: salesData
        });
    } catch (error) {
        console.error('❌ Sales analytics error:', error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch sales analytics"
        });
    }
};

// ==================== TOP PRODUCTS ====================
const getTopProducts = async (req, res) => {
    try {
        console.log('🏆 Fetching top products');

        // Aggregate product sales from order items
        const topSoldProducts = await prisma.orderItem.groupBy({
            by: ['productId'],
            _sum: {
                quantity: true,
                price: true // This is per item price, we need to calculate revenue
            },
            orderBy: {
                _sum: {
                    quantity: 'desc'
                }
            },
            take: 10
        });

        // Enrich with product details
        const enrichedProducts = await Promise.all(
            topSoldProducts.map(async (item) => {
                const product = await prisma.product.findUnique({
                    where: { id: item.productId },
                    include: { images: true }
                });

                // Calculate revenue specifically for this product
                const revenue = await prisma.orderItem.aggregate({
                    where: { productId: item.productId },
                    _sum: {
                        price: true,
                        quantity: true
                    }
                });

                // Note: Since price can vary or be specific to order item, we use order items for revenue
                const items = await prisma.orderItem.findMany({
                    where: { productId: item.productId }
                });
                const totalRevenue = items.reduce((acc, curr) => acc + (Number(curr.price) * curr.quantity), 0);

                return {
                    productId: item.productId,
                    name: product?.name || 'Unknown Product',
                    totalSold: item._sum.quantity || 0,
                    totalRevenue: totalRevenue,
                    images: product?.images || [],
                    price: Number(product?.price) || 0,
                    category: product?.category || 'Unknown',
                    isBestseller: product?.isBestseller || false
                };
            })
        );

        res.json({
            success: true,
            products: enrichedProducts
        });
    } catch (error) {
        console.error('❌ Top products error:', error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch top products"
        });
    }
};

// ==================== USER ANALYTICS ====================
const getUserAnalytics = async (req, res) => {
    try {
        console.log('👥 Fetching user analytics');

        const totalUsers = await prisma.user.count();
        const adminUsers = await prisma.user.count({ where: { isAdmin: true } });
        const regularUsers = totalUsers - adminUsers;

        // Get user signups over time
        const now = new Date();
        const signupsByDay = [];

        for (let i = 6; i >= 0; i--) {
            const dayStart = new Date();
            dayStart.setDate(now.getDate() - i);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayStart.getDate() + 1);

            const signups = await prisma.user.count({
                where: {
                    createdAt: { gte: dayStart, lt: dayEnd }
                }
            });

            signupsByDay.push({
                date: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
                count: signups
            });
        }

        // Get recent signups
        const recentSignups = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                id: true,
                name: true,
                email: true,
                isAdmin: true,
                createdAt: true,
                profileImage: true
            }
        });

        res.json({
            success: true,
            analytics: {
                total: totalUsers,
                admins: adminUsers,
                regular: regularUsers,
                signupsByDay: signupsByDay
            },
            recentSignups: recentSignups
        });
    } catch (error) {
        console.error('❌ User analytics error:', error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch user analytics"
        });
    }
};

// ==================== INVENTORY ANALYTICS ====================
const getInventoryAnalytics = async (req, res) => {
    try {
        console.log('📦 Fetching inventory analytics');

        const totalProducts = await prisma.product.count();

        // Get products by category
        const productsByCategory = await prisma.product.groupBy({
            by: ['category'],
            _count: {
                _all: true
            },
            _avg: {
                price: true
            }
        });

        // Format
        const formattedByCategory = productsByCategory.map(item => ({
            _id: item.category,
            count: item._count._all,
            averagePrice: Number(item._avg.price || 0)
        }));

        // Get bestsellers
        const bestsellers = await prisma.product.count({ where: { isBestseller: true } });

        // Get recent products
        const recentProducts = await prisma.product.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { images: true }
        });

        // Get low stock alerts (placeholder)
        const lowStockProducts = await prisma.product.findMany({
            take: 5,
            include: { images: true }
        });

        res.json({
            success: true,
            analytics: {
                totalProducts: totalProducts,
                bestsellers: bestsellers,
                byCategory: formattedByCategory
            },
            recentProducts: recentProducts,
            lowStockAlerts: lowStockProducts
        });
    } catch (error) {
        console.error('❌ Inventory analytics error:', error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch inventory analytics"
        });
    }
};

// ==================== CATEGORY SALES ====================
const getCategorySales = async (req, res) => {
    try {
        console.log('📊 Fetching category sales');

        const orderItems = await prisma.orderItem.findMany({
            include: {
                product: {
                    select: { category: true }
                }
            }
        });

        const categorySales = {};

        // Aggregate sales by category
        orderItems.forEach(item => {
            const category = item.product?.category || 'Uncategorized';

            if (!categorySales[category]) {
                categorySales[category] = {
                    category: category,
                    totalRevenue: 0,
                    totalItems: 0,
                    orders: new Set()
                };
            }

            categorySales[category].totalRevenue += Number(item.price) * item.quantity;
            categorySales[category].totalItems += item.quantity;
            categorySales[category].orders.add(item.orderId);
        });

        // Convert to array and format
        const salesByCategory = Object.values(categorySales).map(item => ({
            category: item.category,
            totalRevenue: item.totalRevenue,
            totalItems: item.totalItems,
            orders: item.orders.size
        })).sort((a, b) => b.totalRevenue - a.totalRevenue);

        res.json({
            success: true,
            salesByCategory: salesByCategory
        });
    } catch (error) {
        console.error('❌ Category sales error:', error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch category sales"
        });
    }
};

// ==================== RECENT ACTIVITIES ====================
const getRecentActivities = async (req, res) => {
    try {
        console.log('📝 Fetching recent activities');

        // Get recent orders
        const recentOrders = await prisma.order.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        });

        // Get recent signups
        const recentSignups = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                name: true,
                email: true,
                createdAt: true
            }
        });

        // Get recent products
        const recentProducts = await prisma.product.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                id: true,
                name: true,
                price: true,
                category: true,
                createdAt: true
            }
        });

        // Format activities
        const activities = [];

        // Add orders as activities
        recentOrders.forEach(order => {
            activities.push({
                type: 'order',
                title: 'New Order',
                description: `Order #${order.id.slice(-6)} placed`,
                user: order.user?.name || 'Customer',
                amount: Number(order.totalAmount),
                date: order.createdAt,
                status: order.status
            });
        });

        // Add signups as activities
        recentSignups.forEach(user => {
            activities.push({
                type: 'signup',
                title: 'New User',
                description: `${user.name} signed up`,
                user: user.name,
                email: user.email,
                date: user.createdAt
            });
        });

        // Add products as activities
        recentProducts.forEach(product => {
            activities.push({
                type: 'product',
                title: 'New Product',
                description: `${product.name} added`,
                category: product.category,
                price: Number(product.price),
                date: product.createdAt
            });
        });

        // Sort by date
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({
            success: true,
            activities: activities.slice(0, 20) // Limit to 20 activities
        });
    } catch (error) {
        console.error('❌ Recent activities error:', error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch recent activities"
        });
    }
};

export {
    getDashboardStats,
    getSalesAnalytics,
    getTopProducts,
    getUserAnalytics,
    getInventoryAnalytics,
    getCategorySales,
    getRecentActivities
};
