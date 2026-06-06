const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const adminModel = require('../models/admin.model');

function signAdminToken(adminId, role) {
  return jwt.sign(
    { sub: adminId, role, type: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}

/** POST /api/admin/register — create admin (call via curl/Postman with ADMIN_SECRET) */
async function registerAdmin(req, res, next) {
  try {
    const { email, password, fullName, role, adminSecret } = req.body;

    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ success: false, message: 'Invalid admin secret.' });
    }

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const existing = await adminModel.findByEmail(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await adminModel.createAdmin({
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      role: role || 'admin',
    });

    return res.status(201).json({
      success: true,
      message: 'Admin created successfully.',
      data: admin,
    });
  } catch (error) {
    next(error);
  }
}

/** POST /api/admin/login */
async function loginAdmin(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const admin = await adminModel.findByEmail(email.toLowerCase());
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (!admin.is_active) {
      return res.status(403).json({ success: false, message: 'Account is disabled.' });
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = signAdminToken(admin.id, admin.role);

    const { password_hash, ...safeAdmin } = admin;
    return res.json({
      success: true,
      message: 'Login successful.',
      data: { token, admin: safeAdmin },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { registerAdmin, loginAdmin };
