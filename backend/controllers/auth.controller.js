const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/user.model');
const roomModel = require('../models/room.model');
const otpModel = require('../models/otp.model');
const agencyModel = require('../models/agency.model');
const sessions = require('../utils/session-version');
const ioInstance = require('../utils/io-instance');
const { sendOtpSms, SmsError } = require('../utils/msg91');

const PROFILE_GENDERS = ['male', 'female', 'other'];

/** YYYY-MM-DD, a real calendar date, not in the future, not before 1900. */
function isValidDateOfBirth(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return false;
  return d.getUTCFullYear() >= 1900 && d.getTime() <= Date.now();
}

// ── OTP ──────────────────────────────────────────────────────────────────────
// The app's OTP screens have 4 boxes, so codes are 4 digits.
const OTP_LENGTH = 4;
const OTP_TTL_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 30;
const OTP_MAX_SENDS_PER_HOUR = 5;
const OTP_MAX_VERIFY_ATTEMPTS = 5;

class OtpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * OTP_TEST_NUMBERS="+919999999999:4821,+918888888888:1357" — fixed codes for
 * store reviewers / QA numbers. These never hit MSG91. Matched on the last
 * 10 digits so "+91 99999 99999" and "9999999999" are the same number.
 */
function getTestOtp(phone) {
  const last10 = String(phone).replace(/\D/g, '').slice(-10);
  for (const entry of (process.env.OTP_TEST_NUMBERS || '').split(',')) {
    const [num, code] = entry.split(':').map(v => (v || '').trim());
    if (num && code && num.replace(/\D/g, '').slice(-10) === last10) return code;
  }
  return null;
}

/** Rate-limits, stores and sends a fresh OTP. Throws OtpError / SmsError. */
async function issueOtp(phone, purpose) {
  const { secondsSinceLast, sentLastHour } = await otpModel.getSendStats({ phone, purpose });
  if (secondsSinceLast != null && secondsSinceLast < OTP_RESEND_COOLDOWN_SECONDS) {
    const wait = OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLast;
    throw new OtpError(429, `Please wait ${wait}s before requesting another OTP.`);
  }
  if (sentLastHour >= OTP_MAX_SENDS_PER_HOUR) {
    throw new OtpError(429, 'Too many OTP requests. Please try again in an hour.');
  }

  const testCode = getTestOtp(phone);
  const code = testCode || String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  const otp = await otpModel.createOtp({ phone, code, purpose, expiresAt });

  if (testCode) return;
  try {
    await sendOtpSms(phone, code, OTP_TTL_MINUTES);
  } catch (error) {
    // Don't leave an undelivered code live, and don't let it block a retry.
    await otpModel.deleteOtp(otp.id);
    throw error;
  }
}

/** Checks a code against the live OTP and consumes it on success. Throws OtpError. */
async function checkOtp(phone, purpose, code) {
  const otp = await otpModel.findActiveOtp({ phone, purpose });
  if (!otp) {
    throw new OtpError(400, 'OTP expired. Please request a new one.');
  }
  if (otp.attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
    throw new OtpError(429, 'Too many wrong attempts. Please request a new OTP.');
  }
  if (otp.code !== String(code).trim()) {
    const attempts = await otpModel.incrementAttempts(otp.id);
    const left = OTP_MAX_VERIFY_ATTEMPTS - attempts;
    throw new OtpError(400, left > 0
      ? `Incorrect OTP. ${left} attempt${left === 1 ? '' : 's'} left.`
      : 'Too many wrong attempts. Please request a new OTP.');
  }
  await otpModel.consumeOtp(otp.id);
}

/** Sends OtpError / SmsError as a JSON response; returns false for anything else. */
function handleOtpError(error, res) {
  if (error instanceof OtpError) {
    res.status(error.status).json({ success: false, message: error.message });
    return true;
  }
  if (error instanceof SmsError) {
    res.status(503).json({ success: false, message: error.message });
    return true;
  }
  return false;
}

const AGENCY_SUSPENDED_MESSAGE = 'This agency account has been suspended. Contact admin.';

