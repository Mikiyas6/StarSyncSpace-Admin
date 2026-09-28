import { describe, expect, it } from "vitest";

import {
  STREAMS,
  bookingRevenueRwf,
  isRevenueBooking,
  movementCostRwf,
  movementProfitRwf,
  movementRevenueRwf,
  movementSpendRwf,
  revenueByRoom,
  revenueByStream,
  revenueSeries,
  shrinkageByReason,
  streamForBooking,
  topSellingItems,
  unpricedSaleUnits,
} from "./revenue";

const RATE = 1500;

function booking({
  roomType = "meeting_room",
  roomName = "Meeting Room 01",
  roomId = 1,
  amountRwf = 30000,
  totalPrice = 20,
  status = "completed",
  isPaid = true,
  createdAt = "2026-09-20T10:00:00Z",
} = {}) {
  return {
    roomId,
    rooms: { id: roomId, name: roomName, room_type: roomType },
    amount_rwf: amountRwf,
    totalPrice,
    status,
    isPaid,
    created_at: createdAt,
  };
}

function movement({
  reason = "sale",
  delta = -2,
  unitPrice = 1500,
  unitCost = null,
  revenue,
  roomId = 1,
  roomName = "Meeting Room 01",
  menuItemId = 10,
  itemName = "Coke",
  createdAt = "2026-09-20T12:00:00Z",
} = {}) {
  return {
    room_id: roomId,
    rooms: { id: roomId, name: roomName, room_type: "meeting_room" },
    menu_item_id: menuItemId,
    menu_items: { id: menuItemId, name: itemName },
    delta,
    reason,
    unit_price_rwf: unitPrice,
    unit_cost_rwf: unitCost,
    revenue_rwf:
      revenue ?? (reason === "sale" ? Math.abs(delta) * unitPrice : 0),
    /* The generated columns, mirrored the way the database computes
       them, so these fixtures exercise the read-the-column path rather
       than only the recompute-from-units fallback. */
    cogs_rwf:
      reason === "sale" ? Math.abs(delta) * (Number(unitCost) || 0) : 0,
    spend_rwf:
      reason === "restock" ? Math.abs(delta) * (Number(unitCost) || 0) : 0,
    profit_rwf:
      reason === "sale"
        ? Math.abs(delta) * unitPrice - Math.abs(delta) * (Number(unitCost) || 0)
        : 0,
    created_at: createdAt,
  };
}

describe("which bookings are money", () => {
  it("counts a completed, paid booking", () => {
    expect(isRevenueBooking(booking())).toBe(true);
  });

  /* The customer is still on the payment page. Counting it would book
     revenue for a card that may be declined ten seconds from now. */
  it("does not count a pending booking", () => {
    expect(isRevenueBooking(booking({ status: "pending" }))).toBe(false);
  });

  it("does not count a failed payment", () => {
    expect(isRevenueBooking(booking({ status: "failed" }))).toBe(false);
  });

  /* Non-refundable terms: the money was taken and kept. */
  it("counts a paid booking that was cancelled, because the terms are non-refundable", () => {
    expect(isRevenueBooking(booking({ status: "cancelled", isPaid: true }))).toBe(
      true,
    );
    expect(isRevenueBooking(booking({ status: "no-show", isPaid: true }))).toBe(
      true,
    );
  });

  it("does not count an unpaid cancellation", () => {
    expect(
      isRevenueBooking(booking({ status: "cancelled", isPaid: false })),
    ).toBe(false);
  });

  it("can be told to exclude forfeited money entirely", () => {
    expect(
      isRevenueBooking(booking({ status: "cancelled", isPaid: true }), {
        countForfeited: false,
      }),
    ).toBe(false);
  });
});

