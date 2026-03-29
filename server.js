import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import prisma from './config/prisma.js';
import connectCloudinary from './config/cloudinary.js';
import userRouter from './routes/userRoute.js';
import productRouter from './routes/productRoute.js';
import cartRouter from './routes/cartRoute.js';
import orderRouter from './routes/orderRoute.js';
import dashboardRouter from './routes/dashboardRoute.js';
import userProfileRouter from './routes/userProfileRoute.js';
import reviewRoute from './routes/reviewRoute.js';
import paymentRouter from './routes/paymentRoutes.js';
import { cleanupUploadsOnError } from './middleware/multer.js';
import helmet from 'helmet';
import { apiLimiter } from './middleware/rateLimiter.js';

// App config
const app = express();
const port = process.env.PORT || 4000;

// Middlewares
app.use(helmet());
app.use(apiLimiter);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Clean up uploaded files on error
app.use(cleanupUploadsOnError);

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  // Log request start
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl} - Started`);

  // Override res.json to log response time
  const originalJson = res.json;
  res.json = function (data) {
    const responseTime = Date.now() - startTime;
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl} - ${res.statusCode} - ${responseTime}ms`);
    return originalJson.call(this, data);
  };

  next();
});

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'E-commerce API',
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'E-commerce API v1.0.0',
    documentation: {
      authentication: 'All routes except public ones require Bearer token',
      endpoints: {
        auth: {
          user: {
            'POST /api/user/register': 'Register new user',
            'POST /api/user/login': 'User login',
            'POST /api/user/admin-login': 'Admin login',
            'POST /api/user/verify-token': 'Verify token validity',
            'GET /api/user/me': 'Get current user (authenticated)'
          }
        },
        products: {
          'GET /api/product/list': 'List all products',
          'GET /api/product/:productId': 'Get single product',
          'GET /api/product/bestseller/list': 'Get bestseller products',
          'POST /api/product/add': 'Add product (admin only)',
          'PUT /api/product/:productId': 'Update product (admin only)',
          'DELETE /api/product/:productId': 'Delete product (admin only)'
        },
        cart: {
          'POST /api/cart/add': 'Add to cart',
          'POST /api/cart/update': 'Update cart',
          'POST /api/cart/get': 'Get cart data',
          'POST /api/cart/remove': 'Remove from cart'
        },
        orders: {
          'POST /api/order/place': 'Place order',
          'POST /api/order/user': 'Get user orders',
          'GET /api/order/all': 'Get all orders (admin)',
          'PUT /api/order/status': 'Update order status (admin)'
        },
        reviews: {
          'GET /api/review/product/:productId': 'Get product reviews',
          'GET /api/review/user': 'Get user reviews (authenticated)',
          'GET /api/review/reviewable-orders': 'Get reviewable orders (authenticated)',
          'POST /api/review/submit': 'Submit review (authenticated)',
          'GET /api/review/admin/all': 'Get all reviews (admin)'
        },
        user_profile: {
          'GET /api/user-profile/profile': 'Get user profile',
          'PUT /api/user-profile/profile': 'Update profile',
          'POST /api/user-profile/profile/image': 'Upload profile image',
          'DELETE /api/user-profile/profile/image': 'Delete profile image',
          'POST /api/user-profile/change-password': 'Change password'
        },
        dashboard: {
          'GET /api/dashboard/stats': 'Dashboard statistics (admin)',
          'GET /api/dashboard/sales': 'Sales analytics (admin)',
          'GET /api/dashboard/top-products': 'Top products (admin)',
          'GET /api/dashboard/users': 'User analytics (admin)',
          'GET /api/dashboard/inventory': 'Inventory analytics (admin)'
        }
      }
    }
  });
});

// API endpoints
app.use('/api/user', userRouter);
app.use('/api/product', productRouter);
app.use('/api/cart', cartRouter);
app.use('/api/order', orderRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/user-profile', userProfileRouter);
app.use('/api/review', reviewRoute);
app.use('/api/payment', paymentRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'E-commerce API is working! 🚀',
    status: 'online',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: port,
    docs: '/api',
    health: '/health'
  });
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    suggestion: 'Check /api for available endpoints',
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('🚨 Global Error Handler:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message: message,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      path: req.path
    })
  });
});

// Start server with proper error handling
const startServer = async () => {
  try {
    // Check Prisma connection
    await prisma.$connect();
    console.log('✅ PostgreSQL (via Prisma) connected successfully');

    // Connect to Cloudinary
    await connectCloudinary();
    console.log('✅ Cloudinary connected successfully');

    // Start listening
    const server = app.listen(port, () => {
      console.log(`✅ Server started successfully on port ${port}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Local: http://localhost:${port}`);
      console.log(`📊 Health check: http://localhost:${port}/health`);
      console.log(`📚 API docs: http://localhost:${port}/api`);

      // Log all registered routes
      console.log('\n📦 Registered API Routes:');
      console.log('='.repeat(50));

      const routes = [];
      const collectRoutes = (middleware, path = '') => {
        if (middleware.route) {
          const methods = Object.keys(middleware.route.methods).join(', ').toUpperCase();
          routes.push(`${methods.padEnd(8)} ${path}${middleware.route.path}`);
        } else if (middleware.name === 'router') {
          middleware.handle.stack.forEach(handler => {
            collectRoutes(handler, path);
          });
        }
      };

      app._router.stack.forEach(middleware => {
        if (middleware.name === 'router') {
          const routePath = middleware.regexp.toString()
            .replace('/^', '')
            .replace('\\/?(?=\\/|$)/i', '')
            .replace(/\\\//g, '/')
            .replace('(?:', '')
            .replace(')?', '');

          middleware.handle.stack.forEach(handler => {
            collectRoutes(handler, routePath);
          });
        } else if (middleware.route) {
          const methods = Object.keys(middleware.route.methods).join(', ').toUpperCase();
          routes.push(`${methods.padEnd(8)} ${middleware.route.path}`);
        }
      });

      routes.sort().forEach(route => console.log(`   ${route}`));
      console.log('='.repeat(50));
    });

    // Handle graceful shutdown
    const gracefulShutdown = (signal) => {
      console.log(`\n${signal} received, shutting down gracefully...`);

      server.close(() => {
        console.log('✅ HTTP server closed');

        // Close database connections
        prisma.$disconnect().then(() => {
          console.log('✅ Prisma disconnected');
          console.log('✅ Service shutdown complete');
          process.exit(0);
        });
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('❌ Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    // Handle signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  // Perform cleanup if needed
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
startServer();

// Export for testing
export default app;