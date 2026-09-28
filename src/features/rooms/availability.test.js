import { describe, expect, it } from "vitest";

import {
  KINDS,
  availabilityBoard,
  boardSummary,
  clashesFor,
  mergeHeatRuns,
  nextFreeStart,
  occupancyBlocks,
  roomAvailability,
  seatHeatCells,
  timelineRange,
  timelineTicks,
  windowMarker,
} from "./availability";

/* Availability is the one thing on this screen that cannot be checked by
   looking at it: a verdict is right or wrong by the same rules the
   booking form enforces, and the cases that go wrong are the ones nobody
   sets up by hand — a booking over midnight, a monthly desk bought weeks
   ago, the turnaround gap that makes a visibly empty hour unbookable.

   The contract these pin down is "this file agrees with the form". Every
   expectation below is a sentence a desk would say. */

const room = (over = {}) => ({
  id: 1,
  name: "Room 001",
  room_type: "meeting_room",
  maxCapacity: 8,
  regularPrice: 20,
  ...over,
});

const space = (over = {}) => ({
  id: 2,
  name: "Shared Space 01",
  room_type: "shared_space",
  maxCapacity: 20,
  day_rate_rwf: 30000,
  hour_rate_rwf: 5000,
  month_rate_usd: 100,
  ...over,
});

const at = (iso) => new Date(iso);

const booking = (start, end, over = {}) => ({
  id: `${start}-${end}`,
  roomId: 1,
  startTime: at(start).toISOString(),
  endTime: at(end).toISOString(),
  status: "booked",
  seats: 1,
  ...over,
});

const settings = { booking_buffer_minutes: 15 };

describe("roomAvailability, meeting rooms", () => {
  it("calls an empty room free", () => {
    const result = roomAvailability({
      room: room(),
      bookings: [],
      start: at("2026-09-27T14:00"),
      end: at("2026-09-27T15:00"),
      settings,
    });

    expect(result.verdict).toBe("free");
    expect(result.isSellable).toBe(true);
    // Nothing to suggest: it is free now.
    expect(result.freeFrom).toBeNull();
  });

  it("calls a clashing room busy and says when it frees up", () => {
    const result = roomAvailability({
      room: room(),
      bookings: [booking("2026-09-27T13:30", "2026-09-27T14:30")],
      start: at("2026-09-27T14:00"),
      end: at("2026-09-27T15:00"),
      settings,
    });

    expect(result.verdict).toBe("busy");
    expect(result.isSellable).toBe(false);
    // 14:30 plus the 15-minute turnaround.
    expect(result.freeFrom).toEqual(at("2026-09-27T14:45"));
  });

  it("refuses the turnaround window, not just the booking", () => {
    // The room is empty from 14:00 on paper, and unavailable until 14:15.
    const clashes = clashesFor(
      [booking("2026-09-27T13:00", "2026-09-27T14:00")],
      at("2026-09-27T14:00"),
      at("2026-09-27T15:00"),
      15,
    );
    expect(clashes).toHaveLength(1);
  });

  it("does not let a booking block the slot it has just vacated", () => {
    const clashes = clashesFor(
      [booking("2026-09-27T13:00", "2026-09-27T14:00")],
      at("2026-09-27T14:15"),
      at("2026-09-27T15:00"),
      15,
    );
    expect(clashes).toHaveLength(0);
  });

  it("sees a booking that started the day before", () => {
    const result = roomAvailability({
      room: room(),
      // A 24-hour booking, which the rules allow.
      bookings: [booking("2026-09-26T20:00", "2026-09-27T20:00")],
      start: at("2026-09-27T14:00"),
      end: at("2026-09-27T15:00"),
      settings,
    });

    expect(result.verdict).toBe("busy");
  });

  it("ignores cancelled, no-show and failed bookings", () => {
    for (const status of ["cancelled", "no-show", "failed", "completed"]) {
      const result = roomAvailability({
        room: room(),
        bookings: [booking("2026-09-27T14:00", "2026-09-27T15:00", { status })],
        start: at("2026-09-27T14:00"),
        end: at("2026-09-27T15:00"),
        settings,
      });
      expect(result.verdict, status).toBe("free");
    }
  });

  it("refuses a room that cannot seat the party, whatever the clock says", () => {
    const result = roomAvailability({
      room: room({ maxCapacity: 4 }),
      bookings: [],
      start: at("2026-09-27T14:00"),
      end: at("2026-09-27T15:00"),
      people: 6,
      settings,
    });

    expect(result.verdict).toBe("too-small");
    // No point suggesting a later time for a room that is the wrong size.
    expect(result.freeFrom).toBeNull();
  });

  it("reports a window outside opening hours as closed", () => {
    const result = roomAvailability({
      room: room(),
      bookings: [],
      start: at("2026-09-27T22:00"),
      end: at("2026-09-27T23:00"),
      settings: {
        ...settings,
        business_hours_start: "08:00",
        business_hours_end: "18:00",
      },
    });

    expect(result.verdict).toBe("closed");
  });

  it("says nothing about a half-typed window", () => {
    const result = roomAvailability({
      room: room(),
      bookings: [],
      start: at("2026-09-27T14:00"),
      end: null,
      settings,
    });

    expect(result.verdict).toBe("unknown");
    expect(result.isSellable).toBe(false);
  });
});