describe("what a booking brought in", () => {
  /* The rule that keeps last month's takings from moving on their own. */
  it("uses what was actually charged, not today's exchange rate", () => {
    const paid = booking({ amountRwf: 29411, totalPrice: 20 });
    expect(bookingRevenueRwf(paid, RATE)).toEqual({
      rwf: 29411,
      estimated: false,
    });
    // A different rate must not change a charge already taken.
    expect(bookingRevenueRwf(paid, 1700).rwf).toBe(29411);
  });

  it("falls back to converting USD for a row with no charged amount, and says so", () => {
    const legacy = booking({ amountRwf: null, totalPrice: 20 });
    expect(bookingRevenueRwf(legacy, RATE)).toEqual({
      rwf: 30000,
      estimated: true,
    });
  });

  it("is zero for a booking with no money on it at all", () => {
    expect(bookingRevenueRwf({ amount_rwf: null, totalPrice: 0 }, RATE).rwf).toBe(0);
  });
});

describe("which stream a booking belongs to", () => {
  it("splits by the room's type", () => {
    expect(streamForBooking(booking({ roomType: "shared_space" }))).toBe(
      STREAMS.SHARED_SPACES,
    );
    expect(streamForBooking(booking({ roomType: "meeting_room" }))).toBe(
      STREAMS.MEETING_ROOMS,
    );
  });

  /* Every booking in the table was a meeting-room booking before shared
     spaces existed, so an untyped row is one of those. */
  it("treats an untyped room as a meeting room", () => {
    expect(streamForBooking({ roomId: 1 })).toBe(STREAMS.MEETING_ROOMS);
  });
});

describe("what a stock movement brought in", () => {
  it("counts a sale", () => {
    expect(movementRevenueRwf(movement({ delta: -3, unitPrice: 1000 }))).toBe(
      3000,
    );
  });

  /* The distinction the whole feature exists for. */
  it("counts nothing for stock that left without being sold", () => {
    expect(movementRevenueRwf(movement({ reason: "removal" }))).toBe(0);
    expect(movementRevenueRwf(movement({ reason: "waste" }))).toBe(0);
    expect(movementRevenueRwf(movement({ reason: "transfer_out" }))).toBe(0);
    expect(movementRevenueRwf(movement({ reason: "restock", delta: 24 }))).toBe(0);
    expect(movementRevenueRwf(movement({ reason: "correction", delta: -2 }))).toBe(
      0,
    );
  });

  /* The second lock: even if the generated column were replaced by one a
     caller could write, a write-off still must not count as income. */
  it("refuses a non-sale even when the row claims revenue", () => {
    expect(
      movementRevenueRwf(movement({ reason: "waste", revenue: 999999 })),
    ).toBe(0);
  });

  it("recomputes from units and price when the column is missing", () => {
    expect(
      movementRevenueRwf({
        reason: "sale",
        delta: -4,
        unit_price_rwf: 500,
        revenue_rwf: null,
      }),
    ).toBe(2000);
  });
});

describe("revenueByStream", () => {
  const bookings = [
    booking({ roomType: "meeting_room", amountRwf: 30000 }),
    booking({ roomType: "meeting_room", amountRwf: 20000 }),
    booking({ roomType: "shared_space", roomId: 3, amountRwf: 60000 }),
    booking({ status: "pending", amountRwf: 999999 }),
    booking({ status: "failed", amountRwf: 999999 }),
  ];

  const movements = [
    movement({ delta: -2, unitPrice: 1500 }), // 3,000
    movement({ reason: "waste", delta: -5 }), // nothing
    movement({ reason: "restock", delta: 24 }), // nothing
  ];

  it("keeps the three streams apart", () => {
    const totals = revenueByStream({ bookings, movements, rate: RATE });
    expect(totals[STREAMS.MEETING_ROOMS]).toBe(50000);
    expect(totals[STREAMS.SHARED_SPACES]).toBe(60000);
    expect(totals[STREAMS.SNACKS]).toBe(3000);
    expect(totals.total).toBe(113000);
  });

  it("reports rooms together as well, for the rooms-versus-fridge comparison", () => {
    const totals = revenueByStream({ bookings, movements, rate: RATE });
    expect(totals.rooms).toBe(110000);
  });

  /* A total that is part-estimate should be able to say so. */
  it("reports how much of the total was converted rather than charged", () => {
    const totals = revenueByStream({
      bookings: [booking({ amountRwf: null, totalPrice: 20 })],
      movements: [],
      rate: RATE,
    });
    expect(totals.estimatedRwf).toBe(30000);
    expect(totals.total).toBe(30000);
  });

  it("is all zeroes with nothing to report, rather than NaN", () => {
    const totals = revenueByStream({ rate: RATE });
    expect(totals.total).toBe(0);
    expect(totals[STREAMS.SNACKS]).toBe(0);
  });
});

