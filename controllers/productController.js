import { v2 as cloudinary } from 'cloudinary';
import prisma from '../config/prisma.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY
});

// ==================== HELPER FUNCTIONS ====================
const validateProductData = (data) => {
  const errors = [];

  if (!data.name || data.name.trim().length < 2) {
    errors.push('Product name must be at least 2 characters long');
  }

  if (!data.description || data.description.trim().length < 10) {
    errors.push('Product description must be at least 10 characters long');
  }

  if (!data.price || isNaN(data.price) || Number(data.price) <= 0) {
    errors.push('Valid price is required');
  }

  if (!data.category || !['Men', 'Women', 'Kids'].includes(data.category)) {
    errors.push('Valid category is required (Men, Women, or Kids)');
  }

  if (!data.subCategory || !['Topwear', 'Bottomwear', 'Winterwear'].includes(data.subCategory)) {
    errors.push('Valid sub-category is required');
  }

  return errors;
};

// ==================== ADD PRODUCT ====================
const addProduct = async (req, res) => {
  try {
    const { name, description, price, category, subCategory, sizes, bestseller } = req.body;

    console.log('--- ADD PRODUCT REQUEST ---');
    console.log('Body:', { name, description, price, category, subCategory, sizes, bestseller });
    console.log('Files:', req.files ? Object.keys(req.files) : 'No files');

    // Validate required fields
    if (!name || !description || !price || !category || !subCategory || !sizes) {
      console.log('Missing fields:', { name: !!name, description: !!description, price: !!price, category: !!category, subCategory: !!subCategory, sizes: !!sizes });
      return res.status(400).json({
        success: false,
        message: "All fields are required: name, description, price, category, subCategory, sizes"
      });
    }

    // Validate product data
    const validationErrors = validateProductData(req.body);
    if (validationErrors.length > 0) {
      console.log('Validation errors:', validationErrors);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors
      });
    }

    // Ensure req.files exists
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product image is required"
      });
    }

    // Extract images safely
    const image1 = req.files.image1?.[0];
    const image2 = req.files.image2?.[0];
    const image3 = req.files.image3?.[0];
    const image4 = req.files.image4?.[0];

    const images = [image1, image2, image3, image4].filter((item) => item !== undefined);

    // Upload images to Cloudinary with error handling
    let imagesUrl = [];
    try {
      imagesUrl = await Promise.all(
        images.map(async (item) => {
          const result = await cloudinary.uploader.upload(item.path, {
            resource_type: 'image',
            folder: 'products'
          });
          return result.secure_url;
        })
      );
    } catch (uploadError) {
      console.error('Cloudinary upload error:', uploadError);
      return res.status(500).json({
        success: false,
        message: "Failed to upload images to storage",
        error: uploadError.message
      });
    }

    // Parse sizes safely
    let parsedSizes = [];
    try {
      if (typeof sizes === 'string') {
        parsedSizes = JSON.parse(sizes);
      } else {
        parsedSizes = sizes;
      }

      if (!Array.isArray(parsedSizes)) {
        throw new Error('Sizes must be an array');
      }
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        message: "Invalid sizes format. Please provide a valid JSON array"
      });
    }

    // Create product in DB with images relation
    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price),
        category,
        subCategory,
        sizes: parsedSizes,
        isBestseller: bestseller === "true",
        images: {
          create: imagesUrl.map((url, index) => ({
            imageUrl: url,
            isPrimary: index === 0
          }))
        }
      },
      include: {
        images: true
      }
    });

    res.status(201).json({
      success: true,
      message: "Product added successfully",
      product: {
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category,
        images: product.images
      }
    });

  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error while adding product"
    });
  }
};

// ==================== LIST PRODUCTS ====================
const listProducts = async (req, res) => {
  try {
    const { category, subCategory, bestseller, page = 1, limit = 20 } = req.query;

    // Build filter
    const where = {};
    if (category) where.category = category;
    if (subCategory) where.subCategory = subCategory;
    if (bestseller === 'true') where.isBestseller = true;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalProducts = await prisma.product.count({ where });

    // Fetch products with pagination and images
    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        images: true
      }
    });

    res.json({
      success: true,
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalProducts / limit),
        totalProducts,
        hasNextPage: skip + products.length < totalProducts,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('List products error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching products"
    });
  }
};

