// Shared sizes for every popup / sheet / page opened from the chat room, so
// they all use one compact type scale and the same control sizes.

export const RT = {
  /** Full-page header title (left-aligned next to the back arrow) */
  pageTitle: 20,
  /** Page tab labels (below the header) */
  tab: 16,
  /** Popup / sheet title */
  title: 16,
  /** Section heading inside a popup */
  section: 14,
  /** Main text, list item labels, inputs */
  body: 14,
  /** Subtitles, hints, secondary values */
  secondary: 12,
  /** Captions, badges, timestamps */
  caption: 11,
  /** Button labels */
  button: 14,
  /** Big highlighted numbers (coins, scores, levels) */
  hero: 20,
} as const;

/**
 * Text colour for every number in the chat room — coin balances, gift
 * prices, gifting coin counts, quantities and battle scores — so numbers
 * look the same in every section. Only the surface decides which one:
 */
export const RC = {
  /** Numbers on light surfaces */
  number: '#1C1E22',
  /** Numbers on dark, coloured or image surfaces */
  numberOnDark: '#FFFFFF',
} as const;

export const RS = {
  /** Popup side padding */
  pad: 16,
  /** Primary / secondary button height */
  button: 40,
  /** Close (×) button */
  close: 28,
  /** Icon tile in list rows */
  iconBox: 32,
  /** Centered popup corner radius */
  cardRadius: 18,
  /** Bottom sheet top corner radius */
  sheetRadius: 20,
} as const;
