/* ------------------------------------------------------------------
   Where the money came from.

   Three streams, which the brief asks to be told apart and which really
   are different businesses:

     meeting rooms   rented whole, by the minute
     shared spaces   sold one seat at a time, by the day or the month
     snacks          sold out of the fridges and off the shelves

   The first two come out of `bookings`, split by the room's type. The
   third comes out of `stock_movements`, and ONLY from its sales — a
   removal, a write-off, a restock and a transfer all move stock without
   moving money, and `revenue_rwf` is a generated column in the database
   that is zero for every one of them. That is what makes "we are three
   Cokes down" and "we sold two and binned one" different facts here
   rather than the same subtraction.

   ---------------------------------------------------------------
    EVERYTHING IS IN RWF
   ---------------------------------------------------------------
   Rooms are priced in USD, snacks in RWF. Adding them needs one
   currency, and RWF is the right one: it is what customers actually pay
   and what the business banks.

   The conversion is NOT done at today's exchange rate. A booking carries
   `amount_rwf` — what was actually charged, frozen when it was paid — and
   that is used whenever it is there. Re-deriving a past charge from a
   later rate would make last month's takings move on their own, which is
   the one thing a revenue report must never do. The live rate is a
   fallback for old rows that predate that column, and where it is used
   the result says so, so a total is never quietly part-estimate.

   All pure functions: no queries, no dates read off the clock unless
   passed in. See revenue.test.js.
   ------------------------------------------------------------------ */

