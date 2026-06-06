const bcrypt = require('bcryptjs');
const agencyModel = require('../models/agency.model');

/** Generate a unique agent code like AGT-A3F9K2 */
function generateAgentCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'AGT-';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Generate a random readable default password like Ra@7xK2p */
function generateDefaultPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$!';
  const all = upper + lower + digits + special;
  let pass = '';
  pass += upper[Math.floor(Math.random() * upper.length)];
  pass += lower[Math.floor(Math.random() * lower.length)];
  pass += digits[Math.floor(Math.random() * digits.length)];
  pass += special[Math.floor(Math.random() * special.length)];
  for (let i = 4; i < 10; i++) {
    pass += all[Math.floor(Math.random() * all.length)];
  }
  // shuffle
  return pass.split('').sort(() => Math.random() - 0.5).join('');
}

/** POST /api/admin/agencies — create agency (admin-protected) */
async function createAgency(req, res, next) {
  try {
    const {
      agencyName, personName, age, email, phone, address,
      aadharNumber, panNumber, bankAccount, bankIfsc,
      bankHolderName, bankName,
    } = req.body;

    // Validate required fields
    const missing = [];
    if (!agencyName)     missing.push('Agency Name');
    if (!personName)     missing.push('Person Name');
    if (!age)            missing.push('Age');
    if (!email)          missing.push('Email');
    if (!phone)          missing.push('Phone');
    if (!address)        missing.push('Address');
    if (!aadharNumber)   missing.push('Aadhar Number');
    if (!panNumber)      missing.push('PAN Number');
    if (!bankAccount)    missing.push('Bank Account Number');
    if (!bankHolderName) missing.push('Bank Account Holder Name');
    if (!bankName)       missing.push('Bank Name');

    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    // Documents are mandatory
    const files = req.files || {};
    if (!files.docAadhar?.[0]) return res.status(400).json({ success: false, message: 'Aadhar document is required.' });
    if (!files.docPan?.[0])    return res.status(400).json({ success: false, message: 'PAN document is required.' });
    if (!files.docBank?.[0])   return res.status(400).json({ success: false, message: 'Bank document is required.' });

    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 18 || ageNum > 120) {
      return res.status(400).json({ success: false, message: 'Age must be between 18 and 120.' });
    }

    // Uniqueness checks
    const [existingName, existingEmail, existingPhone] = await Promise.all([
      agencyModel.findByAgencyName(agencyName),
      agencyModel.findByEmail(email),
      agencyModel.findByPhone(phone),
    ]);

    if (existingName) return res.status(409).json({ success: false, message: 'Agency name is already taken.' });
    if (existingEmail) return res.status(409).json({ success: false, message: 'Email is already registered.' });
    if (existingPhone) return res.status(409).json({ success: false, message: 'Phone number is already registered.' });

    // Document URLs from multer — store relative path only
    const docAadharUrl = files.docAadhar?.[0] ? `uploads/agencies/${files.docAadhar[0].filename}` : null;
    const docPanUrl    = files.docPan?.[0]    ? `uploads/agencies/${files.docPan[0].filename}`    : null;
    const docBankUrl   = files.docBank?.[0]   ? `uploads/agencies/${files.docBank[0].filename}`   : null;

    // Generate unique agent code (retry on collision)
    let agentCode;
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generateAgentCode();
      const existing = await agencyModel.findByAgentCode(candidate);
      if (!existing) { agentCode = candidate; break; }
    }
    if (!agentCode) {
      return res.status(500).json({ success: false, message: 'Could not generate unique agent code. Try again.' });
    }

    const defaultPassword = generateDefaultPassword();
    const passwordHash = await bcrypt.hash(defaultPassword, 12);

    const agency = await agencyModel.createAgency({
      agencyName: agencyName.trim(),
      personName: personName.trim(),
      age: ageNum,
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      address: address.trim(),
      aadharNumber: aadharNumber.trim(),
      panNumber: panNumber.trim().toUpperCase(),
      bankAccount: bankAccount.trim(),
      bankIfsc: bankIfsc?.trim().toUpperCase() || null,
      bankHolderName: bankHolderName.trim(),
      bankName: bankName.trim(),
      docAadharUrl,
      docPanUrl,
      docBankUrl,
      agentCode,
      passwordHash,
      plainPassword: defaultPassword,
      createdBy: req.admin.id,
    });

    return res.status(201).json({
      success: true,
      message: 'Agency created successfully.',
      data: {
        ...agency,
        agentCode,
        defaultPassword,
      },
    });
  } catch (error) {
    next(error);
  }
}

