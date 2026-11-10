/**
 * An Indian mobile number however it was typed or pasted — "+91 98765 43210",
 * "098765-43210", "9876543210" — reduced to its 10 digits (or to whatever
 * digits are left when it isn't a valid number, so comparisons still work).
 */
function phoneDigits(phone) {
  let d = String(phone ?? '').replace(/\D/g, '');
  if (d.length > 10 && d.startsWith('0')) d = d.slice(1);
  if (d.length > 10 && d.startsWith('91')) d = d.slice(2);
  return d;
}

const isValidMobile = (phone) => /^[6-9]\d{9}$/.test(phoneDigits(phone));

module.exports = { phoneDigits, isValidMobile };