import {
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  eachYearOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";

import { rwfForUsd } from "../../utils/fx";
import { isSaleReason } from "../../utils/stock";

export const STREAMS = {
  MEETING_ROOMS: "meetingRooms",
  SHARED_SPACES: "sharedSpaces",
  SNACKS: "snacks",
};

/* Labels and colours in one place, so the cards, the bars and the legend
   cannot drift into describing the same stream three ways. The colours are
   the admin's own CSS variables rather than literals, so both themes work
   without a second palette. */
export const STREAM_META = {
  [STREAMS.MEETING_ROOMS]: {
    label: "Meeting rooms",
    color: "var(--color-chart-1)",
    shortLabel: "Rooms",
  },
  [STREAMS.SHARED_SPACES]: {
    label: "Shared spaces",
    color: "var(--color-chart-2)",
    shortLabel: "Desks",
  },
  [STREAMS.SNACKS]: {
    label: "Snacks & drinks",
    color: "var(--color-chart-3)",
    shortLabel: "Snacks",
  },
};

export const STREAM_ORDER = [
  STREAMS.MEETING_ROOMS,
  STREAMS.SHARED_SPACES,
  STREAMS.SNACKS,
];

/* ------------------------------------------------------------------
   Which bookings are money
   ------------------------------------------------------------------ */

/* A booking counts towards the takings when it was paid for, or when it
   is a confirmed booking taken at the desk that has not been called off.

   The two exclusions matter:

     pending  the customer is still on the payment page. Counting it
              would book revenue for a card that may be declined ten
              seconds from now.
     failed   the payment did not go through, or the hold expired.

   Cancelled and no-show bookings DO count when they were paid, because
   this space's terms are non-refundable — the money was taken and the
   business kept it. Counting them as zero would understate the takings
   and make the bank statement impossible to reconcile against this
   report. Where that is not wanted, pass `countForfeited: false`. */
export function isRevenueBooking(booking, { countForfeited = true } = {}) {
  const status = booking?.status;
  if (status === "pending" || status === "failed") return false;

  const forfeited = status === "cancelled" || status === "no-show";
  if (forfeited) return countForfeited && Boolean(booking?.isPaid);

  return true;
}

/* What a booking brought in, in RWF.

   `amount_rwf` first, always: it is what was charged. Only a row that
   predates the column falls back to converting its USD total, and the
   caller is told (`estimated`) so a total is never silently part-guess. */
export function bookingRevenueRwf(booking, rate) {
  const charged = Number(booking?.amount_rwf);
  if (Number.isFinite(charged) && charged > 0)
    return { rwf: charged, estimated: false };

  const usd = Number(booking?.totalPrice);
  if (!Number.isFinite(usd) || usd <= 0) return { rwf: 0, estimated: false };

  return { rwf: rwfForUsd(usd, rate), estimated: true };
}

/* Which stream a booking belongs to.

   Reads the room's type from the joined row. A booking whose room did not
   come back from the join — or whose room predates the column — counts as
   a meeting room, which is what every booking in the table was before
   shared spaces existed. */
export function streamForBooking(booking) {
  const type = booking?.rooms?.room_type ?? booking?.room_type;
  return type === "shared_space" ? STREAMS.SHARED_SPACES : STREAMS.MEETING_ROOMS;
}

/* What a stock movement brought in.

   `revenue_rwf` is generated by the database and is zero for everything
   that is not a sale, so this could simply read it. The reason check is
   here anyway, as a second lock on the one number in this file that must
   never include a removal: if the column were ever dropped, mis-migrated
   or replaced by a plain column somebody could write, this would still
   refuse to count a write-off as income. */
export function movementRevenueRwf(movement) {
  if (!isSaleReason(movement?.reason)) return 0;
  const revenue = Number(movement?.revenue_rwf);
  if (Number.isFinite(revenue) && revenue > 0) return revenue;

  // Older rows, or a database without the generated column.
  const units = Math.abs(Number(movement?.delta) || 0);
  const unitPrice = Number(movement?.unit_price_rwf) || 0;
  return units * unitPrice;
}

/* What a sale COST us, and therefore what it made.

   The same defensive shape as movementRevenueRwf above, for the same
   reason: `cogs_rwf` and `profit_rwf` are generated columns in the
   database that are zero for anything that is not a sale, and these
   re-check the reason so that a write-off can never be counted as a
   cost of sale even if the columns were dropped or mis-migrated.

   A sale with no cost on file returns 0 cost, which reports the whole
   sale as profit. That is a real gap, not a rounding one, so it is
   counted: see `unpricedUnits` on the totals, which is how a screen can
   say "this margin is missing the cost of 12 units" rather than quietly
   overstating the month. */
export function movementCostRwf(movement) {
  if (!isSaleReason(movement?.reason)) return 0;
  const cogs = Number(movement?.cogs_rwf);
  if (Number.isFinite(cogs) && cogs > 0) return cogs;

  const units = Math.abs(Number(movement?.delta) || 0);
  const unitCost = Number(movement?.unit_cost_rwf) || 0;
  return units * unitCost;
}

export function movementProfitRwf(movement) {
  if (!isSaleReason(movement?.reason)) return 0;
  const profit = Number(movement?.profit_rwf);
  if (Number.isFinite(profit) && profit !== 0) return profit;

  /* Not `revenue - cogs` read off the columns: if either is missing
     this recomputes both from the frozen unit figures, so the answer is
     consistent rather than half-generated and half-derived. */
  return movementRevenueRwf(movement) - movementCostRwf(movement);
}

/* Money OUT: what a delivery cost. Only a restock — a transfer between
   two rooms is the same crate in a different fridge, and counting it
   would report buying it twice. */
export function movementSpendRwf(movement) {
  if (movement?.reason !== "restock") return 0;
  const spend = Number(movement?.spend_rwf);
  if (Number.isFinite(spend) && spend > 0) return spend;

  const units = Math.abs(Number(movement?.delta) || 0);
  const unitCost = Number(movement?.unit_cost_rwf) || 0;
  return units * unitCost;
}

/* Units sold with no buying price on file. The caveat that keeps the
   profit figure honest. */
export function unpricedSaleUnits(movement) {
  if (!isSaleReason(movement?.reason)) return 0;
  const unitCost = Number(movement?.unit_cost_rwf);
  if (Number.isFinite(unitCost) && unitCost > 0) return 0;
  return Math.abs(Number(movement?.delta) || 0);
}

/* ------------------------------------------------------------------
   Totals
   ------------------------------------------------------------------ */

function emptyTotals() {
  return {
    [STREAMS.MEETING_ROOMS]: 0,
    [STREAMS.SHARED_SPACES]: 0,
    [STREAMS.SNACKS]: 0,
  };
}

/* The headline: what each stream earned over the whole range. */
export function revenueByStream({
  bookings = [],
  movements = [],
  rate,
  dateField = "created_at",
  countForfeited = true,
} = {}) {
  const totals = emptyTotals();
  let estimatedRwf = 0;

  for (const booking of bookings) {
    if (!isRevenueBooking(booking, { countForfeited })) continue;
    const { rwf, estimated } = bookingRevenueRwf(booking, rate);
    totals[streamForBooking(booking)] += rwf;
    if (estimated) estimatedRwf += rwf;
  }

  /* Snacks are the one stream with a cost of goods, so they are the one
     stream that can report a profit. A room has no unit cost — the hour
     is the product — so `profit` here is a snack figure, and is named on
     the totals as such rather than pretending to be a business-wide
     bottom line it is not. */
  let snacksCostRwf = 0;
  let snacksSpendRwf = 0;
  let unpricedUnits = 0;

  for (const movement of movements) {
    totals[STREAMS.SNACKS] += movementRevenueRwf(movement);
    snacksCostRwf += movementCostRwf(movement);
    snacksSpendRwf += movementSpendRwf(movement);
    unpricedUnits += unpricedSaleUnits(movement);
  }

  const total =
    totals[STREAMS.MEETING_ROOMS] +
    totals[STREAMS.SHARED_SPACES] +
    totals[STREAMS.SNACKS];

  return {
    ...totals,
    total,
    /* How much of the total came from converting a USD figure at today's
       rate rather than reading what was charged. Surfaced so a report can
       caveat itself instead of presenting an estimate as a fact. */
    estimatedRwf,
    /* Rooms and snacks as a share, which is the comparison anybody
       actually wants out of a fridge: is it worth the trouble? */
    rooms: totals[STREAMS.MEETING_ROOMS] + totals[STREAMS.SHARED_SPACES],

    /* What the fridges actually MADE, which is the question a takings
       figure on its own cannot answer. 9,000 RWF of snacks that cost
       5,100 to buy is a different business from 9,000 that cost 8,500,
       and only this line tells them apart. */
    snacksCostRwf,
    snacksProfitRwf: totals[STREAMS.SNACKS] - snacksCostRwf,

    /* Money that went OUT on stock in this period. Deliberately NOT
       subtracted from anything: a delivery is not a cost of this month's
       sales, it is stock sitting in a fridge, and netting it off would
       make the month you restock look like a disaster and the month you
       run the shelves down look like a triumph. */
    snacksSpendRwf,

    /* Units sold with no buying price recorded. Those sales are counted
       as pure profit above, because there is nothing else to do with
       them — so a screen showing the profit has to be able to say how
       much of it is unverified. */
    unpricedUnits,

    dateField,
  };
}

/* Per room, so "which room makes the most money" has an answer.

   Snacks are attributed to the room they were sold in, and returned
   alongside the room's own booking income rather than mixed into it — a
   room that sells 200,000 RWF of drinks and 50,000 of bookings is telling
   you something a single total would hide. */
export function revenueByRoom({
  bookings = [],
  movements = [],
  rooms = [],
  rate,
  countForfeited = true,
} = {}) {
  const byId = new Map();

  function ensure(id, name, type) {
    if (!byId.has(id))
      byId.set(id, {
        roomId: id,
        roomName: name ?? "Unknown room",
        roomType: type ?? "meeting_room",
        bookingsRwf: 0,
        snacksRwf: 0,
        snacksCostRwf: 0,
        snacksProfitRwf: 0,
        bookingCount: 0,
        unitsSold: 0,
      });
    return byId.get(id);
  }

  // Seeded from the room list so a room that earned nothing still appears
  // at zero — which is itself the finding.
  for (const room of rooms) ensure(room.id, room.name, room.room_type);

  for (const booking of bookings) {
    if (!isRevenueBooking(booking, { countForfeited })) continue;
    const entry = ensure(
      booking.roomId,
      booking.rooms?.name,
      booking.rooms?.room_type,
    );
    entry.bookingsRwf += bookingRevenueRwf(booking, rate).rwf;
    entry.bookingCount += 1;
  }

  for (const movement of movements) {
    const revenue = movementRevenueRwf(movement);
    const entry = ensure(
      movement.room_id,
      movement.rooms?.name,
      movement.rooms?.room_type,
    );
    entry.snacksRwf += revenue;
    entry.snacksCostRwf += movementCostRwf(movement);
    entry.snacksProfitRwf += movementProfitRwf(movement);
    if (revenue > 0) entry.unitsSold += Math.abs(Number(movement.delta) || 0);
  }

  return [...byId.values()]
    .map((entry) => ({ ...entry, totalRwf: entry.bookingsRwf + entry.snacksRwf }))
    .sort((a, b) => b.totalRwf - a.totalRwf);
}

/* ------------------------------------------------------------------
   Over time — per day, week, month or year
   ------------------------------------------------------------------ */

const GRANULARITIES = {
  day: {
    each: eachDayOfInterval,
    start: startOfDay,
    end: endOfDay,
    label: (date) => format(date, "MMM dd"),
  },
  week: {
    /* weekStartsOn has to be passed to all THREE of these, not just the
       two boundary functions. date-fns defaults to Sunday, so an
       eachWeekOfInterval() left bare hands back Sunday-aligned weeks
       while start/end align to Monday — the buckets and the interval
       tests then disagree, and a week's takings land in the wrong bar or
       get counted twice at the seam. */
    each: (interval) => eachWeekOfInterval(interval, { weekStartsOn: 1 }),
    start: (date) => startOfWeek(date, { weekStartsOn: 1 }),
    end: (date) => endOfWeek(date, { weekStartsOn: 1 }),
    // The week beginning, because "W39" means nothing to anybody.
    label: (date) => format(date, "'w/c' MMM dd"),
  },
  month: {
    each: eachMonthOfInterval,
    start: startOfMonth,
    end: endOfMonth,
    label: (date) => format(date, "MMM yyyy"),
  },
  year: {
    each: eachYearOfInterval,
    start: startOfYear,
    end: endOfYear,
    label: (date) => format(date, "yyyy"),
  },
};

export const GRANULARITY_OPTIONS = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
];

