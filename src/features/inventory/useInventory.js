import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import {
  getInventory,
  getLowStockRows,
  getStockableItems,
  recordStockMovement,
  removeItemFromRoom,
  restockWithPrices,
  setParLevel,
  transferStock,
} from "../../services/apiInventory";
import { useUser } from "../authentication/useUser";
import { isLowStock, reasonLabel, reasonMeta } from "../../utils/stock";
import { menuQueryKey } from "../menu/useMenuOverview";
import { revalidateClientSite } from "../../services/revalidateClientSite";

/* Stock decides what the public menu offers (15-menu-item-stock.sql), so
   a movement can change the site — selling the last unit takes the item
   off it. The menu is rendered on the room pages, and the revalidate
   route drops the menu cache tag whatever path it is given. Best-effort
   by design: if the site is unreachable its own five-minute window still
   catches up. */
function refreshPublicMenu() {
  revalidateClientSite(["/rooms"]);
}

export function useInventory() {
  const { isLoading, data: stock, error } = useQuery({
    queryKey: ["inventory"],
    queryFn: getInventory,
  });

  return { isLoading, stock: stock ?? [], error };
}

export function useStockableItems() {
  const { isLoading, data: items, error } = useQuery({
    queryKey: ["stockable-items"],
    queryFn: getStockableItems,
  });

  return { isLoading, items: items ?? [], error };
}

/* The sidebar badge: how many room/item pairs need refilling.

   "Low" is decided by isLowStock() in utils/stock.js rather than by a SQL
   filter, so the badge and the page can never disagree about what counts
   as low — which they would the first time the par-level rule changed in
   one place and not the other. */
export function useLowStockCount() {
  const { data } = useQuery({
    queryKey: ["low-stock"],
    queryFn: getLowStockRows,
    staleTime: 60 * 1000,
  });

  return { lowCount: (data ?? []).filter(isLowStock).length };
}

/* Everything that changes a count goes through here.

   One mutation for all seven reasons rather than one per reason: they
   differ only in a string and a sign, and a single invalidation path means
   a sale and a restock can never refresh different halves of the screen.
*/
export function useRecordMovement() {
  const queryClient = useQueryClient();
  const { user } = useUser();

  const { mutate: record, isLoading: isRecording } = useMutation({
    mutationFn: (movement) =>
      recordStockMovement({
        ...movement,
        /* Who did it. The whole point of a ledger is that every line has
           a name against it, and the desk should never have to type it. */
        actorId: movement.actorId ?? user?.id ?? null,
      }),

    onSuccess: (row) => {
      const meta = reasonMeta(row.reason);
      const count = Math.abs(row.delta);

      /* The toast says which of the two things just happened, because
         that is the distinction a person can get wrong at the desk —
         pressing Remove when they meant Sell costs the day's takings a
         line. So a sale names the money and a removal says explicitly
         that there is none. */
      toast.success(
        meta?.isSale
          ? `${count} sold · ${Number(row.revenue_rwf).toLocaleString("en-US")} RWF`
          : `${count} ${reasonLabel(row.reason).toLowerCase()} — no change to sales`,
      );

      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
      /* The revenue screens read the ledger, so a sale has to move them
         too — otherwise the dashboard shows the takings from before the
         sale until somebody reloads. */
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      refreshPublicMenu();
    },

    onError: (error) => toast.error(error.message),
  });

  return { record, isRecording };
}

/* A delivery, with the prices it came in at.

   Separate from useRecordMovement() even though a restock IS a movement,
   because this one does a second thing — it re-prices the item — and that
   has to invalidate the menu screens too. Folding it into the general
   mutation would mean every sale also refetched the menu.
*/
export function useRestock() {
  const queryClient = useQueryClient();
  const { user } = useUser();

  const { mutate: restock, isLoading: isRestocking } = useMutation({
    mutationFn: (delivery) =>
      restockWithPrices({
        ...delivery,
        actorId: delivery.actorId ?? user?.id ?? null,
      }),

    onSuccess: (row) => {
      const count = Math.abs(Number(row?.delta) || 0);
      const spend = Number(row?.spend_rwf) || 0;

      /* Says what it cost, not just how many arrived. The figure is the
         one thing the person typing it can still check against the
         receipt in their hand. */
      toast.success(
        spend > 0
          ? `${count} in · ${spend.toLocaleString("en-US")} RWF spent`
          : `${count} in`,
      );

      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      refreshPublicMenu();
      /* The price may have changed, so everything that shows a price has
         to move: the stockable-items picker, and the menu itself. */
      queryClient.invalidateQueries({ queryKey: ["stockable-items"] });
      queryClient.invalidateQueries({ queryKey: menuQueryKey });
    },

    onError: (error) => toast.error(error.message),
  });

  return { restock, isRestocking };
}