// ==================== REMOVE PRODUCT ====================
const removeProduct = async (req, res) => {
  try {
    const productId = req.body.id || req.params.productId;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required"
      });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { images: true }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Delete images from Cloudinary
    if (product.images && product.images.length > 0) {
      try {
        await Promise.all(
          product.images.map(async (img) => {
            const publicId = img.imageUrl.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`products/${publicId}`);
          })
        );
      } catch (cloudinaryError) {
        console.warn('Could not delete images from Cloudinary:', cloudinaryError);
      }
    }

    await prisma.product.delete({
      where: { id: productId }
    });

    res.json({
      success: true,
      message: "Product removed successfully"
    });
  } catch (error) {
    console.error('Remove product error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error while removing product"
    });
  }
};

// ==================== SINGLE PRODUCT ====================
const singleProduct = async (req, res) => {
  try {
    const productId = req.body.productId || req.params.productId;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required"
      });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: true
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    res.json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Single product error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching product"
    });
  }
};

// ==================== UPDATE PRODUCT ====================
const updateProduct = async (req, res) => {
  try {
    const productId = req.params.productId;
    const updates = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required"
      });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { images: true }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    const dataToUpdate = {};

    // Handle image updates if new images are uploaded
    if (req.files && Object.keys(req.files).length > 0) {
      const image1 = req.files.image1?.[0];
      const image2 = req.files.image2?.[0];
      const image3 = req.files.image3?.[0];
      const image4 = req.files.image4?.[0];

      const newImages = [image1, image2, image3, image4].filter((item) => item !== undefined);

      if (newImages.length > 0) {
        const newImagesUrl = await Promise.all(
          newImages.map(async (item) => {
            const result = await cloudinary.uploader.upload(item.path, {
              resource_type: 'image',
              folder: 'products'
            });
            return result.secure_url;
          })
        );

        // For simplicity, we'll replace all images or append. 
        // Let's append but limit to 4.
        await prisma.productImage.createMany({
          data: newImagesUrl.map(url => ({
            productId,
            imageUrl: url,
            isPrimary: false
          }))
        });
      }
    }

    // Prepare update data
    if (updates.name) dataToUpdate.name = updates.name.trim();
    if (updates.description) dataToUpdate.description = updates.description.trim();
    if (updates.price) dataToUpdate.price = parseFloat(updates.price);
    if (updates.category) dataToUpdate.category = updates.category;
    if (updates.subCategory) dataToUpdate.subCategory = updates.subCategory;

    if (updates.sizes) {
      try {
        let parsedSizes = [];
        if (typeof updates.sizes === 'string') {
          parsedSizes = JSON.parse(updates.sizes);
        } else {
          parsedSizes = updates.sizes;
        }

        if (Array.isArray(parsedSizes)) {
          dataToUpdate.sizes = parsedSizes;
        }
      } catch (parseError) {
        return res.status(400).json({
          success: false,
          message: "Invalid sizes format"
        });
      }
    }

    if (updates.bestseller !== undefined) {
      dataToUpdate.isBestseller = updates.bestseller === "true";
    }

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: dataToUpdate,
      include: { images: true }
    });

    res.json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating product"
    });
  }
};

// ==================== GET BESTSELLERS ====================
const getBestsellers = async (req, res) => {
  try {
    const bestsellers = await prisma.product.findMany({
      where: { isBestseller: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { images: true }
    });

    res.json({
      success: true,
      products: bestsellers,
      count: bestsellers.length
    });
  } catch (error) {
    console.error('Get bestsellers error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching bestsellers"
    });
  }
};

export {
  listProducts,
  addProduct,
  removeProduct,
  singleProduct,
  updateProduct,
  getBestsellers
};
