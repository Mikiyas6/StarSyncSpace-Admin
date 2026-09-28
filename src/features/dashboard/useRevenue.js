import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { getRevenueBookings } from "../../services/apiBookings";
import { getStockMovements } from "../../services/apiInventory";
import { useRooms } from "../rooms/useRooms";
import { useFxRate } from "../fx/useFxRate";
import { useDateRange } from "./useDateRange";
import {
  revenueByRoom,
  revenueByStream,
  revenueSeries,
  shrinkageByReason,
  topSellingItems,
} from "./revenue";

/* How finely to slice the range: day, week, month or year.

   In the URL alongside the date range, so a particular view of the
   takings is a link somebody can send. Defaulted by the LENGTH of the
   range rather than to a fixed value — 365 days of daily bars is an
   unreadable smear, and a week rolled up by month is a single bar. */
export function useGranularity() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { numDays } = useDateRange();

  const fromUrl = searchParams.get("per");

  const granularity =
    fromUrl ??
    (numDays <= 31 ? "day" : numDays <= 120 ? "week" : numDays <= 800 ? "month" : "year");

  function setGranularity(value) {
    const params = new URLSearchParams(searchParams);
    params.set("per", value);
    setSearchParams(params);
  }

  return { granularity, setGranularity, isExplicit: Boolean(fromUrl) };
}

/* Everything the revenue screens need, aggregated.

   The two queries are independent and the aggregation is pure, so the
   whole thing is one useMemo over whatever has arrived — which means a
   slow stock query does not hold up the room figures.
*/
export function useRevenue() {
  const { startDate, endDate, numDays } = useDateRange();
  const { granularity } = useGranularity();
  const { rate, isIndicative } = useFxRate();
  const { rooms } = useRooms();

  const from = startDate.toISOString();
  const to = endDate.toISOString();

  const bookingsQuery = useQuery({
    queryKey: ["revenue-bookings", from, to],
    queryFn: () => getRevenueBookings(from, to),
  });

  const movementsQuery = useQuery({
    queryKey: ["stock-movements", from, to],
    queryFn: () => getStockMovements({ from, to }),
    /* The stock tables may not exist yet. That must not take the revenue
       dashboard down — the room figures are still perfectly good — so the
       error is held and reported as a missing section rather than thrown. */
    retry: false,
  });

  /* Depended on directly rather than via a `?? []` default computed
     outside the memo: that default is a NEW array on every render, so the
     memo's dependencies always changed and the whole aggregation ran on
     every keystroke anywhere on the page. The defaulting moves inside. */
  const bookingsData = bookingsQuery.data;
  const movementsData = movementsQuery.data;

  const aggregates = useMemo(() => {
    const bookings = bookingsData ?? [];
    const movements = movementsData ?? [];

    return {
      totals: revenueByStream({ bookings, movements, rate }),
      series: revenueSeries({
        bookings,
        movements,
        from: startDate,
        to: endDate,
        granularity,
        rate,
      }),
      byRoom: revenueByRoom({ bookings, movements, rooms, rate }),
      topItems: topSellingItems(movements),
      shrinkage: shrinkageByReason(movements),
    };
  }, [bookingsData, movementsData, rooms, rate, startDate, endDate, granularity]);

  return {
    ...aggregates,
    granularity,
    numDays,
    startDate,
    endDate,
    /* True when some part of the total came from converting USD at
       today's rate, or when that rate is itself a fallback. A report that
       is part-estimate should say so rather than presenting itself as
       fact. */
    isEstimated: aggregates.totals.estimatedRwf > 0 || isIndicative,
    isLoading: bookingsQuery.isLoading,
    isLoadingStock: movementsQuery.isLoading,
    error: bookingsQuery.error,
    stockError: movementsQuery.error,
  };
}
