import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BOOKING_STATUSES,
  bookingMinutes,
  FULL_DAY_MINUTES,
  NON_BLOCKING_STATUSES,
  conflictsWithBookings,
  derivedStatus,
  durationOptions,
  fitsBusinessHours,
  formatDuration,
  isBlockingBooking,
  isOpen24Hours,
  needsStatusAdvance,
  priceForMinutes,
  roundUpToStep,
  statusLabel,
  statusTag,
  usdPerMinuteFromRoom,
  validateAdminBooking,
} from "./booking";

const OPEN_24_7 = {
  business_hours_start: "00:00",
  business_hours_end: "23:59",
  min_booking_duration_minutes: 15,
  max_booking_duration_minutes: FULL_DAY_MINUTES,
  booking_buffer_minutes: 15,
};

const OFFICE_HOURS = {
  ...OPEN_24_7,
  business_hours_start: "08:00",
  business_hours_end: "20:00",
};

const ROOM = { id: 1, name: "001", regularPrice: 20, maxCapacity: 2 };

const NOW = new Date("2026-06-15T09:00:00");
const MINUTE = 60 * 1000;

function at(hhmm, dayOffset = 0) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(NOW);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d;
}

function existing(startHHMM, endHHMM, extra = {}) {
  return {
    id: extra.id ?? 99,
    startTime: at(startHHMM).toISOString(),
    endTime: at(endHHMM, extra.endDay ?? 0).toISOString(),
    status: extra.status ?? "booked",
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

/* ================================================================
   The status vocabulary: what is automatic, what is the desk's call
   ================================================================ */
describe("status model", () => {
  it("marks exactly cancelled and no-show as manual-only", () => {
    const manual = Object.entries(BOOKING_STATUSES)
      .filter(([, meta]) => meta.setBy === "manual")
      .map(([status]) => status)
      .sort();
    expect(manual).toEqual(["cancelled", "no-show"]);
  });

  it("agrees with the client on which statuses release the room", () => {
    expect([...NON_BLOCKING_STATUSES].sort()).toEqual([
      "cancelled",
      "failed",
      "no-show",
    ]);
  });

  it("treats a pending payment hold as still holding the room", () => {
    expect(isBlockingBooking({ status: "pending" })).toBe(true);
  });

  it("gives every known status a real tag colour", () => {
    for (const status of Object.keys(BOOKING_STATUSES))
      expect(statusTag(status)).toMatch(/^(yellow|coral|green|silver)$/);
  });

  it("falls back to a real colour and a readable label for an unknown status", () => {
    // The old inline map produced var(--color-undefined-700) here.
    expect(statusTag("something-new")).toBe("silver");
    expect(statusLabel(undefined)).toBe("unknown");
    expect(statusLabel("pending")).toBe("Pending payment");
  });
});

describe("derivedStatus — the automatic half of the lifecycle", () => {
  it("starts a booking at its start time", () => {
    const booking = { status: "booked", startTime: at("08:00"), endTime: at("10:00") };
    expect(derivedStatus(booking, NOW)).toBe("in-use");
    expect(needsStatusAdvance(booking, NOW)).toBe("in-use");
  });

  it("leaves a future booking alone", () => {
    const booking = { status: "booked", startTime: at("14:00"), endTime: at("15:00") };
    expect(needsStatusAdvance(booking, NOW)).toBe(null);
  });

  it("completes a running booking once its end time passes", () => {
    const booking = { status: "in-use", startTime: at("06:00"), endTime: at("08:00") };
    expect(derivedStatus(booking, NOW)).toBe("completed");
  });

  it("completes a booking that ran its whole course unattended", () => {
    // The desk never touched it. It is finished, not a no-show.
    const booking = { status: "booked", startTime: at("06:00"), endTime: at("08:00") };
    expect(derivedStatus(booking, NOW)).toBe("completed");
  });

  it("never invents a cancellation or a no-show", () => {
    const missed = { status: "booked", startTime: at("06:00"), endTime: at("08:00") };
    expect(derivedStatus(missed, NOW)).not.toBe("no-show");
    expect(derivedStatus(missed, NOW)).not.toBe("cancelled");
  });

  it("never reopens a booking the desk has closed", () => {
    for (const status of ["cancelled", "no-show", "failed", "completed"]) {
      const booking = { status, startTime: at("14:00"), endTime: at("15:00") };
      expect(needsStatusAdvance(booking, NOW)).toBe(null);
    }
  });

  it("leaves a pending payment hold to the payment flow", () => {
    const booking = { status: "pending", startTime: at("08:00"), endTime: at("10:00") };
    expect(needsStatusAdvance(booking, NOW)).toBe(null);
  });

  it("is idempotent — running it twice changes nothing the second time", () => {
    const booking = { status: "booked", startTime: at("08:00"), endTime: at("10:00") };
    const once = derivedStatus(booking, NOW);
    expect(derivedStatus({ ...booking, status: once }, NOW)).toBe(once);
  });
});

/* ================================================================
   The 24-hour rule
   ================================================================ */
describe("24-hour bookings", () => {
  it("recognises a venue that never closes", () => {
    expect(isOpen24Hours(OPEN_24_7)).toBe(true);
    expect(isOpen24Hours(OFFICE_HOURS)).toBe(false);
  });

  it("accepts a full 24 hours starting at any 15-minute step of the day", () => {
    for (let minutes = 0; minutes < FULL_DAY_MINUTES; minutes += 15) {
      const start = new Date(at("00:00").getTime() + minutes * MINUTE);
      const { error } = validateAdminBooking({
        start,
        durationMinutes: FULL_DAY_MINUTES,
        room: ROOM,
        settings: OPEN_24_7,
        existingBookings: [],
        now: at("00:00"),
      });
      expect(
        error,
        `24h from ${start.toTimeString().slice(0, 5)} should be accepted`,
      ).toBeUndefined();
    }
  });

  it("prices a full day as 24 hours of the room's hourly rate", () => {
    const { value } = validateAdminBooking({
      start: at("14:30"),
      durationMinutes: FULL_DAY_MINUTES,
      room: ROOM,
      settings: OPEN_24_7,
      existingBookings: [],
    });
    expect(value.usd).toBe(480); // $20/hr × 24
    expect(value.end.getTime() - value.start.getTime()).toBe(24 * 60 * MINUTE);
  });

  it("lets a booking simply run past midnight", () => {
    expect(fitsBusinessHours(at("23:30"), at("00:30", 1), OPEN_24_7)).toBe(true);
  });

  it("still refuses to overrun a venue that does close", () => {
    const { error } = validateAdminBooking({
      start: at("19:00"),
      durationMinutes: 180,
      room: ROOM,
      settings: OFFICE_HOURS,
      existingBookings: [],
    });
    expect(error).toMatch(/opening hours/i);
  });
});

/* ================================================================
   Desk bookings: what is allowed that the public site forbids
   ================================================================ */
describe("validateAdminBooking", () => {
  it("accepts a booking starting this very minute — a walk-in", () => {
    const { error, value } = validateAdminBooking({
      start: NOW,
      durationMinutes: 60,
      room: ROOM,
      settings: OPEN_24_7,
      existingBookings: [],
      now: NOW,
    });
    expect(error).toBeUndefined();
    expect(value.startsInPast).toBe(false);
  });

  it("accepts a booking starting in ten minutes, which the public site rejects", () => {
    const { error } = validateAdminBooking({
      start: at("09:10"),
      durationMinutes: 60,
      room: ROOM,
      settings: OPEN_24_7,
      existingBookings: [],
      now: NOW,
    });
    expect(error).toBeUndefined();
  });

  it("flags a backdated start without refusing it", () => {
    // Recording a session that already began is a legitimate desk fix.
    const { error, value } = validateAdminBooking({
      start: at("08:30"),
      durationMinutes: 60,
      room: ROOM,
      settings: OPEN_24_7,
      existingBookings: [],
      now: NOW,
    });
    expect(error).toBeUndefined();
    expect(value.startsInPast).toBe(true);
  });

  it("refuses a booking with no room or no guest-usable length", () => {
    expect(validateAdminBooking({ start: NOW, durationMinutes: 60 }).error).toMatch(
      /room/i,
    );
    expect(
      validateAdminBooking({
        start: NOW,
        durationMinutes: 0,
        room: ROOM,
        settings: OPEN_24_7,
      }).error,
    ).toMatch(/how long/i);
  });

  it("refuses an invalid date", () => {
    expect(
      validateAdminBooking({
        start: new Date("nonsense"),
        durationMinutes: 60,
        room: ROOM,
        settings: OPEN_24_7,
      }).error,
    ).toMatch(/valid start/i);
  });

  it("honours the configured minimum and maximum, in words a person reads", () => {
    const settings = {
      ...OPEN_24_7,
      min_booking_duration_minutes: 60,
      max_booking_duration_minutes: 240,
    };
    expect(
      validateAdminBooking({ start: NOW, durationMinutes: 30, room: ROOM, settings })
        .error,
    ).toMatch(/at least 1 hr/);
    expect(
      validateAdminBooking({ start: NOW, durationMinutes: 300, room: ROOM, settings })
        .error,
    ).toMatch(/longer than 4 hrs/);
  });

  it("names the field each rejection belongs to, so the form can point at it", () => {
    const base = { durationMinutes: 60, room: ROOM, settings: OPEN_24_7, now: NOW };

    expect(validateAdminBooking({ ...base, room: null, start: NOW }).field).toBe(
      "room",
    );
    expect(
      validateAdminBooking({ ...base, start: new Date("nonsense") }).field,
    ).toBe("start");
    expect(
      validateAdminBooking({ ...base, start: NOW, durationMinutes: 0 }).field,
    ).toBe("duration");
    expect(
      validateAdminBooking({
        ...base,
        start: NOW,
        durationMinutes: 5000,
      }).field,
    ).toBe("duration");
    expect(
      validateAdminBooking({
        ...base,
        start: at("13:00"),
        existingBookings: [existing("13:00", "14:00")],
      }).field,
    ).toBe("start");
    expect(
      validateAdminBooking({
        ...base,
        start: at("19:00"),
        durationMinutes: 180,
        settings: OFFICE_HOURS,
      }).field,
    ).toBe("start");
  });

  it("leaves `field` unset when the booking is fine", () => {
    const ok = validateAdminBooking({
      start: at("13:00"),
      durationMinutes: 60,
      room: ROOM,
      settings: OPEN_24_7,
      existingBookings: [],
      now: NOW,
    });
    expect(ok.error).toBeUndefined();
    expect(ok.field).toBeUndefined();
  });
});

/* ================================================================
   Double-booking, from every direction
   ================================================================ */
describe("clash detection", () => {
  const base = {
    room: ROOM,
    settings: OPEN_24_7,
    durationMinutes: 60,
    now: NOW,
  };

  function verdict(startHHMM, bookings, overrides = {}) {
    return validateAdminBooking({
      ...base,
      ...overrides,
      start: at(startHHMM),
      existingBookings: bookings,
    });
  }

  it("refuses an identical slot", () => {
    expect(verdict("13:00", [existing("13:00", "14:00")]).error).toMatch(/clashes with another booking/i);
  });

  it("refuses a slot that starts inside another", () => {
    expect(verdict("13:30", [existing("13:00", "14:00")]).error).toMatch(/clashes with another booking/i);
  });

  it("refuses a slot that ends inside another", () => {
    expect(verdict("12:30", [existing("13:00", "14:00")]).error).toMatch(/clashes with another booking/i);
  });

  it("refuses a slot that swallows another whole", () => {
    expect(
      verdict("12:00", [existing("13:00", "14:00")], { durationMinutes: 180 }).error,
    ).toMatch(/clashes with another booking/i);
  });

  it("refuses a slot inside the turnaround window", () => {
    expect(verdict("14:10", [existing("13:00", "14:00")]).error).toMatch(/clashes with another booking/i);
  });

  it("accepts a slot starting exactly when the turnaround ends", () => {
    expect(verdict("14:15", [existing("13:00", "14:00")]).error).toBeUndefined();
  });

  it("accepts a slot ending exactly when the next one starts", () => {
    expect(verdict("12:00", [existing("13:00", "14:00")]).error).toBeUndefined();
  });

  it("ignores cancelled, no-show and failed bookings", () => {
    for (const status of ["cancelled", "no-show", "failed"]) {
      expect(
        verdict("13:00", [existing("13:00", "14:00", { status })]).error,
        `${status} should not block`,
      ).toBeUndefined();
    }
  });

  it("is blocked by someone else's pending payment hold", () => {
    expect(
      verdict("13:00", [existing("13:00", "14:00", { status: "pending" })]).error,
    ).toMatch(/clashes with another booking/i);
  });

  it("catches a clash a 24-hour booking makes on the FOLLOWING day", () => {
    // The clash is 20 hours after the start, which anything that only
    // looked at "the booking's own day" would miss entirely.
    const tomorrowMorning = {
      id: 7,
      startTime: at("06:00", 1).toISOString(),
      endTime: at("07:00", 1).toISOString(),
      status: "booked",
    };
    expect(
      verdict("10:00", [tomorrowMorning], { durationMinutes: FULL_DAY_MINUTES })
        .error,
    ).toMatch(/clashes with another booking/i);
  });

  it("catches a clash against a 24-hour booking already in place", () => {
    const allDay = {
      id: 8,
      startTime: at("10:00").toISOString(),
      endTime: at("10:00", 1).toISOString(),
      status: "booked",
    };
    expect(verdict("23:00", [allDay]).error).toMatch(/clashes with another booking/i);
    expect(verdict("09:00", [allDay]).error).toBeUndefined();
  });

  it("lets a booking be edited without clashing with itself", () => {
    const self = existing("13:00", "14:00", { id: 42 });
    expect(
      conflictsWithBookings(at("13:00"), at("14:00"), [self], 15, 42),
    ).toBe(false);
    expect(conflictsWithBookings(at("13:00"), at("14:00"), [self], 15)).toBe(true);
  });

  it("respects a turnaround window the admin has changed", () => {
    const wide = { ...OPEN_24_7, booking_buffer_minutes: 60 };
    expect(verdict("14:30", [existing("13:00", "14:00")], { settings: wide }).error)
      .toMatch(/clashes with another booking/i);
    expect(verdict("15:00", [existing("13:00", "14:00")], { settings: wide }).error)
      .toBeUndefined();
  });
});

/* ================================================================
   Money and presentation
   ================================================================ */
describe("pricing", () => {
  it("reads regularPrice as an hourly rate", () => {
    expect(usdPerMinuteFromRoom({ regularPrice: 60 })).toBe(1);
    expect(usdPerMinuteFromRoom({ regularPrice: 0 })).toBe(0);
    expect(usdPerMinuteFromRoom(null)).toBe(0);
  });

  it("charges a 15-minute booking a quarter of the hourly rate", () => {
    expect(priceForMinutes(15, usdPerMinuteFromRoom(ROOM)).usd).toBe(5);
  });

  it("converts to RWF from the USD total", () => {
    expect(priceForMinutes(60, usdPerMinuteFromRoom(ROOM)).rwf).toBe(29412);
  });
});

describe("durationOptions", () => {
  it("runs from 15 minutes to a full day in 15-minute steps", () => {
    const options = durationOptions(OPEN_24_7);
    expect(options[0]).toBe(15);
    expect(options[options.length - 1]).toBe(FULL_DAY_MINUTES);
    expect(options).toContain(FULL_DAY_MINUTES);
  });

  it("starts at the admin's own minimum", () => {
    expect(
      durationOptions({ ...OPEN_24_7, min_booking_duration_minutes: 60 })[0],
    ).toBe(60);
  });
});

describe("formatDuration", () => {
  it("names the common lengths the way the desk says them", () => {
    expect(formatDuration(15)).toBe("15 min");
    expect(formatDuration(60)).toBe("1 hr");
    expect(formatDuration(90)).toBe("1 hr 30 min");
    expect(formatDuration(FULL_DAY_MINUTES)).toBe("Full day, 24 hrs");
  });
});

describe("roundUpToStep", () => {
  it("snaps a start time up onto the same 15-minute grid the site uses", () => {
    expect(roundUpToStep(new Date("2026-06-15T09:01:00")).getMinutes()).toBe(15);
    expect(roundUpToStep(new Date("2026-06-15T09:15:00")).getMinutes()).toBe(15);
    expect(roundUpToStep(new Date("2026-06-15T09:46:00")).getHours()).toBe(10);
  });
});

describe("bookingMinutes", () => {
  it("prefers duration_minutes over the rounded legacy numHours", () => {
    // numHours stores 1 for BOTH a 30-minute and a 90-minute booking, so
    // every screen that printed it was wrong about half our bookings.
    expect(bookingMinutes({ duration_minutes: 30, numHours: 1 })).toBe(30);
    expect(bookingMinutes({ duration_minutes: 90, numHours: 1 })).toBe(90);
  });

  it("falls back to the timestamps when duration_minutes is absent", () => {
    expect(
      bookingMinutes({
        startTime: at("10:00").toISOString(),
        endTime: at("10:45").toISOString(),
        numHours: 1,
      }),
    ).toBe(45);
  });

  it("falls back to numHours only when there is nothing else", () => {
    expect(bookingMinutes({ numHours: 2 })).toBe(120);
    expect(bookingMinutes({})).toBe(0);
  });

  it("reads a 24-hour booking as a full day", () => {
    expect(
      formatDuration(
        bookingMinutes({
          startTime: at("14:00").toISOString(),
          endTime: at("14:00", 1).toISOString(),
        }),
      ),
    ).toBe("Full day, 24 hrs");
  });
});
