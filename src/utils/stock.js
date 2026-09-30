/* ------------------------------------------------------------------
   Why stock moved.

   This is the distinction the whole inventory feature exists for. A
   bottle leaving a fridge can mean two completely different things:

     somebody BOUGHT it        → stock down, takings up
     somebody TOOK IT OUT      → stock down, takings untouched

   and the second case is not rare. Items get swapped for a different
   brand, pulled because they are near their date, moved to the other
   room's fridge, or broken. A system that treats every decrement as a
   sale reports revenue that never happened; one that treats none of them
   as a sale cannot tell you what the fridge earns.

   So every movement carries a reason, the reason decides whether money
   is involved, and that decision is made in one place — here for the
   UI's purposes, and independently in the database, where `revenue_rwf`
   is a GENERATED column that is zero for everything except a sale and
   cannot be overridden by a caller. The two agree because neither is
   allowed to be the only one.

   Mirrors the reason list in supabase/03-inventory.sql. Keep in step.
   ------------------------------------------------------------------ */

export const STOCK_REASONS = {
  sale: {
    label: "Sold",
    verb: "Sell",
    /* The only reason that is money. */
    isSale: true,
    direction: -1,
    /* Staff do this all day. */
    adminOnly: false,
    help: "A customer bought it. Reduces stock and counts towards the day's takings.",
    tag: "green",
  },

  removal: {
    label: "Removed",
    verb: "Remove",
    isSale: false,
    direction: -1,
    /* Admin-only, deliberately, though it is a decrement like a sale.

       A sale is answerable to something: the money is there or it is
       not, and the day's takings will disagree if a bottle left the
       fridge without one. A removal is answerable to nothing — it is
       the one line anybody can write that makes stock disappear with no
       counterpart anywhere. Leaving it with staff makes "sold it and
       kept the cash" indistinguishable from "took it out", by the
       person recording it. So the desk sells, and anything that leaves
       without money goes past an admin. */
    adminOnly: true,
    help: "Taken out without being sold — swapped for something else, moved to the kitchen, pulled from the shelf. Reduces stock and does NOT affect sales.",
    tag: "silver",
  },

  waste: {
    label: "Wasted",
    verb: "Write off",
    isSale: false,
    direction: -1,
    // Same reasoning as `removal` above: stock leaves, no money arrives.
    adminOnly: true,
    help: "Expired, spilt or broken. Reduces stock and does NOT affect sales.",
    tag: "coral",
  },

  transfer_out: {
    label: "Sent out",
    verb: "Send to another room",
    isSale: false,
    direction: -1,
    /* Stays with the desk, unlike the two above, because nothing is
       lost: the stock is still the business's and still counted, just
       in the other room. transfer_stock() writes both legs at once, so
       a transfer cannot leave one room short without the other gaining
       — which is exactly the counterpart `removal` and `waste` lack. */
    adminOnly: false,
    help: "Moved to a different room's fridge. Reduces stock here and does NOT affect sales.",
    tag: "silver",
  },

  restock: {
    label: "Restocked",
    verb: "Restock",
    isSale: false,
    direction: 1,
    /* Buying stock in is a purchasing decision, so it is an admin's. */
    adminOnly: true,
    help: "New stock arrived. Increases the count.",
    tag: "blue",
  },

  transfer_in: {
    label: "Brought in",
    verb: "Receive from another room",
    isSale: false,
    direction: 1,
    adminOnly: true,
    help: "Arrived from a different room's fridge. Increases the count.",
    tag: "blue",
  },

  correction: {
    label: "Recount",
    verb: "Correct the count",
    isSale: false,
    /* The only reason allowed either direction: a recount can go up or
       down, and which one it is depends on what was actually on the
       shelf, not on what is being recorded. */
    direction: 0,
    adminOnly: true,
    help: "The count was wrong. Adjusts it in either direction without touching sales. This is also how you undo a mistake — the ledger is append-only, so a wrong line is corrected rather than deleted.",
    tag: "yellow",
  },
};

/* The two lists the UI offers, in the order a person would look for
   them. Separated by who may record them, so a screen never has to
   filter by `adminOnly` itself and accidentally offer staff a restock
   that the database will refuse.

   As of supabase/20 the staff list is `sale` and `transfer_out` only.
   Mirrors the stock_movements insert policies — if these two ever
   disagree, the database wins and the UI is the one offering somebody
   work that fails. */
