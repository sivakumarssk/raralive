// Length and character rules for user-entered names — keep in step with
// app/utils/text-limits.ts.
//
// Usernames are plain: letters, numbers, - and _ only (no spaces, emoji or
// "fancy font" letters). Full names and room names allow any text, so their
// length is counted in characters as people see them (a fancy-font letter or
// emoji is one), not in UTF-16 units.

const USERNAME_MIN = 3;
const USERNAME_MAX = 15;
const USERNAME_RE = new RegExp(`^[A-Za-z0-9_-]{${USERNAME_MIN},${USERNAME_MAX}}$`);
const FULL_NAME_MAX = 20;
const BIO_MAX = 250;
const ROOM_NAME_MAX = 20;

const USERNAME_RULE = `Use ${USERNAME_MIN}–${USERNAME_MAX} characters: letters, numbers, - or _.`;

/** Characters as people see them (code points). */
const charCount = (s) => Array.from(String(s ?? '')).length;

module.exports = {
  USERNAME_MIN, USERNAME_MAX, USERNAME_RE, USERNAME_RULE,
  FULL_NAME_MAX, BIO_MAX, ROOM_NAME_MAX, charCount,
};
