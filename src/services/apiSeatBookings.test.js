/* What createSeatBookingApi actually writes, and what it refuses.

   The desk's seat sale is a money path, so the parts worth pinning down
   are the ones that would be expensive to get wrong: that it cannot
   oversell a space, that the RWF figure it stores is FROZEN rather than
   re-derivable, and that `seats` and `pass_type` land on the row (without
   them the booking reads as a one-seat hourly booking and the seat count
   silently drifts).

   supabase is mocked at the module boundary rather than a real client
   being pointed anywhere, so this runs offline and writes nothing.
*/

import { beforeEach, describe, expect, it, vi } from "vitest";

/* The rows getRoomSeatBookings will appear to return, swapped per test. */
let seatRows = [];
/* The payload the insert was called with, captured for inspection. */
let inserted = null;
/* What the insert will pretend the database said. */
let insertError = null;

vi.mock("./supabase", () => {
  const api = {
    from() {
      return this;
    },
    select() {
      return this;
    },
    eq() {
      return this;
    },
    not() {
      return this;
    },
    order() {
      // getRoomSeatBookings awaits the builder itself.
      return Promise.resolve({ data: seatRows, error: null });
    },
    insert(rows) {
      inserted = rows[0];
      return {
        select: () => ({
          single: async () =>
            insertError
              ? { data: null, error: insertError }
              : { data: { id: 1, ...inserted }, error: null },
        }),
      };
    },
  };
  return { default: api, supabaseUrl: "https://example.test" };
});

const { createSeatBookingApi } = await import("./apiBookings");

const room = {
  id: 320,
  name: "Shared Space 01",
  room_type: "shared_space",
  maxCapacity: 20,
  day_rate_rwf: 30000,
  month_rate_usd: 100,
};

/* A pass held over `days` days starting `offset` days from today. */
function heldPass(offset, days, seats, status = "booked") {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offset);
  const end = new Date(start);
  end.setDate(end.getDate() + days);

  return {
    id: `${offset}-${days}-${seats}`,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    seats,
    status,
  };
}

