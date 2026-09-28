import { useQuery } from "@tanstack/react-query";

import { getBookingsInRange } from "../../services/apiBookings";
import { timelineRange } from "./availability";

/* ------------------------------------------------------------------
   The bookings the whole board is drawn from, in one request.

   Fetched over the TIMELINE's range rather than the search window's. The
   strip beside each room shows the whole day the window falls in, so the
   day is the wider of the two and asking for it once covers both — the
   verdict reads the window out of the same rows the strip is drawn from,
   and the two can never be computed from different data.

   Keyed on the day, not on the window, which is what makes dragging the
   start time around inside one day free after the first request: every
   such move is the same query key and answered from cache while the
   arithmetic re-runs locally.
   ------------------------------------------------------------------ */
export function useRoomsAvailability(start, end) {
  const range = start && end && end > start ? timelineRange(start, end) : null;

  const { data: bookings = [], isLoading, isFetching, error } = useQuery({
    queryKey: [
      "availability",
      range?.from.toISOString() ?? null,
      range?.to.toISOString() ?? null,
    ],
    queryFn: () => getBookingsInRange(range.from, range.to),
    enabled: Boolean(range),
  });

  return { bookings, range, isLoading, isFetching, error };
}
