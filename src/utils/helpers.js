import { formatDistance, parseISO } from "date-fns";
import { differenceInDays } from "date-fns";

// We want to make this function work for both Date objects and strings (which come from Supabase)
export const subtractDates = (dateStr1, dateStr2) =>
  differenceInDays(parseISO(String(dateStr1)), parseISO(String(dateStr2)));

export const formatDistanceFromNow = (dateStr) =>
  formatDistance(parseISO(dateStr), new Date(), {
    addSuffix: true,
  })
    .replace("about ", "")
    .replace("in", "In");

// Supabase needs an ISO date string. However, that string will be different on every render because the MS or SEC have changed, which isn't good. So we use this trick to remove any time
export const getToday = function (options = {}) {
  const today = new Date();
  console.log("Today:", today);

  // This is necessary to compare with created_at from Supabase, because it it not at 0.0.0.0, so we need to set the date to be END of the day when we compare it with earlier dates
  if (options?.end)
    // Set to the last second of the day
    today.setUTCHours(23, 59, 59, 999);
  else today.setUTCHours(0, 0, 0, 0);
  return today.toISOString();
};

export const formatCurrency = (value) =>
  new Intl.NumberFormat("en", { style: "currency", currency: "USD" }).format(
    value
  );

/* Rooms store one price — RWF per HOUR (rooms.hour_rate_rwf) — and the
   dollar figure a page shows beside it is derived from the LIVE rate, so
   admin only ever edits a single number per room.

   This constant is the last-resort fallback for that conversion, kept in
   sync with RWF_PER_USD in the client's fx-math.js. It is not a price and
   must not be used to compute one: anything that needs the live rate
   takes it from useFxRate(). */
export const RWF_PER_USD = 1470.59;

/* Francs, grouped, with the unit — "30,000 RWF".

   It used to take a USD figure and multiply it by the constant above,
   which meant every price in the rooms table was quoted at a rate from
   2025 no matter what the currency had done since. Prices are in francs
   now (migration 21), so there is nothing to convert. */
export const formatRwfAmount = (rwf) =>
  `${Math.round(Number(rwf) || 0).toLocaleString("en-US")} RWF`;

// Menu prices are stored numerically with their own currency column (RWF by
// default). Format as "12,000 RWF" so the display never depends on locale.
export const formatMenuPrice = (value, currency = "RWF") => {
  const amount = new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(Number(value) || 0);

  return `${amount} ${(currency || "RWF").toUpperCase()}`;
};
