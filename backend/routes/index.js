const express = require('express');
const authRoutes = require('./auth.routes');
const adminRoutes = require('./admin.routes');
const agencyRoutes = require('./agency.routes');
const agencyAuthRoutes = require('./agency-auth.routes');
const roomAdminRoutes = require('./room.routes');
const roomsRoutes = require('./rooms.routes');
const agoraRoutes = require('./agora.routes');
const giftRoutes = require('./gift.routes');
const coinPackageRoutes = require('./coin-package.routes');
const walletRoutes = require('./wallet.routes');
const shopGiftRoutes = require('./shop-gift.routes');
const taskRoutes = require('./task.routes');
const postRoutes = require('./post.routes');
const battleRoutes = require('./battle.routes');
const bannerRoutes = require('./banner.routes');
const friendZoneRoutes = require('./friend-zone.routes');
const chatRoutes = require('./chat.routes');
const goLiveRoutes = require('./go-live.routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Rara Live API is running.' });
});

// Temporary debug route for diagnosing Friend Zone presence sync.
router.get('/debug/fz-presence', (req, res) => {
  const { debugFriendZonePresence } = require('../socket');
  res.json({ success: true, data: debugFriendZonePresence() });
});

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/admin/agencies', agencyRoutes);
router.use('/admin/rooms', roomAdminRoutes);
router.use('/admin/gifts', giftRoutes);
router.use('/rooms', roomsRoutes);
router.use('/agency', agencyAuthRoutes);
router.use('/agora', agoraRoutes);
router.use('/gifts', giftRoutes);
router.use('/admin/coin-packages', coinPackageRoutes);
router.use('/coin-packages', coinPackageRoutes);
router.use('/admin/wallet', walletRoutes);
router.use('/wallet', walletRoutes);
router.use('/admin/shop-gifts', shopGiftRoutes);
router.use('/shop-gifts', shopGiftRoutes);
router.use('/tasks', taskRoutes);
router.use('/posts', postRoutes);
router.use('/battle', battleRoutes);
router.use('/banners', bannerRoutes);
router.use('/friend-zone', friendZoneRoutes);
router.use('/chat', chatRoutes);
router.use('/go-live', goLiveRoutes);

module.exports = router;