describe("roomAvailability, shared spaces", () => {
  const deskBookings = (count, over = {}) =>
    Array.from({ length: count }, (_, index) =>
      booking("2026-09-27T09:00", "2026-09-27T17:00", {
        id: `desk-${index}`,
        roomId: 2,
        seats: 1,
        ...over,
      }),
    );

  it("counts seats rather than blocking the room", () => {
    const result = roomAvailability({
      room: space(),
      bookings: deskBookings(6),
      start: at("2026-09-27T14:00"),
      end: at("2026-09-27T15:00"),
      settings,
    });

    expect(result.verdict).toBe("free");
    expect(result.isSellable).toBe(true);
    expect(result.seats).toEqual({ capacity: 20, taken: 6, left: 14 });
  });

  it("warns once the room is filling up", () => {
    const result = roomAvailability({
      room: space(),
      bookings: deskBookings(17),
      start: at("2026-09-27T14:00"),
      end: at("2026-09-27T15:00"),
      settings,
    });

    // Three of twenty left is inside the quarter-room threshold.
    expect(result.verdict).toBe("tight");
    expect(result.isSellable).toBe(true);
  });

  it("separates 'not enough for this party' from 'nothing at all'", () => {
    const short = roomAvailability({
      room: space(),
      bookings: deskBookings(18),
      start: at("2026-09-27T14:00"),
      end: at("2026-09-27T15:00"),
      people: 4,
      settings,
    });
    expect(short.verdict).toBe("short");
    expect(short.seats.left).toBe(2);

    const full = roomAvailability({
      room: space(),
      bookings: deskBookings(20),
      start: at("2026-09-27T14:00"),
      end: at("2026-09-27T15:00"),
      settings,
    });
    expect(full.verdict).toBe("full");
  });

  it("frees a desk the moment the booking holding it ends", () => {
    const result = roomAvailability({
      room: space({ maxCapacity: 1 }),
      bookings: [
        booking("2026-09-27T09:00", "2026-09-27T14:00", { roomId: 2, seats: 1 }),
      ],
      // Starting exactly where the other one ends: half-open, so no clash.
      start: at("2026-09-27T14:00"),
      end: at("2026-09-27T15:00"),
      settings,
    });

    /* "tight" rather than "free" only because a one-desk room is always
       down to its last desk — what matters here is that the desk is
       sellable at all, where a meeting room would have been blocked. */
    expect(result.isSellable).toBe(true);
    expect(result.seats.left).toBe(1);
  });

  it("does not apply the meeting rooms' turnaround gap to a desk", () => {
    const result = roomAvailability({
      room: space({ maxCapacity: 1 }),
      bookings: [
        booking("2026-09-27T09:00", "2026-09-27T14:00", { roomId: 2, seats: 1 }),
      ],
      start: at("2026-09-27T14:00"),
      end: at("2026-09-27T15:00"),
      settings: { ...settings, booking_buffer_minutes: 60 },
    });

    expect(result.isSellable).toBe(true);
    expect(result.seats.left).toBe(1);
  });

  it("sells a desk in the afternoon of a room that was full all morning", () => {
    const result = roomAvailability({
      room: space({ maxCapacity: 2 }),
      bookings: [
        booking("2026-09-27T08:00", "2026-09-27T12:00", { roomId: 2, seats: 2 }),
      ],
      start: at("2026-09-27T14:00"),
      end: at("2026-09-27T16:00"),
      settings,
    });

    expect(result.verdict).toBe("free");
    expect(result.seats.taken).toBe(0);
  });

  it("sees a monthly desk bought weeks ago", () => {
    const result = roomAvailability({
      room: space({ maxCapacity: 1 }),
      bookings: [
        booking("2026-08-20T00:00", "2026-09-30T00:00", { roomId: 2, seats: 1 }),
      ],
      start: at("2026-09-27T14:00"),
      end: at("2026-09-27T15:00"),
      settings,
    });

    expect(result.verdict).toBe("full");
  });

  it("suggests the moment a desk frees up", () => {
    const result = roomAvailability({
      room: space({ maxCapacity: 1 }),
      bookings: [
        booking("2026-09-27T09:00", "2026-09-27T16:00", { roomId: 2, seats: 1 }),
      ],
      start: at("2026-09-27T14:00"),
      end: at("2026-09-27T15:00"),
      settings,
    });

    expect(result.verdict).toBe("full");
    expect(result.freeFrom).toEqual(at("2026-09-27T16:00"));
  });
});