describe("revenueByRoom", () => {
  it("separates each room's bookings from its snack sales", () => {
    const rows = revenueByRoom({
      bookings: [booking({ roomId: 1, amountRwf: 50000 })],
      movements: [movement({ roomId: 1, delta: -4, unitPrice: 1000 })],
      rooms: [{ id: 1, name: "Meeting Room 01", room_type: "meeting_room" }],
      rate: RATE,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].bookingsRwf).toBe(50000);
    expect(rows[0].snacksRwf).toBe(4000);
    expect(rows[0].totalRwf).toBe(54000);
    expect(rows[0].unitsSold).toBe(4);
  });

  /* A room that earned nothing is itself the finding, so it has to appear
     rather than being absent from the list. */
  it("includes a room that earned nothing", () => {
    const rows = revenueByRoom({
      bookings: [],
      movements: [],
      rooms: [{ id: 9, name: "Shared Space 02", room_type: "shared_space" }],
      rate: RATE,
    });
    expect(rows[0]).toMatchObject({ roomName: "Shared Space 02", totalRwf: 0 });
  });

  it("ranks by total", () => {
    const rows = revenueByRoom({
      bookings: [
        booking({ roomId: 1, roomName: "A", amountRwf: 10000 }),
        booking({ roomId: 2, roomName: "B", amountRwf: 90000 }),
      ],
      rooms: [],
      rate: RATE,
    });
    expect(rows.map((r) => r.roomName)).toEqual(["B", "A"]);
  });
});

describe("revenueSeries", () => {
  const from = "2026-09-20";
  const to = "2026-09-22";

  it("gives one row per day, including the quiet ones", () => {
    const series = revenueSeries({
      bookings: [booking({ createdAt: "2026-09-20T10:00:00Z", amountRwf: 30000 })],
      movements: [],
      from,
      to,
      granularity: "day",
      rate: RATE,
    });

    expect(series).toHaveLength(3);
    expect(series[0][STREAMS.MEETING_ROOMS]).toBe(30000);
    /* The empty day has to be present, or a chart draws a straight line
       over it and a dead Tuesday looks like a busy one. */
    expect(series[1].total).toBe(0);
    expect(series[2].total).toBe(0);
  });

  it("puts each stream on the same row", () => {
    const series = revenueSeries({
      bookings: [
        booking({ createdAt: "2026-09-20T10:00:00Z", amountRwf: 30000 }),
        booking({
          createdAt: "2026-09-20T11:00:00Z",
          roomType: "shared_space",
          amountRwf: 60000,
        }),
      ],
      movements: [movement({ createdAt: "2026-09-20T12:00:00Z", delta: -2, unitPrice: 1500 })],
      from,
      to,
      granularity: "day",
      rate: RATE,
    });

    expect(series[0]).toMatchObject({
      [STREAMS.MEETING_ROOMS]: 30000,
      [STREAMS.SHARED_SPACES]: 60000,
      [STREAMS.SNACKS]: 3000,
      total: 93000,
    });
  });

  it("rolls up by month", () => {
    const series = revenueSeries({
      bookings: [
        booking({ createdAt: "2026-08-03T10:00:00Z", amountRwf: 10000 }),
        booking({ createdAt: "2026-08-29T10:00:00Z", amountRwf: 20000 }),
        booking({ createdAt: "2026-09-02T10:00:00Z", amountRwf: 40000 }),
      ],
      from: "2026-08-01",
      to: "2026-09-30",
      granularity: "month",
      rate: RATE,
    });

    expect(series).toHaveLength(2);
    expect(series[0].total).toBe(30000);
    expect(series[1].total).toBe(40000);
  });

  it("rolls up by year", () => {
    const series = revenueSeries({
      bookings: [
        booking({ createdAt: "2025-03-03T10:00:00Z", amountRwf: 10000 }),
        booking({ createdAt: "2026-07-29T10:00:00Z", amountRwf: 20000 }),
      ],
      from: "2025-01-01",
      to: "2026-12-31",
      granularity: "year",
      rate: RATE,
    });

    expect(series).toHaveLength(2);
    expect(series[0].label).toBe("2025");
    expect(series[1].total).toBe(20000);
  });

  it("rolls up by week", () => {
    const series = revenueSeries({
      bookings: [booking({ createdAt: "2026-09-22T10:00:00Z", amountRwf: 15000 })],
      from: "2026-09-21",
      to: "2026-09-27",
      granularity: "week",
      rate: RATE,
    });
    expect(series).toHaveLength(1);
    expect(series[0].total).toBe(15000);
  });

  it("ignores anything outside the range", () => {
    const series = revenueSeries({
      bookings: [booking({ createdAt: "2026-01-01T10:00:00Z", amountRwf: 999999 })],
      from,
      to,
      granularity: "day",
      rate: RATE,
    });
    expect(series.every((bucket) => bucket.total === 0)).toBe(true);
  });

  it("returns nothing for a backwards range rather than throwing", () => {
    expect(
      revenueSeries({ from: "2026-09-22", to: "2026-09-20", rate: RATE }),
    ).toEqual([]);
  });
});

