import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Create uploads directory if it doesn't exist
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Create subdirectories based on upload type
        let subfolder = 'general';
        
        if (req.baseUrl.includes('/api/product')) {
            subfolder = 'products';
        } else if (req.baseUrl.includes('/api/review')) {
            subfolder = 'reviews';
        } else if (req.baseUrl.includes('/api/user')) {
            subfolder = 'profiles';
        }
        
        const fullPath = path.join(uploadDir, subfolder);
        
        // Create subdirectory if it doesn't exist
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
        
        cb(null, fullPath);
    },
    filename: function (req, file, cb) {
        // Generate unique filename with timestamp and UUID
        const uniqueId = uuidv4();
        const timestamp = Date.now();
        const originalName = path.parse(file.originalname).name;
        const extension = path.extname(file.originalname).toLowerCase();
        
        // Sanitize filename (remove special characters, keep only alphanumeric, dash, underscore)
        const sanitizedName = originalName.replace(/[^a-zA-Z0-9-_]/g, '');
        
        const filename = `${sanitizedName}_${timestamp}_${uniqueId.slice(0, 8)}${extension}`;
        cb(null, filename);
    }
});

// File filter function
const fileFilter = (req, file, cb) => {
    // Allowed file types
    const allowedMimeTypes = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/svg+xml': 'svg'
    };
    
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    
    // Check MIME type
    const isValidMimeType = allowedMimeTypes[file.mimetype];
    
    // Check file extension
    const extension = path.extname(file.originalname).toLowerCase();
    const isValidExtension = allowedExtensions.includes(extension);
    
    // Validate both MIME type and extension
    if (isValidMimeType && isValidExtension) {
        // Additional validation for images
        if (file.mimetype.startsWith('image/')) {
            // Check file size based on upload type
            let maxSize = 5 * 1024 * 1024; // Default 5MB
            
            if (req.baseUrl.includes('/api/product')) {
                maxSize = 10 * 1024 * 1024; // 10MB for products
            } else if (req.baseUrl.includes('/api/review')) {
                maxSize = 5 * 1024 * 1024; // 5MB for reviews
            } else if (req.baseUrl.includes('/api/user')) {
                maxSize = 2 * 1024 * 1024; // 2MB for profiles
            }
            
            if (file.size > maxSize) {
                const maxSizeMB = maxSize / (1024 * 1024);
                return cb(new Error(`File size exceeds ${maxSizeMB}MB limit`), false);
            }
            
            // Additional check for potentially malicious files
            if (file.originalname.includes('..') || file.originalname.includes('/')) {
                return cb(new Error('Invalid filename'), false);
            }
            
            return cb(null, true);
        }
    }
    
    // Reject file if not valid
    cb(new Error(`Invalid file type. Allowed types: ${allowedExtensions.join(', ')}`), false);
};

// Error handling middleware
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // Multer-specific errors
        let message = 'File upload error';
        
        switch (err.code) {
            case 'LIMIT_FILE_SIZE':
                message = 'File size is too large';
                break;
            case 'LIMIT_FILE_COUNT':
                message = 'Too many files uploaded';
                break;
            case 'LIMIT_UNEXPECTED_FILE':
                message = 'Unexpected field in file upload';
                break;
            case 'LIMIT_PART_COUNT':
                message = 'Too many parts in the request';
                break;
            case 'LIMIT_FIELD_KEY':
                message = 'Field name is too long';
                break;
            case 'LIMIT_FIELD_VALUE':
                message = 'Field value is too long';
                break;
            case 'LIMIT_FIELD_COUNT':
                message = 'Too many fields in the request';
                break;
            default:
                message = `File upload error: ${err.message}`;
        }
        
        return res.status(400).json({
            success: false,
            message: message
        });
    } else if (err) {
        // Other errors (like fileFilter errors)
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
    
    next();
};

// Configure different upload instances for different use cases
const createUpload = (options = {}) => {
    const defaultOptions = {
        storage: storage,
        fileFilter: fileFilter,
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB default
            files: 10 // Maximum number of files
        }
    };
    
    // Merge with custom options
    const mergedOptions = { ...defaultOptions, ...options };
    
    return multer(mergedOptions);
};

// Pre-configured upload instances for different use cases
const upload = createUpload();

// For product uploads (multiple images, larger size)
const productUpload = createUpload({
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
        files: 4 // Maximum 4 images per product
    }
});

// For review uploads
const reviewUpload = createUpload({
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB per file
        files: 4 // Maximum 4 images per review
    }
});

// For profile uploads (single image, smaller size)
const profileUpload = createUpload({
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB per file
        files: 1 // Only one profile image
    }
});

// Middleware to clean up uploaded files on error
const cleanupUploadsOnError = (req, res, next) => {
    // Store original send function
    const originalSend = res.send;
    
    // Override send function
    res.send = function(data) {
        // If response indicates error (status >= 400), clean up uploaded files
        if (res.statusCode >= 400 && req.files) {
            Object.values(req.files).forEach(fileArray => {
                if (Array.isArray(fileArray)) {
                    fileArray.forEach(file => {
                        if (file.path && fs.existsSync(file.path)) {
                            fs.unlink(file.path, (err) => {
                                if (err) console.error('Error deleting file:', err);
                            });
                        }
                    });
                } else if (req.files.path && fs.existsSync(req.files.path)) {
                    fs.unlink(req.files.path, (err) => {
                        if (err) console.error('Error deleting file:', err);
                    });
                }
            });
        }
        
        // Call original send
        return originalSend.call(this, data);
    };
    
    next();
};

// Function to clean up files manually
const cleanupFiles = (filePaths) => {
    if (!Array.isArray(filePaths)) {
        filePaths = [filePaths];
    }
    
    filePaths.forEach(filePath => {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }
    });
};

export default upload;
export {
    upload,
    productUpload,
    reviewUpload,
    profileUpload,
    handleMulterError,
    cleanupUploadsOnError,
    cleanupFiles
};