describe("nextFreeStart", () => {
  it("keeps the length that was asked for", () => {
    const free = nextFreeStart({
      room: room(),
      bookings: [
        booking("2026-09-27T14:00", "2026-09-27T15:00"),
        // A 15-minute hole at 15:15 is not enough for an hour.
        booking("2026-09-27T15:30", "2026-09-27T17:00"),
      ],
      start: at("2026-09-27T14:00"),
      end: at("2026-09-27T15:00"),
      settings,
    });

    expect(free).toEqual(at("2026-09-27T17:15"));
  });

  it("steps over a whole booked day without crawling", () => {
    // Back to back from 08:00, hour after hour, well past midnight.
    const hour = (offset) =>
      new Date(at("2026-09-27T08:00").getTime() + offset * 60 * 60 * 1000);
    const bookings = Array.from({ length: 20 }, (_, index) => ({
      ...booking("2026-09-27T08:00", "2026-09-27T09:00", { id: `b-${index}` }),
      startTime: hour(index).toISOString(),
      endTime: hour(index + 1).toISOString(),
    }));

    const free = nextFreeStart({
      room: room(),
      bookings,
      start: at("2026-09-27T09:00"),
      end: at("2026-09-27T10:00"),
      settings,
    });

    // The last booking ends at 04:00 the next morning; plus turnaround.
    expect(free).toEqual(at("2026-09-28T04:15"));
  });

  it("gives up honestly past the horizon", () => {
    const free = nextFreeStart({
      room: space({ maxCapacity: 1 }),
      bookings: [
        booking("2026-09-01T00:00", "2026-12-01T00:00", { roomId: 2, seats: 1 }),
      ],
      start: at("2026-09-27T14:00"),
      end: at("2026-09-27T15:00"),
      settings,
    });

    expect(free).toBeNull();
  });

  it("stays inside opening hours", () => {
    const free = nextFreeStart({
      room: room(),
      bookings: [booking("2026-09-27T16:00", "2026-09-27T18:00")],
      start: at("2026-09-27T16:00"),
      end: at("2026-09-27T17:00"),
      settings: {
        ...settings,
        business_hours_start: "08:00",
        business_hours_end: "18:00",
      },
    });

    // 18:15 would run past closing, so the answer is the next morning.
    expect(free).toEqual(at("2026-09-28T08:00"));
  });
});

describe("availabilityBoard", () => {
  const rooms = [
    room({ id: 1, name: "Room 010" }),
    room({ id: 2, name: "Room 002" }),
    space({ id: 3, name: "Shared Space 01", maxCapacity: 4 }),
    room({ id: 4, name: "Room 001", is_archived: true }),
  ];

  const bookings = [
    booking("2026-09-27T14:00", "2026-09-27T15:00", { id: "x", roomId: 2 }),
  ];

  const board = (over = {}) =>
    availabilityBoard({
      rooms,
      bookings,
      start: at("2026-09-27T14:00"),
      end: at("2026-09-27T15:00"),
      settings,
      ...over,
    });

  it("puts what can be sold first, then sorts by name numerically", () => {
    const results = board();
    expect(results.map((r) => r.room.name)).toEqual([
      "Room 010",
      "Shared Space 01",
      "Room 002",
    ]);
  });

  it("leaves archived rooms out entirely", () => {
    expect(board().some((r) => r.room.is_archived)).toBe(false);
  });

  it("filters by kind", () => {
    expect(board({ kind: KINDS.SHARED }).map((r) => r.room.id)).toEqual([3]);
    expect(board({ kind: KINDS.MEETING }).map((r) => r.room.id)).toEqual([1, 2]);
  });

  it("hides the unsellable when asked", () => {
    const results = board({ onlyFree: true });
    expect(results.every((r) => r.isSellable)).toBe(true);
    expect(results).toHaveLength(2);
  });

  it("only offers a soonest time when nothing at all is free", () => {
    expect(boardSummary(board()).soonest).toBeNull();

    const nothing = board({ people: 99 });
    expect(nothing.every((r) => !r.isSellable)).toBe(true);
    // Every room is too small, and no later time fixes that.
    expect(boardSummary(nothing).soonest).toBeNull();
  });

  it("counts desks only where they could be sold", () => {
    const summary = boardSummary(board());
    expect(summary.sellable).toBe(2);
    expect(summary.desksFree).toBe(4);
  });
});