function today(offset = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function sell(overrides = {}) {
  return createSeatBookingApi({
    roomId: 320,
    guestId: 7,
    room,
    startDate: today(),
    passType: "day",
    units: 1,
    seats: 1,
    rwfPerUsd: 1500,
    isPaid: true,
    ...overrides,
  });
}

beforeEach(() => {
  seatRows = [];
  inserted = null;
  insertError = null;
});

describe("createSeatBookingApi", () => {
  it("writes the seat count and the pass type", async () => {
    await sell({ seats: 3 });

    expect(inserted.seats).toBe(3);
    expect(inserted.pass_type).toBe("day");
    expect(inserted.roomId).toBe(320);
    expect(inserted.guestId).toBe(7);
    expect(inserted.status).toBe("booked");
  });

  /* numGuests and seats mean different things (who is coming vs how much
     capacity was bought) but for a desk pass they are the same number, and
     leaving numGuests at its default 1 would understate a block booking
     everywhere numGuests is reported. */
  it("fills numGuests from the seat count", async () => {
    await sell({ seats: 4 });
    expect(inserted.numGuests).toBe(4);
  });

  it("prices a day pass per seat per day, in RWF", async () => {
    await sell({ seats: 2, units: 3 });
    expect(inserted.amount_rwf).toBe(180000); // 30,000 × 2 × 3
  });

  it("prices a monthly desk per seat per month, in USD", async () => {
    await sell({ passType: "month", seats: 2, units: 1 });
    expect(inserted.totalPrice).toBe(200);
    expect(inserted.amount_rwf).toBe(300000); // 200 × 1500
  });

  /* The rule that keeps a past sale from moving: the RWF figure is the one
     computed at the rate given NOW and stored, not something re-derived
     later. Two sales at two rates must store two different amounts. */
  it("freezes the RWF amount at the rate it was sold at", async () => {
    await sell({ passType: "month", rwfPerUsd: 1500 });
    const atFifteen = inserted.amount_rwf;

    await sell({ passType: "month", rwfPerUsd: 1600 });
    const atSixteen = inserted.amount_rwf;

    expect(atFifteen).toBe(150000);
    expect(atSixteen).toBe(160000);
    expect(atFifteen).not.toBe(atSixteen);
  });

  it("records the window as half-open, so consecutive passes do not collide", async () => {
    await sell({ units: 1 });
    const start = new Date(inserted.startTime);
    const end = new Date(inserted.endTime);

    expect(end - start).toBe(24 * 60 * 60 * 1000);
    expect(start.getHours()).toBe(0);
    expect(end.getHours()).toBe(0);
  });

  /* The whole point of the seat model. */
  it("refuses to oversell the space", async () => {
    seatRows = [heldPass(0, 1, 18)];
    await expect(sell({ seats: 4 })).rejects.toThrow(/only 2 of 20/i);
  });

  it("sells the very last desk", async () => {
    seatRows = [heldPass(0, 1, 19)];
    await sell({ seats: 1 });
    expect(inserted.seats).toBe(1);
  });

  it("ignores desks freed by a cancellation", async () => {
    seatRows = [heldPass(0, 1, 20, "cancelled")];
    await sell({ seats: 5 });
    expect(inserted.seats).toBe(5);
  });

  /* A multi-day pass is limited by its busiest day, not its first. */
  it("refuses a multi-day pass whose middle day is full", async () => {
    seatRows = [heldPass(1, 1, 19)];
    await expect(sell({ units: 3, seats: 2 })).rejects.toThrow(/only 1 of 20/i);
  });

  /* The desk's one liberty over the public site: a walk-in wants today. */
  it("sells a desk starting today, which the public site will not", async () => {
    await sell({ startDate: today(0) });
    expect(inserted.seats).toBe(1);
  });

  it("still refuses a start date that has gone", async () => {
    await expect(sell({ startDate: today(-3) })).rejects.toThrow(/has passed/i);
  });

  it("refuses a room that is not sold by the seat", async () => {
    await expect(
      sell({ room: { ...room, room_type: "meeting_room" } }),
    ).rejects.toThrow(/rented whole/i);
  });

  it("insists on a guest and a room", async () => {
    await expect(sell({ guestId: null })).rejects.toThrow(/guest/i);
    await expect(sell({ roomId: null })).rejects.toThrow(/space/i);
  });

  /* The seat trigger's own message names the room and both counts, which
     beats anything this layer could write, so it is passed through. */
  it("passes the database's own oversell message through", async () => {
    insertError = {
      code: "23514",
      message:
        "Only 1 of 20 seats are free in Shared Space 01 for that period — 2 requested",
    };
    await expect(sell()).rejects.toThrow(/Only 1 of 20 seats are free/);
  });

  it("explains a missing migration rather than reporting a raw error", async () => {
    insertError = { code: "42703", message: 'column "seats" does not exist' };
    await expect(sell()).rejects.toThrow(/shared-spaces migration/i);
  });

  /* The meeting rooms' one-let-at-a-time constraint has no business
     refusing a desk, and a seller who meets it has done nothing wrong —
     so it must not read as "those dates are taken", which would send
     them to pick hours that will fail in exactly the same way. */
  it("names the migration when the old overlap rule refuses a second desk", async () => {
    insertError = {
      code: "23P01",
      message:
        'conflicting key value violates exclusion constraint "no_overlapping_bookings"',
    };

    await expect(sell()).rejects.toThrow(/08-shared-space-overlap\.sql/);
    await expect(sell()).rejects.not.toThrow(/exclusion constraint/);
  });
});

describe("createSeatBookingApi — by the hour", () => {
  function at(hour, offsetDays = 0) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    date.setHours(hour, 0, 0, 0);
    return date;
  }

  function sellHours(overrides = {}) {
    return createSeatBookingApi({
      roomId: 320,
      guestId: 7,
      room: { ...room, hour_rate_rwf: 5000 },
      startDate: at(14, 1),
      passType: "hourly",
      minutes: 120,
      seats: 1,
      rwfPerUsd: 1500,
      isPaid: true,
      ...overrides,
    });
  }

  it("prices by the hour, per seat", async () => {
    await sellHours({ seats: 2, minutes: 180 });
    expect(inserted.amount_rwf).toBe(30000); // 5,000 × 2 × 3
    expect(inserted.pass_type).toBe("hourly");
    expect(inserted.seats).toBe(2);
  });

  it("keeps the time of day rather than snapping to midnight", async () => {
    await sellHours({ startDate: at(14, 1), minutes: 120 });
    const start = new Date(inserted.startTime);
    const end = new Date(inserted.endTime);
    expect(start.getHours()).toBe(14);
    expect(end.getHours()).toBe(16);
    expect(inserted.duration_minutes).toBe(120);
  });

  it("bills a part hour pro-rata", async () => {
    await sellHours({ minutes: 90 });
    expect(inserted.amount_rwf).toBe(7500);
  });

  it("lifts a too-short booking to the one-hour minimum", async () => {
    await sellHours({ minutes: 20 });
    expect(inserted.duration_minutes).toBe(60);
    expect(inserted.amount_rwf).toBe(5000);
  });

  /* The seats have to be free for THAT WINDOW, not for the whole day —
     which is the entire reason to sell a desk by the hour. */
  it("only competes with bookings that overlap the hours chosen", async () => {
    const morning = new Date(at(9, 1));
    const noon = new Date(at(12, 1));
    seatRows = [
      {
        id: "m",
        startTime: morning.toISOString(),
        endTime: noon.toISOString(),
        seats: 20,
        status: "booked",
      },
    ];

    // The afternoon is untouched by a morning that has ended.
    await sellHours({ startDate: at(14, 1), minutes: 120, seats: 5 });
    expect(inserted.seats).toBe(5);
  });

  it("refuses a booking that overlaps a full morning", async () => {
    const morning = new Date(at(9, 1));
    const noon = new Date(at(12, 1));
    seatRows = [
      {
        id: "m",
        startTime: morning.toISOString(),
        endTime: noon.toISOString(),
        seats: 20,
        status: "booked",
      },
    ];

    await expect(
      sellHours({ startDate: at(10, 1), minutes: 60 }),
    ).rejects.toThrow(/fully booked|only 0/i);
  });

  it("refuses a space with no hourly rate", async () => {
    await expect(
      sellHours({ room: { ...room, hour_rate_rwf: null } }),
    ).rejects.toThrow(/not sold by the hour/i);
  });
});