export const STAFF_REASONS = Object.entries(STOCK_REASONS)
  .filter(([, meta]) => !meta.adminOnly)
  .map(([reason]) => reason);

export const ADMIN_REASONS = Object.keys(STOCK_REASONS);

export function reasonsFor({ isAdmin }) {
  return isAdmin ? ADMIN_REASONS : STAFF_REASONS;
}

export function reasonMeta(reason) {
  return STOCK_REASONS[reason] ?? null;
}

export function reasonLabel(reason) {
  return STOCK_REASONS[reason]?.label ?? String(reason ?? "unknown");
}

export function isSaleReason(reason) {
  return Boolean(STOCK_REASONS[reason]?.isSale);
}

/* Turn "3 of these, sold" into the signed delta the ledger stores.

   One signed column rather than a quantity plus a direction, so a
   running total is a plain sum and no reader has to remember which
   reasons subtract. This is the only place the sign is decided, and it
   has to agree with the database's
   stock_movements_sign_matches_reason constraint — which will reject the
   row outright if it does not. */
export function deltaFor(reason, quantity, { increase = false } = {}) {
  const meta = STOCK_REASONS[reason];
  const count = Math.abs(Math.floor(Number(quantity) || 0));
  if (!meta || count === 0) return 0;

  // A recount is the one case the caller has to say which way.
  if (meta.direction === 0) return increase ? count : -count;

  return meta.direction * count;
}

/* ------------------------------ stock levels ---------------------- */

/* Is this room running low on this item?

   par_level is the line below which a fridge wants refilling, set per
   room per item — a fridge that holds 6 waters is low at 2, a shelf of
   60 is low at 12, so a single global threshold would be wrong for
   nearly everything.

   A par level of 0 means "no target set", and an item with no target
   cannot be below it. Without that, every item anybody had ever added
   would sit permanently in the restock list at quantity 0, and the badge
   in the sidebar would be furniture rather than a signal. */
export function stockState(row) {
  const quantity = Number(row?.quantity) || 0;
  const par = Number(row?.par_level) || 0;

  if (par <= 0) return quantity <= 0 ? "empty" : "untracked";
  if (quantity <= 0) return "empty";
  if (quantity <= par) return "low";
  return "ok";
}

export function isLowStock(row) {
  const state = stockState(row);
  return state === "low" || state === "empty";
}

export const STOCK_STATE_TAGS = {
  ok: { tag: "green", label: "In stock" },
  low: { tag: "yellow", label: "Running low" },
  empty: { tag: "red", label: "Out of stock" },
  untracked: { tag: "silver", label: "No target set" },
};

/* What to put in the box when somebody presses Restock: enough to bring
   this room back up to its par level, or one if there is no target. A
   sensible default is the difference between a restock that takes one
   keystroke and one that takes arithmetic. */
export function suggestedRestock(row) {
  const quantity = Number(row?.quantity) || 0;
  const par = Number(row?.par_level) || 0;
  return Math.max(1, par - quantity);
}

/* ------------------------------ what it makes -------------------- */

/* Margin on one item, from its selling price and what it costs to buy.

   `null` rather than 0 when the cost was never recorded, and the
   distinction is the whole point: an item with no cost on file would
   otherwise report a 100% margin, which is both wrong and the most
   flattering possible way to be wrong. A screen that gets null can say
   "not known"; one that gets 0 cannot tell that apart from a freebie. */
export function unitProfit(row) {
  const price = Number(row?.price);
  const cost = Number(row?.cost_rwf);
  if (!Number.isFinite(cost) || row?.cost_rwf == null) return null;
  if (!Number.isFinite(price)) return null;
  return price - cost;
}

export function marginPercent(row) {
  const profit = unitProfit(row);
  const price = Number(row?.price) || 0;
  if (profit === null || price <= 0) return null;
  return (profit / price) * 100;
}

/* Is this item selling for less than it costs?

   Worth its own function because it is the one pricing mistake that a
   sales figure actively hides: the more of it you sell, the better the
   takings look and the worse the month gets. */
export function isSoldAtALoss(row) {
  const profit = unitProfit(row);
  return profit !== null && profit < 0;
}