function timestampOf(record, dateField) {
  const raw = record?.[dateField] ?? record?.created_at;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/* One row per period, with every stream on it — the shape a stacked bar
   or a multi-series line wants, with no further work in the component.

   Every period in the range is present, including the empty ones. A chart
   that silently omits a quiet Tuesday draws a line straight from Monday
   to Wednesday and makes a dead day look like a busy one.
*/
export function revenueSeries({
  bookings = [],
  movements = [],
  from,
  to,
  granularity = "day",
  rate,
  dateField = "created_at",
  countForfeited = true,
} = {}) {
  const config = GRANULARITIES[granularity] ?? GRANULARITIES.day;

  const rangeStart = config.start(new Date(from));
  const rangeEnd = config.end(new Date(to));
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()))
    return [];
  if (rangeEnd < rangeStart) return [];

  const buckets = config
    .each({ start: rangeStart, end: rangeEnd })
    .map((date) => ({
      date,
      label: config.label(date),
      start: config.start(date),
      end: config.end(date),
      ...emptyTotals(),
      total: 0,
    }));

  function bucketFor(date) {
    return buckets.find((bucket) =>
      isWithinInterval(date, { start: bucket.start, end: bucket.end }),
    );
  }

  for (const booking of bookings) {
    if (!isRevenueBooking(booking, { countForfeited })) continue;
    const date = timestampOf(booking, dateField);
    if (!date) continue;
    const bucket = bucketFor(date);
    if (!bucket) continue;

    bucket[streamForBooking(booking)] += bookingRevenueRwf(booking, rate).rwf;
  }

  for (const movement of movements) {
    const revenue = movementRevenueRwf(movement);
    if (!revenue) continue;
    const date = timestampOf(movement, "created_at");
    if (!date) continue;
    const bucket = bucketFor(date);
    if (!bucket) continue;

    bucket[STREAMS.SNACKS] += revenue;
  }

  for (const bucket of buckets) {
    bucket.total =
      bucket[STREAMS.MEETING_ROOMS] +
      bucket[STREAMS.SHARED_SPACES] +
      bucket[STREAMS.SNACKS];
  }

  return buckets;
}

