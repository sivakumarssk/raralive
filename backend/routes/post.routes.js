const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { uploadPost } = require('../middleware/upload.middleware');
const ctrl = require('../controllers/post.controller');

const router = express.Router();

router.post('/',                    authenticate, uploadPost.array('media', 10), ctrl.createPost);
router.get('/feed',                 ctrl.getFeed);
router.get('/my',                   authenticate, ctrl.getMyPosts);
router.post('/:id/like',            authenticate, ctrl.toggleLike);
router.get('/:id/liked',            authenticate, ctrl.checkLiked);
router.post('/:id/comments',        authenticate, ctrl.addComment);
router.get('/:id/comments',         ctrl.getComments);

module.exports = router;
