import { useQuery } from "@tanstack/react-query";

import { getUsdToRwf } from "../../services/apiFx";
import { FALLBACK_RWF_PER_USD, FX_TTL_SECONDS, rwfForUsd } from "../../utils/fx";

/* The live exchange rate, once per hour per browser.

   `staleTime` is set against the app's global default of 0 on purpose.
   Every other query here wants to refetch on every mount and focus,
   because a booking or a stock level may have changed in the next room.
   An exchange rate has not: refetching it on every navigation would mean
   a cross-origin request per page view for a number that moves daily, and
   — worse — prices that flicker as you move around the dashboard.
*/
export function useFxRate() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["fx", "USD", "RWF"],
    queryFn: getUsdToRwf,
    staleTime: FX_TTL_SECONDS * 1000,
    gcTime: FX_TTL_SECONDS * 1000 * 4,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
    /* Never let a currency lookup put a spinner or an error boundary in
       front of the dashboard. getUsdToRwf() already resolves to the old
       constant rather than rejecting, and this is the second line of the
       same defence. */
    placeholderData: {
      rate: FALLBACK_RWF_PER_USD,
      source: "fallback",
      isFallback: true,
      isStale: true,
      fetchedAt: null,
    },
  });

  const rate = data?.rate ?? FALLBACK_RWF_PER_USD;

  return {
    rate,
    /* The conversion with the rate already applied, so no caller has to
       remember to pass it — forgetting is silent, and leaves a stale
       price on screen looking perfectly healthy. */
    toRwf: (usd) => rwfForUsd(usd, rate),
    source: data?.source ?? "fallback",
    fetchedAt: data?.fetchedAt ?? null,
    /* True when the number on screen is not a live reading. Worth
       surfacing: an admin setting a price deserves to know whether the
       RWF figure beside it is today's or a two-year-old constant. */
    isIndicative: Boolean(data?.isFallback || data?.isStale),
    isLoading,
    error,
  };
}