describe("what sold, and what merely went", () => {
  it("ranks best sellers by money", () => {
    const top = topSellingItems([
      movement({ menuItemId: 1, itemName: "Coke", delta: -10, unitPrice: 500 }),
      movement({ menuItemId: 2, itemName: "Water", delta: -20, unitPrice: 300 }),
      movement({ menuItemId: 1, itemName: "Coke", delta: -2, unitPrice: 500 }),
    ]);

    expect(top[0]).toMatchObject({ name: "Coke", units: 12, rwf: 6000 });
    expect(top[1]).toMatchObject({ name: "Water", units: 20, rwf: 6000 });
  });

  it("leaves non-sales out of the best sellers entirely", () => {
    expect(
      topSellingItems([movement({ reason: "waste", delta: -50 })]),
    ).toEqual([]);
  });

  /* The other half of the story, and the number nobody could see before:
     stock that left without earning anything. */
  it("reports shrinkage by reason", () => {
    const rows = shrinkageByReason([
      movement({ reason: "waste", delta: -5 }),
      movement({ reason: "waste", delta: -3 }),
      movement({ reason: "removal", delta: -2 }),
      movement({ reason: "sale", delta: -99 }),
      movement({ reason: "restock", delta: 48 }),
    ]);

    expect(rows).toEqual([
      { reason: "waste", units: 8 },
      { reason: "removal", units: 2 },
    ]);
  });
});

/* ------------------------------------------------------------------
   What the fridge MAKES, as opposed to what it takes.

   The fixture is the real one: David's purchase out of Meeting Room 02
   on Friday 25 September 2026, seeded by
   supabase/11-snack-seed-2026-09-25.sql. If these numbers ever stop
   agreeing with that file, one of the two is wrong.
   ------------------------------------------------------------------ */