/** GET /api/admin/agencies — list all agencies (admin-protected) */
async function listAgencies(req, res, next) {
  try {
    const { search = '', page = '1', limit = '20' } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limitNum;

    const { rows, total } = await agencyModel.listAgencies({ limit: limitNum, offset, search });

    return res.json({
      success: true,
      data: {
        agencies: rows,
        pagination: { total, page: parseInt(page, 10), limit: limitNum, pages: Math.ceil(total / limitNum) },
      },
    });
  } catch (error) {
    next(error);
  }
}

/** GET /api/admin/agencies/:id — get single agency detail (admin-protected) */
async function getAgency(req, res, next) {
  try {
    const agency = await agencyModel.getAgencyById(req.params.id);
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found.' });
    return res.json({ success: true, data: agency });
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/admin/agencies/:id — edit non-KYC details (admin-protected) */
async function updateAgency(req, res, next) {
  try {
    const { personName, age, email, phone, address, bankIfsc } = req.body;

    const ageNum = age ? parseInt(age, 10) : undefined;
    if (age !== undefined && (isNaN(ageNum) || ageNum < 18 || ageNum > 120)) {
      return res.status(400).json({ success: false, message: 'Age must be between 18 and 120.' });
    }

    // Check email uniqueness if changing
    if (email) {
      const existing = await agencyModel.findByEmail(email);
      if (existing && existing.id !== req.params.id) {
        return res.status(409).json({ success: false, message: 'Email is already used by another agency.' });
      }
    }

    // Check phone uniqueness if changing
    if (phone) {
      const existing = await agencyModel.findByPhone(phone);
      if (existing && existing.id !== req.params.id) {
        return res.status(409).json({ success: false, message: 'Phone is already used by another agency.' });
      }
    }

    const agency = await agencyModel.updateAgencyDetails(req.params.id, {
      personName,
      age: ageNum,
      email: email?.toLowerCase().trim(),
      phone: phone?.trim(),
      address,
      bankIfsc: bankIfsc?.toUpperCase(),
    });

    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found.' });
    return res.json({ success: true, message: 'Agency updated.', data: agency });
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/admin/agencies/:id/status — suspend or activate (admin-protected) */
async function updateAgencyStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!['active', 'suspended', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Use active, suspended, or pending.' });
    }
    const agency = await agencyModel.updateAgencyStatus(req.params.id, status);
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found.' });
    return res.json({ success: true, message: `Agency ${status}.`, data: agency });
  } catch (error) {
    next(error);
  }
}

/** POST /api/admin/agencies/:id/reset-password — generate new default password (admin-protected) */
async function adminResetAgencyPassword(req, res, next) {
  try {
    const agency = await agencyModel.getAgencyById(req.params.id);
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found.' });

    const newPassword = generateDefaultPassword();
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await agencyModel.resetAgencyPassword(req.params.id, passwordHash, newPassword);

    return res.json({
      success: true,
      message: 'Password reset. Share the new default password with the agency.',
      data: { agentCode: agency.agent_code, newDefaultPassword: newPassword },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { createAgency, listAgencies, getAgency, updateAgency, updateAgencyStatus, adminResetAgencyPassword };