/* ------------------------------------------------------------------
   What sold
   ------------------------------------------------------------------ */

/* The best sellers, by money and by units — which are not the same
   ranking, and the difference is the useful part: a cheap thing that
   shifts constantly and an expensive thing that sells occasionally are
   both worth restocking, for different reasons. */
export function topSellingItems(movements = [], limit = 8) {
  const byItem = new Map();

  for (const movement of movements) {
    const revenue = movementRevenueRwf(movement);
    if (!revenue) continue;

    const id = movement.menu_item_id;
    if (!byItem.has(id))
      byItem.set(id, {
        menuItemId: id,
        name: movement.menu_items?.name ?? "Unknown item",
        units: 0,
        rwf: 0,
        costRwf: 0,
        profitRwf: 0,
      });

    const entry = byItem.get(id);
    entry.units += Math.abs(Number(movement.delta) || 0);
    entry.rwf += revenue;
    entry.costRwf += movementCostRwf(movement);
    entry.profitRwf += movementProfitRwf(movement);
  }

  return [...byItem.values()].sort((a, b) => b.rwf - a.rwf).slice(0, limit);
}

/* Stock that left WITHOUT being sold, which is the other half of the
   story and the number nobody has been able to see.

   Worth reporting on its own: a room losing twelve waters a week to
   write-offs is a fridge problem, and it is invisible in a sales report
   by construction. */
export function shrinkageByReason(movements = []) {
  const byReason = new Map();

  for (const movement of movements) {
    if (isSaleReason(movement?.reason)) continue;
    const delta = Number(movement?.delta) || 0;
    // Only things going OUT. A restock is not shrinkage.
    if (delta >= 0) continue;

    const reason = movement.reason;
    if (!byReason.has(reason)) byReason.set(reason, { reason, units: 0 });
    byReason.get(reason).units += Math.abs(delta);
  }

  return [...byReason.values()].sort((a, b) => b.units - a.units);
}