/**
 * Agency rules for every app login. A suspended agency is suspended
 * everywhere — one status on the agency record blocks both the agency panel
 * (see agency-auth.controller.js) and this app login for its linked user, so
 * there's a single place admin has to act instead of separate agency/app
 * suspend toggles. Returns true when the login must be refused.
 */
async function agencyLoginBlocked(user) {
  if (user.role !== 'agency' || !user.agency_id) return false;
  const agency = await agencyModel.getAgencyById(user.agency_id);
  if (agency && agency.status === 'suspended') return true;
  // Agency accounts skip the app's register → profile step, so give them
  // a username here (covers agencies created before usernames were auto-made).
  if (!user.username && agency) {
    user.username = await userModel.ensureUsername(user.id, agency.agency_name);
  }
  return false;
}

// tv = session version; "log out of all devices" bumps it to revoke this token.
async function signToken(userId, role) {
  const tv = await sessions.currentVersion(userId);
  return jwt.sign({ sub: userId, role, tv: tv ?? 0 }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}

/**
 * POST /api/auth/register — step 1: phone (+ optional email).
 * The app signs in with OTP now, so password is optional; older app versions
 * still send one.
 */
async function register(req, res, next) {
  try {
    const { phone, password, email } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    // A phone that registered but never verified (SMS didn't arrive, app
    // closed on the OTP screen…) may register again — nobody has proven they
    // own it yet, so there's nothing to protect.
    const existing = await userModel.findByPhone(phone);
    const canRetry = existing && !existing.is_phone_verified && !existing.username && existing.role !== 'agency';
    if (existing && !canRetry) {
      return res.status(409).json({ success: false, message: 'Phone number already registered.' });
    }

    if (email) {
      const emailTaken = await userModel.findByEmail(email.toLowerCase());
      if (emailTaken && emailTaken.id !== existing?.id) {
        return res.status(409).json({ success: false, message: 'Email already in use.' });
      }
    }

    // Send first: if we're rate-limited or MSG91 fails, nothing is saved.
    await issueOtp(phone, 'register');

    // users.password_hash is required: an OTP-only account gets a random one
    // nobody knows, so it can't be used to sign in with a password.
    const passwordHash = await bcrypt.hash(password || crypto.randomBytes(32).toString('hex'), 12);
    const user = existing
      ? await userModel.updatePendingRegistration(existing.id, {
        email: email ? email.toLowerCase() : null,
        passwordHash,
      })
      : await userModel.createUser({
        phone,
        email: email ? email.toLowerCase() : null,
        passwordHash,
      });

    return res.status(201).json({
      success: true,
      message: 'Account created. Verify OTP to continue.',
      data: { userId: user.id, phone: user.phone },
    });
  } catch (error) {
    if (handleOtpError(error, res)) return;
    next(error);
  }
}

/** POST /api/auth/resend-otp — resend the registration OTP */
async function resendOtp(req, res, next) {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    const user = await userModel.findByPhone(phone);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found. Please register again.' });
    }
    if (user.is_phone_verified) {
      return res.status(400).json({ success: false, message: 'Phone number is already verified.' });
    }

    await issueOtp(phone, 'register');
    return res.json({ success: true, message: 'OTP sent.' });
  } catch (error) {
    if (handleOtpError(error, res)) return;
    next(error);
  }
}

/** POST /api/auth/login */
async function login(req, res, next) {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Identifier and password are required.' });
    }

    const isEmail = identifier.trim().includes('@');
    const user = isEmail
      ? await userModel.findByEmail(identifier.trim().toLowerCase())
      : await userModel.findByPhoneFlexible(identifier.trim());
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Retry without surrounding whitespace — a password copied from the admin
    // panel / WhatsApp often carries a trailing space or newline.
    const valid = await bcrypt.compare(password, user.password_hash)
      || (password.trim() !== password && await bcrypt.compare(password.trim(), user.password_hash));
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (await agencyLoginBlocked(user)) {
      return res.status(403).json({ success: false, message: AGENCY_SUSPENDED_MESSAGE });
    }

    const token = await signToken(user.id, user.role);
    return res.json({
      success: true,
      message: 'Login successful.',
      data: { token, user: sanitizeUser(user) },
    });
  } catch (error) {
    next(error);
  }
}

