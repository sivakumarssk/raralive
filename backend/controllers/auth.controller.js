const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/user.model');
const otpModel = require('../models/otp.model');

function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}

/** POST /api/auth/register — step 1: phone + password (+ optional email) */
async function register(req, res, next) {
  try {
    const { phone, password, email } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Phone and password are required.' });
    }

    const existing = await userModel.findByPhone(phone);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Phone number already registered.' });
    }

    if (email) {
      const emailTaken = await userModel.findByEmail(email.toLowerCase());
      if (emailTaken) {
        return res.status(409).json({ success: false, message: 'Email already in use.' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await userModel.createUser({
      phone,
      email: email ? email.toLowerCase() : null,
      passwordHash,
    });

    // TODO: send OTP via SMS provider; for now return dev hint in non-production
    const devCode = process.env.NODE_ENV === 'production' ? undefined : '1234';
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await otpModel.createOtp({ phone, code: devCode || String(Math.floor(1000 + Math.random() * 9000)), purpose: 'register', expiresAt });

    return res.status(201).json({
      success: true,
      message: 'Account created. Verify OTP to continue.',
      data: { userId: user.id, phone: user.phone },
      ...(devCode && { devOtp: devCode }),
    });
  } catch (error) {
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

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = signToken(user.id);
    return res.json({
      success: true,
      message: 'Login successful.',
      data: { token, user: sanitizeUser(user) },
    });
  } catch (error) {
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

    const otp = await otpModel.findLatestValidOtp({ phone, code, purpose });
    if (!otp) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    await otpModel.consumeOtp(otp.id);

    const user = await userModel.findByPhone(phone);
    if (user) {
      await userModel.markPhoneVerified(user.id);
    }

    // Issue token immediately so the client can call PATCH /profile next
    const token = user ? signToken(user.id) : null;

    return res.json({
      success: true,
      message: 'OTP verified successfully.',
      data: { token, user: sanitizeUser(user) },
    });
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

    const { fullName, username, gender, dateOfBirth, preferredLanguage } = req.body;

    if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
      return res.status(400).json({ success: false, message: 'Username is required (3–20 characters, letters/numbers/underscore).' });
    }

    // Build avatar URL if a file was uploaded
    let avatarUrl = undefined;
    if (req.file) {
      avatarUrl = `uploads/avatars/${req.file.filename}`;
    }

    const updated = await userModel.updateProfile(userId, {
      fullName,
      username,
      gender,
      dateOfBirth,
      preferredLanguage,
      avatarUrl,
    });

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

    // Use the exact phone string stored in DB so OTP lookup matches
    const storedPhone = user.phone;
    const devCode = process.env.NODE_ENV === 'production' ? undefined : '1234';
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const storedCode = devCode || String(Math.floor(1000 + Math.random() * 9000));
    console.log('[forgot-password] phone:', storedPhone, '| storing OTP code:', storedCode);
    await otpModel.createOtp({
      phone: storedPhone,
      code: storedCode,
      purpose: 'reset-password',
      expiresAt,
    });

    return res.json({
      success: true,
      message: 'OTP sent for password reset.',
      ...(devCode && { devOtp: devCode }),
    });
  } catch (error) {
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

    const normalizedCode = String(code).trim();
    const normalizedPhone = phone.trim();

    // Look up the user first to get the exact stored phone string
    const user = await userModel.findByPhoneFlexible(normalizedPhone);
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    console.log('[verify-reset-otp] stored phone:', user.phone, '| code:', normalizedCode);
    const otp = await otpModel.findLatestValidOtp({ phone: user.phone, code: normalizedCode, purpose: 'reset-password' });
    console.log('[verify-reset-otp] otp found:', otp);
    if (!otp) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    await otpModel.consumeOtp(otp.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    // Short-lived reset token (10 min)
    const resetToken = jwt.sign({ sub: user.id, purpose: 'reset-password' }, process.env.JWT_SECRET, { expiresIn: '10m' });

    return res.json({
      success: true,
      message: 'OTP verified.',
      data: { resetToken },
    });
  } catch (error) {
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

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await userModel.updatePassword(payload.sub, passwordHash);

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    next(error);
  }
}

/** GET /api/auth/me */
async function getMe(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized.' });
    const db = require('../config/db');
    const result = await db.query(
      `SELECT id, phone, email, username, full_name, gender, date_of_birth,
              preferred_language, avatar_url, is_phone_verified, created_at
       FROM users WHERE id = $1`,
      [userId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
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
  register,
  login,
  verifyOtp,
  completeProfile,
  setLanguage,
  getMe,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
};
