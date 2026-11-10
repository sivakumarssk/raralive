// Length and character rules for user-entered names — keep in step with
// backend/utils/text-limits.js.
//
// Usernames are plain: letters, numbers, - and _ only (no spaces, emoji or
// "fancy font" letters). Full names and room names allow any text, counted in
// characters as people see them (a fancy-font letter or emoji is one).

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 15;
export const USERNAME_RE = new RegExp(`^[A-Za-z0-9_-]{${USERNAME_MIN},${USERNAME_MAX}}$`);
export const USERNAME_RULE = `Use ${USERNAME_MIN}–${USERNAME_MAX} characters: letters, numbers, - or _.`;
export const FULL_NAME_MAX = 20;
export const BIO_MAX = 250;
export const ROOM_NAME_MAX = 20;

/** Characters as people see them (code points), not UTF-16 units. */
export const charCount = (s: string) => Array.from(s).length;

/** Cut to at most `max` visible characters — use instead of maxLength for text that allows emoji / fancy fonts. */
export const limitChars = (s: string, max: number) => (charCount(s) > max ? Array.from(s).slice(0, max).join('') : s);

/** Drops anything a username can't contain, as it's typed. */
export const cleanUsername = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '').slice(0, USERNAME_MAX);
