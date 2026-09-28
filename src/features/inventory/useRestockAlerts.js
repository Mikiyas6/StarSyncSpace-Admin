import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { getLowStockRows } from "../../services/apiInventory";
import { isLowStock, stockState, suggestedRestock } from "../../utils/stock";

/* How often to look. A fridge does not empty in thirty seconds, so this
   polls far more slowly than the "client is leaving" check does — that
   one is racing a clock, this one is noticing a shelf. Two minutes is
   soon enough that somebody restocking at the desk sees the badge clear
   while they are still standing there. */
const POLL_INTERVAL = 2 * 60 * 1000;

/* ------------------------------------------------------------------
   Which rooms need what.

   The inventory page already shows this, and the sidebar already badges
   a count. Neither is a notification: both require somebody to have
   decided to go and look. The thing the desk actually needs is to be
   told — by name — that Meeting Room 02 has run out of Snickers, at the
   moment it happens rather than the next time anybody opens Inventory.

   "Low" is decided by isLowStock() in utils/stock.js, the same function
   the page and the badge use, so an alert can never fire for something
   the page would call fine.
   ------------------------------------------------------------------ */
export function useRestockAlerts() {
  const { data, isLoading } = useQuery({
    /* The same key the sidebar badge uses. One poll feeds both, and they
       cannot drift apart into two different opinions about what is
       low. */
    queryKey: ["low-stock"],
    queryFn: getLowStockRows,
    refetchInterval: POLL_INTERVAL,
    staleTime: 60 * 1000,
  });

  const alerts = useMemo(() => {
    const rows = (data ?? []).filter(isLowStock);

    return rows
      .map((row) => {
        const state = stockState(row);
        return {
          /* Stable across polls and unique per room+item, which is what
             lets the bell mark one as seen and the toast fire once
             rather than every two minutes for ever. */
          id: `restock:${row.roomId}:${row.menuItemId}`,
          kind: "restock",
          roomId: row.roomId,
          roomName: row.roomName,
          menuItemId: row.menuItemId,
          name: row.name,
          quantity: row.quantity,
          parLevel: row.par_level,
          /* "empty" and "low" are different jobs: one room is not
             selling something right now, the other is about to stop. */
          state,
          isOut: state === "empty",
          /* How many to bring to get back to target, so the alert
             carries the answer and not just the problem. */
          suggested: suggestedRestock(row),
        };
      })
      .sort((a, b) => {
        // Out of stock first: that room is losing sales right now.
        const urgency = Number(b.isOut) - Number(a.isOut);
        if (urgency !== 0) return urgency;
        // Then the emptiest relative to its own target, so a shelf at 1
        // of 12 outranks one at 2 of 3.
        const fill = (row) => (row.parLevel > 0 ? row.quantity / row.parLevel : 1);
        const byFill = fill(a) - fill(b);
        if (byFill !== 0) return byFill;
        return String(a.roomName).localeCompare(String(b.roomName));
      });
  }, [data]);

  return { alerts, isLoading };
}

/* The sentence an alert is shown as, in one place so the bell, the toast
   and anything added later cannot word it three ways. */
export function restockAlertText(alert) {
  if (!alert) return "";

  /* No pluralising of the item name. These are product names off a
     receipt — "Vitalo Still Water 500ml", "Snickers 2" — and an -s on
     the end of one reads as a typo, not as a plural. The count goes in
     front with a multiplication sign instead, which is how a stock
     figure is written anyway. */
  return alert.isOut
    ? `${alert.roomName} has run out of ${alert.name}. Bring ${alert.suggested}.`
    : `${alert.roomName} is down to ${alert.quantity} × ${alert.name} (target ${alert.parLevel}). Bring ${alert.suggested}.`;
}

export function restockAlertTitle(alert) {
  if (!alert) return "";
  return alert.isOut
    ? `Out of ${alert.name}`
    : `Running low on ${alert.name}`;
}