describe("profit on snacks", () => {
  /* 1 Vitalo at 1,000 (cost 600), 1 Snickers at 5,000 (cost 3,000),
     2 Jifuchucui at 1,500 (cost 750). */
  const davidsSale = [
    movement({
      menuItemId: 1, itemName: "Vitalo Still Water 500ml",
      delta: -1, unitPrice: 1000, unitCost: 600,
      roomId: 2, roomName: "Meeting Room 02",
    }),
    movement({
      menuItemId: 2, itemName: "Snickers 2",
      delta: -1, unitPrice: 5000, unitCost: 3000,
      roomId: 2, roomName: "Meeting Room 02",
    }),
    movement({
      menuItemId: 3, itemName: "Jifuchucui",
      delta: -2, unitPrice: 1500, unitCost: 750,
      roomId: 2, roomName: "Meeting Room 02",
    }),
  ];

  it("took 9,000, cost 5,100 and made 3,900", () => {
    const totals = revenueByStream({ movements: davidsSale, rate: RATE });

    expect(totals[STREAMS.SNACKS]).toBe(9000);
    expect(totals.snacksCostRwf).toBe(5100);
    expect(totals.snacksProfitRwf).toBe(3900);
  });

  it("counts a restock as money out, not as a cost of sales", () => {
    const totals = revenueByStream({
      movements: [
        ...davidsSale,
        movement({ reason: "restock", delta: 6, unitCost: 2500 }),
      ],
      rate: RATE,
    });

    expect(totals.snacksSpendRwf).toBe(15000);
    // Buying six Power Malts does not change what David's sale made.
    expect(totals.snacksProfitRwf).toBe(3900);
    expect(totals[STREAMS.SNACKS]).toBe(9000);
  });

  /* The mistake this whole file exists to make impossible: a write-off
     is not a sale, so it cannot cost a sale anything either. */
  it("gives waste and removals no cost and no profit", () => {
    for (const reason of ["waste", "removal", "transfer_out"]) {
      const m = movement({ reason, delta: -5, unitCost: 3000 });
      expect(movementCostRwf(m)).toBe(0);
      expect(movementProfitRwf(m)).toBe(0);
      expect(movementSpendRwf(m)).toBe(0);
    }
  });

  it("does not count a transfer between rooms as buying the stock twice", () => {
    expect(movementSpendRwf(movement({ reason: "transfer_in", delta: 6, unitCost: 2500 }))).toBe(0);
    expect(movementSpendRwf(movement({ reason: "restock", delta: 6, unitCost: 2500 }))).toBe(15000);
  });

  /* An item with no buying price reports as all profit, because there is
     nothing else it could report. The point is that the total says how
     many units are in that state, so a screen can caveat itself. */
  it("flags units sold with no buying price on file", () => {
    const totals = revenueByStream({
      movements: [movement({ delta: -4, unitPrice: 1000, unitCost: null })],
      rate: RATE,
    });

    expect(totals.snacksProfitRwf).toBe(4000);
    expect(totals.unpricedUnits).toBe(4);
  });

  it("reports no unpriced units when every sale has a cost", () => {
    expect(revenueByStream({ movements: davidsSale, rate: RATE }).unpricedUnits).toBe(0);
    expect(unpricedSaleUnits(movement({ reason: "waste", delta: -9 }))).toBe(0);
  });

  it("attributes the profit to the room it was sold in", () => {
    const rows = revenueByRoom({ movements: davidsSale, rate: RATE });
    const mr02 = rows.find((r) => r.roomName === "Meeting Room 02");

    expect(mr02.snacksRwf).toBe(9000);
    expect(mr02.snacksProfitRwf).toBe(3900);
    expect(mr02.unitsSold).toBe(4);
  });

  /* Ranked by money taken, but each row carries what it made — and the
     two orders differ, which is the useful part: Snickers takes the most
     and makes the most here, but Jifuchucui outsells Vitalo 3:1 on
     margin off a lower price. */
  it("carries profit on each best seller", () => {
    const top = topSellingItems(davidsSale);

    expect(top.map((t) => [t.name, t.rwf, t.profitRwf])).toEqual([
      ["Snickers 2", 5000, 2000],
      ["Jifuchucui", 3000, 1500],
      ["Vitalo Still Water 500ml", 1000, 400],
    ]);
  });

  /* The one pricing mistake a takings figure actively hides: the more
     you sell, the better the revenue looks and the worse the month is. */
  it("reports a negative profit when something sells below cost", () => {
    const totals = revenueByStream({
      movements: [movement({ delta: -10, unitPrice: 800, unitCost: 1000 })],
      rate: RATE,
    });

    expect(totals[STREAMS.SNACKS]).toBe(8000);
    expect(totals.snacksProfitRwf).toBe(-2000);
  });
});
