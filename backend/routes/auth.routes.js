const express = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { uploadProfile } = require('../middleware/upload.middleware');

const router = express.Router();

// Public
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-otp', authController.verifyOtp);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-otp', authController.verifyResetOtp);
router.post('/reset-password', authController.resetPassword);

// Protected
router.get('/me', authenticate, authController.getMe);
router.patch('/profile', authenticate, uploadProfile.fields([{ name: 'avatar', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), authController.completeProfile);
router.patch('/language', authenticate, authController.setLanguage);

// Follow / unfollow
router.post('/follow/:userId',   authenticate, authController.followUser);
router.delete('/follow/:userId', authenticate, authController.unfollowUser);
router.get('/follow/:userId',    authenticate, authController.checkFollow);

module.exports = router;