describe("the timeline", () => {
  it("shows a window inside one day against that whole day", () => {
    const range = timelineRange(at("2026-09-27T14:00"), at("2026-09-27T15:00"));
    expect(range.days).toBe(1);
    expect(range.from).toEqual(at("2026-09-27T00:00"));
    expect(range.to).toEqual(at("2026-09-28T00:00"));
  });

  it("stretches to cover a window that crosses midnight", () => {
    const range = timelineRange(at("2026-09-27T20:00"), at("2026-09-28T20:00"));
    expect(range.days).toBe(2);
    expect(range.to).toEqual(at("2026-09-29T00:00"));
  });

  it("does not add a day for a window ending exactly at midnight", () => {
    const range = timelineRange(at("2026-09-27T20:00"), at("2026-09-28T00:00"));
    expect(range.days).toBe(1);
  });

  it("places the window marker where the window is", () => {
    const range = timelineRange(at("2026-09-27T06:00"), at("2026-09-27T12:00"));
    const marker = windowMarker(
      at("2026-09-27T06:00"),
      at("2026-09-27T12:00"),
      range.from,
      range.to,
    );
    expect(marker.leftPct).toBeCloseTo(25);
    expect(marker.widthPct).toBeCloseTo(25);
  });

  it("draws a booking and its turnaround as separate widths", () => {
    const range = timelineRange(at("2026-09-27T14:00"), at("2026-09-27T15:00"));
    const [block] = occupancyBlocks(
      [booking("2026-09-27T06:00", "2026-09-27T12:00")],
      range.from,
      range.to,
      15,
    );

    expect(block.leftPct).toBeCloseTo(25);
    expect(block.widthPct).toBeCloseTo(25);
    // 15 minutes of a 24-hour day.
    expect(block.gapPct).toBeCloseTo((15 / 1440) * 100);
  });

  it("clips a booking that started the previous day", () => {
    const range = timelineRange(at("2026-09-27T14:00"), at("2026-09-27T15:00"));
    const [block] = occupancyBlocks(
      [booking("2026-09-26T20:00", "2026-09-27T06:00")],
      range.from,
      range.to,
      15,
    );

    expect(block.leftPct).toBe(0);
    expect(block.widthPct).toBeCloseTo(25);
  });

  it("shades a shared space by how full each cell is", () => {
    const range = timelineRange(at("2026-09-27T14:00"), at("2026-09-27T15:00"));
    const cells = seatHeatCells(
      space({ maxCapacity: 4 }),
      [
        booking("2026-09-27T00:00", "2026-09-27T12:00", {
          roomId: 2,
          seats: 2,
        }),
      ],
      range.from,
      range.to,
      48,
    );

    expect(cells).toHaveLength(48);
    expect(cells[0].ratio).toBeCloseTo(0.5);
    expect(cells[0].left).toBe(2);
    expect(cells.at(-1).ratio).toBe(0);
  });

  it("labels a single day three-hourly and a longer span daily", () => {
    const day = timelineRange(at("2026-09-27T14:00"), at("2026-09-27T15:00"));
    expect(timelineTicks(day.from, day.to).map((t) => t.label)).toEqual([
      "00:00",
      "03:00",
      "06:00",
      "09:00",
      "12:00",
      "15:00",
      "18:00",
      "21:00",
      "00:00",
    ]);

    const week = timelineRange(at("2026-09-27T09:00"), at("2026-09-30T09:00"));
    expect(timelineTicks(week.from, week.to)).toHaveLength(5);
  });
});

describe("mergeHeatRuns", () => {
  it("joins neighbouring cells that are equally full", () => {
    const range = timelineRange(at("2026-09-27T14:00"), at("2026-09-27T15:00"));
    const cells = seatHeatCells(
      space({ maxCapacity: 4 }),
      [
        booking("2026-09-27T00:00", "2026-09-27T12:00", { roomId: 2, seats: 2 }),
      ],
      range.from,
      range.to,
      48,
    );

    const runs = mergeHeatRuns(cells);

    // Half full until noon, empty after it: two bands, not forty-eight.
    expect(runs).toHaveLength(2);
    expect(runs[0].taken).toBe(2);
    expect(runs[0].widthPct).toBeCloseTo(50);
    expect(runs[0].end).toEqual(at("2026-09-27T12:00"));
    expect(runs[1].taken).toBe(0);
  });

  it("covers the whole strip, however many changes there are", () => {
    const range = timelineRange(at("2026-09-27T14:00"), at("2026-09-27T15:00"));
    const runs = mergeHeatRuns(
      seatHeatCells(
        space({ maxCapacity: 4 }),
        [
          booking("2026-09-27T08:00", "2026-09-27T17:00", { roomId: 2, seats: 1 }),
          booking("2026-09-27T13:00", "2026-09-27T20:00", { roomId: 2, seats: 2 }),
        ],
        range.from,
        range.to,
        48,
      ),
    );

    const total = runs.reduce((sum, run) => sum + run.widthPct, 0);
    expect(total).toBeCloseTo(100);
    expect(runs.map((run) => run.taken)).toEqual([0, 1, 3, 2, 0]);
  });
});
