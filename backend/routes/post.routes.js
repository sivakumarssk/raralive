const express = require('express');
const { authenticate, optionalAuth } = require('../middleware/auth.middleware');
const { uploadPost } = require('../middleware/upload.middleware');
const ctrl = require('../controllers/post.controller');

const router = express.Router();

router.post('/',                    authenticate, uploadPost.array('media', 10), ctrl.createPost);
router.get('/feed',                 optionalAuth, ctrl.getFeed);
router.get('/search',               optionalAuth, ctrl.search);
router.get('/explore',              optionalAuth, ctrl.getExplore);
router.get('/my',                   authenticate, ctrl.getMyPosts);
router.get('/saved',                authenticate, ctrl.getSavedPosts);
router.get('/user/:userId',         ctrl.getUserPosts);
router.post('/:id/like',            authenticate, ctrl.toggleLike);
router.get('/:id/liked',            authenticate, ctrl.checkLiked);
router.post('/:id/save',            authenticate, ctrl.toggleSave);
router.post('/:id/view',            optionalAuth, ctrl.recordView);      // after half the video was watched
router.post('/:id/download',        authenticate, ctrl.recordDownload);
router.post('/:id/comments',        authenticate, ctrl.addComment);
router.get('/:id/comments',         ctrl.getComments);
// Last, so the fixed paths above (/feed, /my, /saved, /search, /explore) win
router.get('/:id',                  optionalAuth, ctrl.getPost);

module.exports = router;
