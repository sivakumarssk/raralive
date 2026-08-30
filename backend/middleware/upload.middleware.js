const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

function makeStorage(folder, prefix) {
  const dir = path.join(__dirname, '..', 'uploads', folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination(_req, _file, cb) { cb(null, dir); },
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname) || '.png';
      const unique = crypto.randomBytes(12).toString('hex');
      cb(null, `${prefix}_${unique}${ext}`);
    },
  });
}

// Avatar upload — any image type
const upload = multer({
  storage: makeStorage('avatars', 'avatar'),
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Gift bar upload — PNG only (small icons in the gift bar)
const uploadGift = multer({
  storage: makeStorage('gifts', 'gift'),
  fileFilter(_req, file, cb) {
    if (file.mimetype === 'image/png') cb(null, true);
    else cb(new Error('Only PNG images are allowed for gifts.'));
  },
  limits: { fileSize: 2 * 1024 * 1024 },
});

// Gift shop upload — PNG or GIF (shop modal supports animated gifts)
const uploadShopGift = multer({
  storage: makeStorage('shop-gifts', 'shopgift'),
  fileFilter(_req, file, cb) {
    if (file.mimetype === 'image/png' || file.mimetype === 'image/gif') cb(null, true);
    else cb(new Error('Only PNG or GIF images are allowed.'));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Post media — images and videos
const uploadPost = multer({
  storage: makeStorage('posts', 'post'),
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Only image or video files are allowed.'));
  },
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

// Profile: avatar + cover in one request
const uploadProfile = multer({
  storage: multer.diskStorage({
    destination(_req, file, cb) {
      const folder = file.fieldname === 'cover' ? 'covers' : 'avatars';
      const dir = path.join(__dirname, '..', 'uploads', folder);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname) || '.png';
      const unique = crypto.randomBytes(12).toString('hex');
      const prefix = file.fieldname === 'cover' ? 'cover' : 'avatar';
      cb(null, `${prefix}_${unique}${ext}`);
    },
  }),
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Task reward visuals — icon + background + frame in one request
const uploadTask = multer({
  storage: multer.diskStorage({
    destination(_req, file, cb) {
      const subdir = file.fieldname === 'icon_image' ? 'shop-gifts'
        : file.fieldname === 'reward_bg_image' ? 'task-bg'
        : 'task-frames';
      const dir = path.join(__dirname, '..', 'uploads', subdir);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname) || '.png';
      const unique = crypto.randomBytes(12).toString('hex');
      cb(null, `${file.fieldname}_${unique}${ext}`);
    },
  }),
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Friend Zone application photos — up to 3 images per submission
const uploadFriendZone = multer({
  storage: makeStorage('friend-zone', 'fz'),
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Chat media — images, audio (voice notes), video, and arbitrary files (docs/PDFs)
const uploadChatMedia = multer({
  storage: makeStorage('chat-media', 'chat'),
  limits: { fileSize: 50 * 1024 * 1024 },
});

module.exports = { upload, uploadGift, uploadShopGift, uploadPost, uploadProfile, uploadTask, uploadFriendZone, uploadChatMedia };
