const friendZoneModel = require('../models/friend-zone.model');
const { isFriendZoneUserOnline } = require('../socket');

const GENDERS = ['Male', 'Female', 'Other'];
const STATUSES = ['pending', 'approved', 'rejected'];

function fileUrl(file) {
  return `uploads/friend-zone/${file.filename}`;
}

function validateApplicationFields({ fullName, gender, dateOfBirth, city, language }) {
  if (!fullName || !fullName.trim()) return 'Full name is required.';
  if (!gender || !GENDERS.includes(gender)) return 'Gender is required.';
  if (!dateOfBirth) return 'Date of birth is required.';
  if (!city || !city.trim()) return 'City is required.';
  if (!language || !language.trim()) return 'Language is required.';
  return null;
}

// ── App: submit application ──────────────────────────────────────────────────

async function apply(req, res, next) {
  try {
    const userId = req.user.id;
    const { fullName, gender, dateOfBirth, city, language, aboutMe } = req.body;

    const validationError = validateApplicationFields({ fullName, gender, dateOfBirth, city, language });
    if (validationError) return res.status(400).json({ success: false, message: validationError });

    const files = (req.files || []);
    if (!files.length) {
      return res.status(400).json({ success: false, message: 'At least one photo is required.' });
    }

    const existing = await friendZoneModel.getLatestForUser(userId);
    if (existing && existing.status !== 'rejected') {
      return res.status(409).json({ success: false, message: 'You already have an application in progress.' });
    }

    const photos = files.map(fileUrl);

    const application = await friendZoneModel.createApplication({
      userId,
      photos,
      fullName: fullName.trim(),
      gender,
      dateOfBirth,
      city: city.trim(),
      language: language.trim(),
      aboutMe: aboutMe ? aboutMe.trim() : null,
    });

    return res.status(201).json({ success: true, data: application });
  } catch (err) { next(err); }
}

// ── App: get my latest application status ────────────────────────────────────

async function getMyStatus(req, res, next) {
  try {
    const userId = req.user.id;
    const application = await friendZoneModel.getLatestForUser(userId);
    return res.json({ success: true, data: application });
  } catch (err) { next(err); }
}

// ── App: edit my existing application (resubmits for review) ─────────────────

async function updateMyApplication(req, res, next) {
  try {
    const userId = req.user.id;
    const { fullName, gender, dateOfBirth, city, language, aboutMe, existingPhotos } = req.body;

    const validationError = validateApplicationFields({ fullName, gender, dateOfBirth, city, language });
    if (validationError) return res.status(400).json({ success: false, message: validationError });

    const existing = await friendZoneModel.getLatestForUser(userId);
    if (!existing) return res.status(404).json({ success: false, message: 'No application found.' });

    const keptPhotos = existingPhotos
      ? (Array.isArray(existingPhotos) ? existingPhotos : [existingPhotos])
      : [];
    const newFiles = (req.files || []).map(fileUrl);
    const photos = [...keptPhotos, ...newFiles];

    if (!photos.length) {
      return res.status(400).json({ success: false, message: 'At least one photo is required.' });
    }

    const application = await friendZoneModel.updateApplicationDetails(existing.id, {
      photos,
      fullName: fullName.trim(),
      gender,
      dateOfBirth,
      city: city.trim(),
      language: language.trim(),
      aboutMe: aboutMe ? aboutMe.trim() : null,
    });

    return res.json({ success: true, data: application });
  } catch (err) { next(err); }
}

// ── App: update audio/video call toggle prefs ─────────────────────────────────

async function updateMyToggles(req, res, next) {
  try {
    const userId = req.user.id;
    const { receiveCalls, videoCalls } = req.body || {};

    const application = await friendZoneModel.updateTogglePrefs(userId, {
      receiveCalls: typeof receiveCalls === 'boolean' ? receiveCalls : undefined,
      videoCalls: typeof videoCalls === 'boolean' ? videoCalls : undefined,
    });
    if (!application) return res.status(404).json({ success: false, message: 'No approved application found.' });

    return res.json({ success: true, data: application });
  } catch (err) { next(err); }
}

// ── App: public friends list (approved + at least one toggle on) ────────────

async function getPublicFriends(req, res, next) {
  try {
    const friends = await friendZoneModel.listPublicFriends();
    const withStatus = friends.map(f => ({ ...f, is_online: isFriendZoneUserOnline(f.user_id) }));
    return res.json({ success: true, data: withStatus });
  } catch (err) { next(err); }
}

// ── App: my call history ─────────────────────────────────────────────────────

async function getCallHistory(req, res, next) {
  try {
    const userId = req.user.id;
    const { limit = '30', offset = '0' } = req.query;
    const result = await friendZoneModel.listCallHistory(userId, {
      limit: parseInt(limit, 10) || 30,
      offset: parseInt(offset, 10) || 0,
    });
    return res.json({ success: true, data: result.rows, pagination: { total: result.total } });
  } catch (err) { next(err); }
}

// ── Admin: list applications ──────────────────────────────────────────────────

async function listApplications(req, res, next) {
  try {
    const { status = '', limit = '50', offset = '0' } = req.query;
    const result = await friendZoneModel.listApplications({
      status: STATUSES.includes(status) ? status : '',
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
    });
    return res.json({ success: true, data: { applications: result.rows, pagination: { total: result.total } } });
  } catch (err) { next(err); }
}

// ── Admin: list all 1:1 calls across every user ───────────────────────────────

const CALL_STATUSES = ['ringing', 'accepted', 'rejected', 'missed', 'ended', 'failed'];
const CALL_TYPES = ['audio', 'video'];

async function listCalls(req, res, next) {
  try {
    const { status = '', callType = '', limit = '50', offset = '0' } = req.query;
    const result = await friendZoneModel.listCalls({
      status: CALL_STATUSES.includes(status) ? status : '',
      callType: CALL_TYPES.includes(callType) ? callType : '',
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
    });
    return res.json({ success: true, data: { calls: result.rows, pagination: { total: result.total } } });
  } catch (err) { next(err); }
}

// ── Admin: list all gifts sent during 1:1 calls ───────────────────────────────

async function listCallGifts(req, res, next) {
  try {
    const { limit = '50', offset = '0' } = req.query;
    const result = await friendZoneModel.listCallGifts({
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
    });
    return res.json({
      success: true,
      data: { gifts: result.rows, pagination: { total: result.total }, totalCoins: result.totalCoins },
    });
  } catch (err) { next(err); }
}

// ── Admin: get single application ─────────────────────────────────────────────

async function getApplication(req, res, next) {
  try {
    const application = await friendZoneModel.getApplicationById(req.params.id);
    if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });
    return res.json({ success: true, data: application });
  } catch (err) { next(err); }
}

// ── Admin: approve/reject ─────────────────────────────────────────────────────

async function updateStatus(req, res, next) {
  try {
    const { status, rejectionReason } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be approved or rejected.' });
    }
    if (status === 'rejected' && (!rejectionReason || !rejectionReason.trim())) {
      return res.status(400).json({ success: false, message: 'A rejection reason is required.' });
    }

    const application = await friendZoneModel.setApplicationStatus(req.params.id, {
      status,
      rejectionReason: status === 'rejected' ? rejectionReason.trim() : null,
      reviewedBy: req.admin.id,
    });
    if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });

    return res.json({ success: true, message: `Application ${status}.`, data: application });
  } catch (err) { next(err); }
}

module.exports = {
  apply, getMyStatus, updateMyApplication, updateMyToggles, getPublicFriends, getCallHistory,
  listApplications, listCalls, listCallGifts, getApplication, updateStatus,
};
