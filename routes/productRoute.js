import express from 'express';
import { 
  listProducts, 
  addProduct, 
  removeProduct, 
  singleProduct,
  updateProduct,
  getBestsellers
} from '../controllers/productController.js';
import { productUpload, handleMulterError } from '../middleware/multer.js';
import adminAuth from '../middleware/adminAuth.js';

const productRouter = express.Router();

// ==================== PUBLIC ROUTES ====================
// Get all products (public access)
productRouter.get('/list', listProducts);

// Get single product info (public access)
productRouter.get('/:productId', singleProduct);

// Get bestseller products
productRouter.get('/bestseller/list', getBestsellers);

// ==================== ADMIN PROTECTED ROUTES ====================
// Add new product (admin only)
productRouter.post(
  '/add',
  adminAuth,
  productUpload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 }
  ]),
  handleMulterError,
  addProduct
);

// Update product (admin only)
productRouter.put(
  '/:productId',
  adminAuth,
  productUpload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 }
  ]),
  handleMulterError,
  updateProduct
);

// Remove product (admin only)
productRouter.delete('/:productId', adminAuth, removeProduct);

export default productRouter;