/** A sign-up that never finished OTP or profile — they register again, not log in. */
function isUnfinishedSignup(user) {
  return !user.is_phone_verified && !user.username && user.role !== 'agency';
}

/** POST /api/auth/login-otp/send — step 1 of OTP login: texts a code to a registered phone */
async function sendLoginOtp(req, res, next) {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    const user = await userModel.findByPhoneFlexible(phone.trim());
    if (!user || isUnfinishedSignup(user)) {
      return res.status(404).json({ success: false, message: 'No account found with this number. Please register first.' });
    }
    if (await agencyLoginBlocked(user)) {
      return res.status(403).json({ success: false, message: AGENCY_SUSPENDED_MESSAGE });
    }

    // The exact stored phone string, so the verify lookup matches
    await issueOtp(user.phone, 'login');
    return res.json({ success: true, message: 'OTP sent.' });
  } catch (error) {
    if (handleOtpError(error, res)) return;
    next(error);
  }
}

/** POST /api/auth/login-otp/verify — step 2 of OTP login: same response as /login */
async function verifyLoginOtp(req, res, next) {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Phone and OTP code are required.' });
    }

    const user = await userModel.findByPhoneFlexible(phone.trim());
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    await checkOtp(user.phone, 'login', code);

    if (await agencyLoginBlocked(user)) {
      return res.status(403).json({ success: false, message: AGENCY_SUSPENDED_MESSAGE });
    }
    if (!user.is_phone_verified) {
      await userModel.markPhoneVerified(user.id);
      user.is_phone_verified = true;
    }

    const token = await signToken(user.id, user.role);
    return res.json({
      success: true,
      message: 'Login successful.',
      data: { token, user: sanitizeUser(user) },
    });
  } catch (error) {
    if (handleOtpError(error, res)) return;
    next(error);
  }
}

/** POST /api/auth/verify-otp */
async function verifyOtp(req, res, next) {
  try {
    const { phone, code, purpose = 'register' } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Phone and OTP code are required.' });
    }

    await checkOtp(phone, purpose, code);

    const user = await userModel.findByPhone(phone);
    if (user) {
      await userModel.markPhoneVerified(user.id);
    }

    // Issue token immediately so the client can call PATCH /profile next
    const token = user ? await signToken(user.id, user.role) : null;

    return res.json({
      success: true,
      message: 'OTP verified successfully.',
      data: { token, user: sanitizeUser(user) },
    });
  } catch (error) {
    if (handleOtpError(error, res)) return;
    next(error);
  }
}

