import express from 'express';
import {
    getUserProfile,
    updateUserProfile,
    uploadProfileImage,
    changePassword,
    deleteProfileImage
} from '../controllers/userProfileController.js';
import authUser from '../middleware/auth.js';
import { profileUpload, handleMulterError } from '../middleware/multer.js';

const userProfileRouter = express.Router();

// All routes require authentication
userProfileRouter.get('/profile', authUser, getUserProfile);
userProfileRouter.put('/profile', authUser, updateUserProfile);
userProfileRouter.post('/profile/image', 
    authUser, 
    profileUpload.single('profileImage'), 
    handleMulterError,
    uploadProfileImage
);
userProfileRouter.delete('/profile/image', authUser, deleteProfileImage);
userProfileRouter.post('/change-password', authUser, changePassword);

export default userProfileRouter;