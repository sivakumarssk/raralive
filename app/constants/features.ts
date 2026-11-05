/**
 * Release feature flags.
 *
 * coinPurchases — coin packages are bought over WhatsApp today, which Google Play
 *   does not allow for in-app digital goods. Keep this off until coin packages
 *   are sold through Google Play Billing.
 * spinAndWin — the "Spin & Win Coins" card has no working spin yet, and a
 *   chance-based reward must be declared in the Play content rating.
 */
export const FEATURES = {
  coinPurchases: false,
  spinAndWin: false,
} as const;