/** GET /api/auth/username-available?username= — registration step 1 checks before creating the account */
async function checkUsername(req, res, next) {
  try {
    const username = String(req.query.username ?? '').trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ success: false, message: 'Use 3–20 characters (letters, numbers, underscore).' });
    }
    const available = !(await userModel.isUsernameTaken(username));
    return res.json({ success: true, data: { available } });
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/auth/profile — step 2 */
async function completeProfile(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    const { fullName, username, gender, dateOfBirth, preferredLanguage, bio, location } = req.body;

    if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
      return res.status(400).json({ success: false, message: 'Username is required (3–20 characters, letters/numbers/underscore).' });
    }

    // Gender and date of birth are mandatory. Bio is optional — never checked.
    const genderValue = typeof gender === 'string' && gender.trim() ? gender.trim().toLowerCase() : null;
    const dobValue = typeof dateOfBirth === 'string' && dateOfBirth.trim() ? dateOfBirth.trim() : null;
    if (genderValue && !PROFILE_GENDERS.includes(genderValue)) {
      return res.status(400).json({ success: false, message: 'Please choose a valid gender.', fields: ['gender'] });
    }
    if (dobValue && !isValidDateOfBirth(dobValue)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid date of birth.', fields: ['dateOfBirth'] });
    }
    if (await userModel.isUsernameTaken(username.trim(), userId)) {
      return res.status(409).json({ success: false, message: 'That username is already taken.', fields: ['username'] });
    }

    // Every save must leave the profile with both (sent now or already saved).
    // Exempt: the very first save right after phone verification, which only
    // sets the username chosen at registration — this guard lets that save
    // through even if gender / date of birth were not sent.
    const existing = await userModel.findById(userId);
    if (existing?.username) {
      const missing = [];
      if (!genderValue && !existing.gender) missing.push({ field: 'gender', label: 'Gender' });
      if (!dobValue && !existing.date_of_birth) missing.push({ field: 'dateOfBirth', label: 'Date of birth' });
      if (missing.length) {
        const labels = missing.map(m => m.label);
        return res.status(400).json({
          success: false,
          message: `${labels.join(' and ')} ${labels.length > 1 ? 'are' : 'is'} required.`,
          fields: missing.map(m => m.field),
        });
      }
    }

    let avatarUrl = undefined;
    let coverUrl = undefined;
    if (req.files?.avatar?.[0]) {
      avatarUrl = `uploads/avatars/${req.files.avatar[0].filename}`;
    } else if (req.file) {
      avatarUrl = `uploads/avatars/${req.file.filename}`;
    }
    if (req.files?.cover?.[0]) {
      coverUrl = `uploads/covers/${req.files.cover[0].filename}`;
    }

    const updated = await userModel.updateProfile(userId, {
      fullName,
      username,
      gender: genderValue ?? undefined,
      dateOfBirth: dobValue ?? undefined,
      preferredLanguage,
      avatarUrl,
      bio,
      coverUrl,
      location,
    });

    // Rooms show their host's picture — keep them in step with the new one
    if (avatarUrl) await roomModel.syncHostRoomImage(userId, avatarUrl);

    return res.json({ success: true, message: 'Profile updated.', data: updated });
  } catch (error) {
    next(error);
  }
}

/** POST /api/auth/forgot-password — send OTP to phone for password reset */
async function forgotPassword(req, res, next) {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    const normalizedPhone = phone.trim();
    const user = await userModel.findByPhoneFlexible(normalizedPhone);
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this phone number.' });
    }

    // Agency accounts don't self-service a password change in the app —
    // their password is owned by the agency panel / admin panel and synced
    // into users.password_hash from there (see linkAgencyUser()). Letting
    // this OTP flow change it here would silently desync the two.
    if (user.role === 'agency') {
      return res.status(403).json({
        success: false,
        message: 'This is an agency account. Reset your password from the agency panel or contact admin.',
      });
    }

    // Use the exact phone string stored in DB so OTP lookup matches
    await issueOtp(user.phone, 'reset-password');

    return res.json({ success: true, message: 'OTP sent for password reset.' });
  } catch (error) {
    if (handleOtpError(error, res)) return;
    next(error);
  }
}

/** POST /api/auth/verify-reset-otp — verify OTP and return a short-lived reset token */
async function verifyResetOtp(req, res, next) {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Phone and OTP code are required.' });
    }

    // Look up the user first to get the exact stored phone string
    const user = await userModel.findByPhoneFlexible(phone.trim());
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    await checkOtp(user.phone, 'reset-password', code);

    // Short-lived reset token (10 min)
    const resetToken = jwt.sign({ sub: user.id, purpose: 'reset-password' }, process.env.JWT_SECRET, { expiresIn: '10m' });

    return res.json({
      success: true,
      message: 'OTP verified.',
      data: { resetToken },
    });
  } catch (error) {
    if (handleOtpError(error, res)) return;
    next(error);
  }
}

