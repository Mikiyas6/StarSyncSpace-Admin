import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { reconcileBookingStatuses } from "../../services/apiBookings";

/* ------------------------------------------------------------------
   Keeps booking statuses honest with the clock.

   Before this, "in use" and "completed" were both purely manual. A
   booking the desk did not touch stayed `booked` through its own
   session and forever afterwards, which is not a cosmetic problem: a
   `booked` row still holds the room, so the site went on showing the
   room as free while somebody sat in it, and the dashboard counted
   finished stays as upcoming.

   So the pages that show statuses ask the database to catch up first,
   then again on a timer while they stay open — a session that ends
   while the admin is looking at the list flips in front of them rather
   than on the next reload.

   Manual remains manual: nothing here can cancel a booking or call
   someone a no-show. See derivedStatus() in utils/booking.js.
   ------------------------------------------------------------------ */
const REFRESH_MS = 60 * 1000;

export function useReconcileStatuses() {
  const queryClient = useQueryClient();
  // Survives StrictMode's double-mount in dev, which would otherwise fire
  // two reconciles and two invalidations on every page load.
  const running = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (running.current) return;
      running.current = true;
      try {
        const { updated } = await reconcileBookingStatuses();
        // Only disturb the cache when something actually moved.
        if (updated > 0 && !cancelled)
          queryClient.invalidateQueries({ active: true });
      } finally {
        running.current = false;
      }
    }

    run();
    const id = setInterval(run, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [queryClient]);
}
