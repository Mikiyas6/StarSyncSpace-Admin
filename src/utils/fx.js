/* ------------------------------------------------------------------
   The arithmetic and the parsing behind the live USD → RWF rate.

   A DELIBERATE MIRROR of StarSyncSpace-Client/app/_lib/fx-math.js.

   The two apps are separate builds with no shared package — the same
   arrangement the booking rules already live under (see utils/booking.js
   and the client's availability.js). Keep the two in step: if the
   plausibility band, the response shapes or the rounding change on one
   side, they change on the other, or the site and the dashboard will
   quote different prices for the same room.

   The IO half is NOT mirrored, because it cannot be. The client caches in
   Next's data cache on a server; this app is a browser SPA and caches in
   React Query, with the shared `fx_rates` row as the value both apps fall
   back to. See services/apiFx.js.
   ------------------------------------------------------------------ */

export const FALLBACK_RWF_PER_USD = 1470.59;

/* One hour. Long enough that the API is called a couple of dozen times a
   day; short enough that nobody is ever quoted yesterday's currency. */
export const FX_TTL_SECONDS = 60 * 60;

/* open.er-api.com is the free, key-less tier of exchangerate-api.com. It
   updates daily, sends permissive CORS headers (which is what lets the
   admin SPA call it straight from the browser), and answers with a shape
   that is trivially checkable. Overridable so a paid or self-hosted
   endpoint can be dropped in without touching code. */
export const FX_ENDPOINT =
  /* Vite, not Node: `process.env` does not exist in a browser bundle, and
     only VITE_-prefixed variables are exposed at all. The client reads the
     same setting from process.env.FX_RATES_URL — one of the few places the
     mirror cannot be character-for-character. */
  import.meta.env.VITE_FX_RATES_URL || "https://open.er-api.com/v6/latest/USD";

/* ------------------------------ pure ----------------------------- */

/* Is a rate this far out of line plausible?

   The failure this guards against is not a currency crash, it is a
   mis-parse: an inverted pair (0.00068 instead of 1470) or a response
   that quoted a different currency. Both produce a number that is
   confidently wrong by orders of magnitude, and putting it on the public
   site would be far worse than staying stale. The database's
   upsert_fx_rate() applies the same 10x rule, so a bad reading cannot
   get in through either app. */
export function isPlausibleRate(rate, reference = FALLBACK_RWF_PER_USD) {
  const value = Number(rate);
  if (!Number.isFinite(value) || value <= 0) return false;
  if (!Number.isFinite(reference) || reference <= 0) return true;
  return value <= reference * 10 && value >= reference / 10;
}

/* Pull RWF out of a rates response without trusting its shape.

   Returns null rather than throwing on anything unexpected, because the
   caller's job in that case is to fall back, not to fail. Two shapes are
   accepted: `{ rates: { RWF } }` (open.er-api.com, exchangerate-api) and
   `{ conversion_rates: { RWF } }` (the same vendor's keyed v6 API), so
   swapping FX_ENDPOINT between them needs no code change. */
export function parseRwfRate(payload) {
  if (!payload || typeof payload !== "object") return null;

  // open.er-api.com says so explicitly when a request did not work, and
  // still answers 200 while doing it.
  if (payload.result && payload.result !== "success") return null;

  const table = payload.rates ?? payload.conversion_rates;
  if (!table || typeof table !== "object") return null;

  const rate = Number(table.RWF);
  return isPlausibleRate(rate) ? rate : null;
}

/* When was this reading taken, as a Date, whatever the source called it. */
export function parseRateTimestamp(payload) {
  const unix = Number(payload?.time_last_update_unix);
  if (Number.isFinite(unix) && unix > 0) return new Date(unix * 1000);
  return new Date();
}

export function isStale(fetchedAt, now = new Date(), ttlSeconds = FX_TTL_SECONDS) {
  const taken = new Date(fetchedAt);
  if (Number.isNaN(taken.getTime())) return true;
  return now.getTime() - taken.getTime() > ttlSeconds * 1000;
}

/* The one place USD becomes RWF.

   Rounded to whole francs because RWF has no subunit in practice — there
   is no coin smaller than 1 — so a price of "29,411.8 RWF" is a number
   nobody can pay. */
export function rwfForUsd(usd, rate = FALLBACK_RWF_PER_USD) {
  const amount = Number(usd);
  const perUsd = Number(rate) || FALLBACK_RWF_PER_USD;
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * perUsd);
}

/* And back, for a price quoted in RWF that has to be reported in USD —
   the shared-space day rate on an invoice, say. */
export function usdForRwf(rwf, rate = FALLBACK_RWF_PER_USD) {
  const amount = Number(rwf);
  const perUsd = Number(rate) || FALLBACK_RWF_PER_USD;
  if (!Number.isFinite(amount) || perUsd <= 0) return 0;
  return Math.round((amount / perUsd) * 100) / 100;
}

/* "29,412 RWF". Grouped with an explicit locale rather than the
   visitor's, so the same price reads identically in the page, in the
   confirmation email and in the admin. */
export function formatRwf(rwf) {
  return `${Math.round(Number(rwf) || 0).toLocaleString("en-US")} RWF`;
}

export function formatUsd(usd) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(usd) || 0);
}