/* Moving stock between rooms.

   Its own mutation because it touches TWO rooms, and the screen shows
   both: refreshing only the room the person was looking at would leave
   the destination's count stale until a reload — which is exactly the
   half-told story this whole feature is meant to avoid.
*/
export function useTransferStock() {
  const queryClient = useQueryClient();
  const { user } = useUser();

  const { mutate: transfer, isLoading: isTransferring } = useMutation({
    mutationFn: (move) =>
      transferStock({ ...move, actorId: move.actorId ?? user?.id ?? null }),

    onSuccess: ({ units }, variables) => {
      /* Names the destination. "2 moved" leaves the one thing worth
         confirming — that they went where they were meant to — unsaid. */
      toast.success(
        `${units} sent to ${variables.toRoomName ?? "the other room"} — no change to sales`,
      );

      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      refreshPublicMenu();
    },

    onError: (error) => toast.error(error.message),
  });

  return { transfer, isTransferring };
}

export function useSetParLevel() {
  const queryClient = useQueryClient();

  const { mutate: savePar, isLoading: isSavingPar } = useMutation({
    mutationFn: setParLevel,
    onSuccess: () => {
      toast.success("Stock target saved");
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
    },
    onError: (error) => toast.error(error.message),
  });

  return { savePar, isSavingPar };
}

/* Start carrying an item in a room, optionally with stock already in it.
 *
 * Two steps, in order, because they are two different facts:
 *
 *   the room's row and its target — a DECISION, no date, no quantity;
 *   the opening stock — a MOVEMENT, which the ledger dates and explains.
 *
 * Folding the opening amount into the row's quantity would put a number
 * on a shelf with nothing to say where it came from, which is the one
 * thing the ledger exists to prevent. So it is a real movement, and the
 * caller has to say which kind — see `openingReason` below.
 *
 * Not atomic, deliberately. If the movement fails the room is left
 * carrying the item at zero, which is exactly the state this form
 * produced before opening stock existed, is visible on the screen, and
 * is one Restock away from right. That is a good deal cheaper than
 * another migration for a failure that loses nothing.
 */
export function useAddItemToRoom() {
  const queryClient = useQueryClient();
  const { user } = useUser();

  const { mutate: addItem, isLoading: isAdding } = useMutation({
    mutationFn: async ({
      roomId,
      menuItemId,
      parLevel,
      openingQty = 0,
      /* 'restock'    — it arrived, money was spent. Books spend_rwf.
         'correction' — it was already on the shelf and we are only now
                        counting it. Books nothing.
         The difference is real money in the reports, which is why this
         is asked rather than assumed. */
      openingReason = "restock",
      unitCostRwf = null,
    }) => {
      await setParLevel({ roomId, menuItemId, parLevel });

      const units = Math.max(0, Math.floor(Number(openingQty) || 0));
      if (units === 0) return { units: 0 };

      const actorId = user?.id ?? null;

      if (openingReason === "correction") {
        await recordStockMovement({
          roomId,
          menuItemId,
          delta: units,
          reason: "correction",
          actorId,
          note: "Opening count — already on the shelf",
        });
      } else {
        await restockWithPrices({
          roomId,
          menuItemId,
          quantity: units,
          /* null leaves the item's own cost alone and stamps the
             movement with it, which is what we want: the price was
             already set when the item was created or picked. */
          unitCostRwf,
          actorId,
          note: "Opening stock",
        });
      }

      return { units, openingReason };
    },

    onSuccess: ({ units, openingReason }) => {
      toast.success(
        units === 0
          ? "Item added to the room"
          : openingReason === "correction"
            ? `Item added with ${units} already on the shelf`
            : `Item added and ${units} put in`,
      );

      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      refreshPublicMenu();
      queryClient.invalidateQueries({ queryKey: ["stockable-items"] });
    },

    onError: (error) => toast.error(error.message),
  });

  return { addItem, isAdding };
}

export function useRemoveItemFromRoom() {
  const queryClient = useQueryClient();

  const { mutate: removeItem, isLoading: isRemovingItem } = useMutation({
    mutationFn: removeItemFromRoom,
    onSuccess: () => {
      toast.success("Item taken off this room's list");
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
    },
    onError: (error) => toast.error(error.message),
  });

  return { removeItem, isRemovingItem };
}