/** POST /api/auth/reset-password — set new password using reset token */
async function resetPassword(req, res, next) {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ success: false, message: 'Reset token and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    let payload;
    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Reset link has expired. Please try again.' });
    }

    if (payload.purpose !== 'reset-password') {
      return res.status(401).json({ success: false, message: 'Invalid reset token.' });
    }

    // Defense in depth — forgotPassword() already blocks agency accounts
    // from starting this flow, but reject here too in case a token was
    // issued before that check existed.
    const targetUser = await userModel.findById(payload.sub);
    if (targetUser?.role === 'agency') {
      return res.status(403).json({
        success: false,
        message: 'This is an agency account. Reset your password from the agency panel or contact admin.',
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await userModel.updatePassword(payload.sub, passwordHash);

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/logout-all
 * Revokes every token this account holds, this device's included, and drops
 * its live sockets so other devices are signed out right away, not on their
 * next request.
 */
async function logoutAllDevices(req, res, next) {
  try {
    await sessions.revokeAllSessions(req.user.id);

    const io = ioInstance.get();
    if (io) {
      const room = `user_${req.user.id}`;
      io.to(room).emit('session_revoked');
      // Give the notice a moment to reach clients before the sockets close.
      setTimeout(() => io.in(room).disconnectSockets(true), 500);
    }

    return res.json({ success: true, message: 'Logged out of all devices.' });
  } catch (error) {
    next(error);
  }
}

/** GET /api/auth/me */
async function getMe(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized.' });
    const profile = await userModel.getProfileWithStats(userId);
    if (!profile) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
}

async function followUser(req, res, next) {
  try {
    const followerId = req.user?.id;
    const { userId: followingId } = req.params;
    if (followerId === followingId) return res.status(400).json({ success: false, message: 'Cannot follow yourself.' });
    await userModel.followUser(followerId, followingId);
    return res.json({ success: true, following: true });
  } catch (error) { next(error); }
}

async function unfollowUser(req, res, next) {
  try {
    const followerId = req.user?.id;
    const { userId: followingId } = req.params;
    await userModel.unfollowUser(followerId, followingId);
    return res.json({ success: true, following: false });
  } catch (error) { next(error); }
}

async function checkFollow(req, res, next) {
  try {
    const followerId = req.user?.id;
    const { userId: followingId } = req.params;
    const following = await userModel.isFollowing(followerId, followingId);
    return res.json({ success: true, following });
  } catch (error) { next(error); }
}

/** GET /api/auth/users/:userId — public profile of any user */
async function getPublicUser(req, res, next) {
  try {
    const { userId } = req.params;
    const profile = await userModel.getProfileWithStats(userId);
    if (!profile) return res.status(404).json({ success: false, message: 'User not found.' });
    // strip private fields
    const { phone, email, is_phone_verified, role, agency_id, ...pub } = profile;
    return res.json({ success: true, data: pub });
  } catch (error) { next(error); }
}

/**
 * POST /api/auth/users/:userId/report — file a report against a user.
 * 5 different reporters → the user gets a warning (models/moderation.model.js).
 */
async function reportUser(req, res, next) {
  try {
    const moderationModel = require('../models/moderation.model');
    const { applyModerationResult } = require('../socket');
    const reporterId = req.user?.id;
    const { userId: reportedUserId } = req.params;
    const { reason, note, roomId } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'Please choose a reason.' });

    const result = await moderationModel.reportUser({
      reporterId, reportedUserId, roomId: roomId || null, reason, note, kind: 'profile',
    });
    if (result.duplicate) {
      return res.status(409).json({ success: false, duplicate: true, message: 'You have already reported this user.' });
    }
    applyModerationResult(result);
    return res.json({ success: true });
  } catch (error) {
    if (error instanceof require('../models/moderation.model').ModerationError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
}

/** PATCH /api/auth/language */
async function setLanguage(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    const { language } = req.body;
    if (!language) {
      return res.status(400).json({ success: false, message: 'Language is required.' });
    }

    const updated = await userModel.updateProfile(userId, { preferredLanguage: language });
    return res.json({ success: true, message: 'Language saved.', data: updated });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  checkUsername,
  logoutAllDevices,
  sendLoginOtp,
  verifyLoginOtp,
  register,
  resendOtp,
  login,
  verifyOtp,
  completeProfile,
  setLanguage,
  getMe,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  followUser,
  unfollowUser,
  checkFollow,
  getPublicUser,
  reportUser,
};
