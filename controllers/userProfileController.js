// controllers/userProfileController.js
import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_SECRET_KEY
});

// ---------------------- GET USER PROFILE ----------------------
const getUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        console.log('👤 Fetching user profile for:', userId);

        console.time(`ProfileQuery-${userId}`);
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                addresses: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });
        console.timeEnd(`ProfileQuery-${userId}`);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Format for frontend (return the first address as 'address')
        const formattedUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            isAdmin: user.isAdmin,
            profileImage: user.profileImage,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            address: user.addresses && user.addresses.length > 0 ? user.addresses[0] : null
        };

        res.json({
            success: true,
            user: formattedUser
        });
    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch user profile"
        });
    }
};

// ---------------------- UPDATE USER PROFILE ----------------------
const updateUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, email, phone, address } = req.body;

        console.log('🔄 Updating user profile for:', userId);

        // Update basic info
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData
        });

        // Update address if provided (Upsert the first address)
        if (address) {
            const existingAddress = await prisma.userAddress.findFirst({
                where: { userId },
                orderBy: { createdAt: 'desc' }
            });

            if (existingAddress) {
                await prisma.userAddress.update({
                    where: { id: existingAddress.id },
                    data: {
                        street: address.street || existingAddress.street,
                        city: address.city || existingAddress.city,
                        county: address.county || existingAddress.county,
                        country: address.country || existingAddress.country
                    }
                });
            } else {
                await prisma.userAddress.create({
                    data: {
                        userId,
                        street: address.street || "",
                        city: address.city || "",
                        county: address.county || "",
                        country: address.country || "Kenya"
                    }
                });
            }
        }

        // Fetch full updated profile
        const fullUser = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                addresses: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        const formattedUser = {
            id: fullUser.id,
            name: fullUser.name,
            email: fullUser.email,
            phone: fullUser.phone,
            isAdmin: fullUser.isAdmin,
            profileImage: fullUser.profileImage,
            address: fullUser.addresses && fullUser.addresses.length > 0 ? fullUser.addresses[0] : null
        };

        res.json({
            success: true,
            message: "Profile updated successfully",
            user: formattedUser
        });
    } catch (error) {
        console.error('Update profile error:', error);

        if (error.code === 'P2002') {
            return res.status(409).json({
                success: false,
                message: "Email already exists"
            });
        }

        res.status(500).json({
            success: false,
            message: error.message || "Failed to update profile"
        });
    }
};

// ---------------------- UPLOAD PROFILE IMAGE ----------------------
const uploadProfileImage = async (req, res) => {
    try {
        const userId = req.user.id;

        console.log('📸 Uploading profile image for user:', userId);

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No image file provided"
            });
        }

        // Find user to get current image
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Delete old image from Cloudinary if exists
        if (user.profileImage) {
            try {
                const urlParts = user.profileImage.split('/');
                const filename = urlParts[urlParts.length - 1];
                const publicId = `profile_images/${filename.split('.')[0]}`;

                await cloudinary.uploader.destroy(publicId);
            } catch (cloudinaryError) {
                console.warn('Could not delete old image:', cloudinaryError.message);
            }
        }

        // Upload new image to Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'profile_images',
            width: 500,
            height: 500,
            crop: 'fill',
            gravity: 'face',
            quality: 'auto:good',
            format: 'webp'
        });

        // Update user with new image URL
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { profileImage: result.secure_url },
            include: {
                addresses: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        const formattedUser = {
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            phone: updatedUser.phone,
            isAdmin: updatedUser.isAdmin,
            profileImage: updatedUser.profileImage,
            address: updatedUser.addresses && updatedUser.addresses.length > 0 ? updatedUser.addresses[0] : null
        };

        res.json({
            success: true,
            message: "Profile image updated successfully",
            imageUrl: result.secure_url,
            user: formattedUser
        });
    } catch (error) {
        console.error('Upload profile image error:', error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to upload profile image"
        });
    }
};

// ---------------------- CHANGE PASSWORD ----------------------
const changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        console.log('🔐 Changing password for user:', userId);

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required"
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 8 characters"
            });
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        res.json({
            success: true,
            message: "Password changed successfully"
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to change password"
        });
    }
};

// ---------------------- DELETE PROFILE IMAGE ----------------------
const deleteProfileImage = async (req, res) => {
    try {
        const userId = req.user.id;

        console.log('🗑️ Deleting profile image for user:', userId);

        // Find user
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (!user.profileImage) {
            return res.status(400).json({
                success: false,
                message: "No profile image to delete"
            });
        }

        // Delete image from Cloudinary
        try {
            const urlParts = user.profileImage.split('/');
            const filename = urlParts[urlParts.length - 1];
            const publicId = `profile_images/${filename.split('.')[0]}`;

            await cloudinary.uploader.destroy(publicId);
        } catch (cloudinaryError) {
            console.warn('Could not delete from Cloudinary:', cloudinaryError.message);
        }

        // Remove image URL from user
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { profileImage: "" },
            include: {
                addresses: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        const formattedUser = {
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            phone: updatedUser.phone,
            isAdmin: updatedUser.isAdmin,
            profileImage: updatedUser.profileImage,
            address: updatedUser.addresses && updatedUser.addresses.length > 0 ? updatedUser.addresses[0] : null
        };

        res.json({
            success: true,
            message: "Profile image deleted successfully",
            user: formattedUser
        });
    } catch (error) {
        console.error('Delete profile image error:', error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to delete profile image"
        });
    }
};

export {
    getUserProfile,
    updateUserProfile,
    uploadProfileImage,
    changePassword,
    deleteProfileImage
};
