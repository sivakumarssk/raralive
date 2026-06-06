const express = require('express');
const { RtcTokenBuilder, RtcRole } = require('agora-token');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

const APP_ID = '95876516c6294152abaffa43ec4bb40d';
const APP_CERTIFICATE = '865b39114b5544ea902aeaa52c0c3f60';
const TOKEN_EXPIRY_SECONDS = 3600; // 1 hour

// POST /api/agora/token  { channelName, uid }
router.post('/token', authenticate, (req, res) => {
  const { channelName, uid } = req.body;
  if (!channelName || uid === undefined) {
    return res.status(400).json({ success: false, message: 'channelName and uid are required' });
  }

  try {
    const expireTime = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS;
    // uid=0 generates a wildcard token valid for any uid in this channel
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      0,
      RtcRole.PUBLISHER,
      expireTime,
      expireTime
    );
    return res.json({ success: true, token });
  } catch (e) {
    console.error('[Agora token]', e);
    return res.status(500).json({ success: false, message: 'Token generation failed' });
  }
});

// POST /api/agora/log  { channelId, userId, joinedAt, leftAt, durationSeconds }
router.post('/log', authenticate, (req, res) => {
  const { channelId, userId, joinedAt, leftAt, durationSeconds } = req.body;
  const ts = new Date().toISOString();
  console.log(
    `[Agora Session] ${ts} | channel=${channelId} user=${userId}` +
    ` | joined=${joinedAt} left=${leftAt} duration=${durationSeconds}s`
  );
  // Future: persist to DB for billing/analytics
  return res.json({ success: true });
});

module.exports = router;
