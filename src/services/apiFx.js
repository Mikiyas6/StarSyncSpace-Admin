/* The live USD → RWF rate, for the dashboard.

   The client site caches this on its own server, in Next's data cache.
   This app has no server, so the arrangement is:

     1. read the shared `fx_rates` row. If it was taken within the hour,
        that is the answer, and no browser anywhere has to make a
        cross-origin request for it;
     2. otherwise fetch the rates API directly — it sends permissive CORS
        headers, which is why a browser may — and write the reading back
        through upsert_fx_rate() so the next person to open the dashboard,
        and the public site, both get it for free;
     3. if that fails, use whatever is stored however old it is, and say
        so, so a price can be marked indicative rather than presented as
        a quote;
     4. and if there is nothing at all, the old hardcoded constant.

   Step 1 before step 2 is the important ordering. It means N admins with
   the dashboard open make ONE call to the rates API per hour between
   them, not N — and that the number on this screen is the same number on
   the public site, rather than two independent readings that differ.
*/

import supabase from "./supabase";
import {
  FALLBACK_RWF_PER_USD,
  FX_ENDPOINT,
  isPlausibleRate,
  isStale,
  parseRateTimestamp,
  parseRwfRate,
} from "../utils/fx";

async function readStoredRate() {
  const { data, error } = await supabase
    .from("fx_rates")
    .select("rate, source, fetched_at")
    .eq("base", "USD")
    .eq("quote", "RWF")
    .maybeSingle();

  if (error) {
    // 42P01 / PGRST205: the table does not exist, i.e. the migration has
    // not been run. Worth telling apart from a transient failure, because
    // this one needs a person rather than a retry.
    if (error.code === "42P01" || error.code === "PGRST205")
      console.warn(
        "[fx] fx_rates does not exist yet — run supabase/04-fx-rates.sql",
      );
    else console.error("[fx] stored rate unreadable:", error.message);
    return null;
  }

  if (!data || !isPlausibleRate(data.rate)) return null;

  return {
    rate: Number(data.rate),
    fetchedAt: new Date(data.fetched_at),
    source: data.source ?? "stored",
  };
}

async function fetchLiveRate() {
  try {
    const response = await fetch(FX_ENDPOINT, {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      console.error("[fx] rates API responded", response.status);
      return null;
    }

    const payload = await response.json();
    const rate = parseRwfRate(payload);
    if (rate === null) {
      console.error("[fx] rates API payload had no usable RWF rate");
      return null;
    }

    return { rate, fetchedAt: parseRateTimestamp(payload), source: "api" };
  } catch (error) {
    console.error("[fx] rates API unreachable:", error.message);
    return null;
  }
}

async function storeRate(rate) {
  // Best effort: the caller has a good rate in hand and must not fail
  // because the shared copy could not be updated.
  const { error } = await supabase.rpc("upsert_fx_rate", {
    p_base: "USD",
    p_quote: "RWF",
    p_rate: rate,
    p_source: "api",
  });
  if (error) console.warn("[fx] could not store rate:", error.message);
}

export async function getUsdToRwf() {
  const stored = await readStoredRate();

  // Fresh enough, and shared with the public site. Nothing more to do.
  if (stored && stored.source !== "seed" && !isStale(stored.fetchedAt)) {
    return { ...stored, isFallback: false, isStale: false };
  }

  const live = await fetchLiveRate();
  if (live) {
    await storeRate(live.rate);
    return { ...live, isFallback: false, isStale: false };
  }

  if (stored) {
    return {
      ...stored,
      isFallback: false,
      // `seed` is the migration's bootstrap value: the old constant
      // wearing a timestamp, never actually refreshed.
      isStale: true,
    };
  }

  return {
    rate: FALLBACK_RWF_PER_USD,
    fetchedAt: null,
    source: "fallback",
    isFallback: true,
    isStale: true,
  };
}
