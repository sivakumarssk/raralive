const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');

// India states / cities for the chatroom location picker. Proxies the free
// CountriesNow API (countriesnow.space — the "CountriesNow" Postman
// collection) so the app never talks to it directly, cleans the names
// (CountriesNow returns diacritics like "Hyderābād" and near-duplicates),
// and caches results for a day.

const router = express.Router();

const API = 'https://countriesnow.space/api/v0.1/countries';
const CACHE_MS = 24 * 60 * 60 * 1000;
const cache = new Map(); // key -> { at, data }

async function cached(key, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const data = await load();
  cache.set(key, { at: Date.now(), data });
  return data;
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.msg || 'Location service unavailable');
  return json.data;
}

/** "Hyderābād" → "Hyderabad"; trims; drops empty/duplicate names; sorts A–Z. */
function cleanNames(names) {
  const seen = new Map();
  for (const raw of names) {
    const name = String(raw).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

const getStates = () => cached('states', async () => {
  const data = await fetchJson(`${API}/states/q?country=India`);
  return cleanNames((data.states ?? []).map(s => s.name));
});

/** GET /api/locations/states */
router.get('/states', authenticate, async (req, res) => {
  try {
    return res.json({ success: true, data: await getStates() });
  } catch (err) {
    return res.status(502).json({ success: false, message: 'Could not load states. Please try again.' });
  }
});

/** GET /api/locations/cities?state=Telangana */
router.get('/cities', authenticate, async (req, res) => {
  try {
    const state = String(req.query.state || '').trim();
    const states = await getStates();
    const match = states.find(s => s.toLowerCase() === state.toLowerCase());
    if (!match) return res.status(400).json({ success: false, message: 'Unknown state.' });
    const cities = await cached(`cities:${match}`, async () =>
      cleanNames(await fetchJson(`${API}/state/cities/q?country=India&state=${encodeURIComponent(match)}`)));
    return res.json({ success: true, data: cities });
  } catch (err) {
    return res.status(502).json({ success: false, message: 'Could not load cities. Please try again.' });
  }
});

module.exports = router;
