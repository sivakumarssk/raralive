const express = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { uploadProfile } = require('../middleware/upload.middleware');

const router = express.Router();

// Public
router.get('/username-available', authController.checkUsername);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/login-otp/send', authController.sendLoginOtp);
router.post('/login-otp/verify', authController.verifyLoginOtp);
router.post('/verify-otp', authController.verifyOtp);
router.post('/resend-otp', authController.resendOtp);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-otp', authController.verifyResetOtp);
router.post('/reset-password', authController.resetPassword);

// Protected
router.get('/me', authenticate, authController.getMe);
router.post('/logout-all', authenticate, authController.logoutAllDevices);
router.patch('/profile', authenticate, uploadProfile.fields([{ name: 'avatar', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), authController.completeProfile);
router.patch('/language', authenticate, authController.setLanguage);

// Public user profile
router.get('/users/:userId', authController.getPublicUser);

// Follow / unfollow
router.post('/follow/:userId',   authenticate, authController.followUser);
router.delete('/follow/:userId', authenticate, authController.unfollowUser);
router.get('/follow/:userId',    authenticate, authController.checkFollow);

// Report a user
router.post('/users/:userId/report', authenticate, authController.reportUser);

module.exports = router;
