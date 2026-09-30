import { describe, expect, it } from "vitest";

import {
  MIN_DESK_MINUTES,
  PASS_TYPES,
  crossoverMinutes,
  dayPassBeatsHourly,
  daysInWindow,
  fromPriceForSharedSpace,
  isMeetingRoom,
  offersHourly,
  passesFor,
  roundDeskMinutes,
  isSharedSpace,
  monthlySavingVsDaily,
  passWindow,
  priceForPass,
  seatCapacity,
  seatPressure,
  seatsLeft,
  seatsLeftLabel,
  validateSeatBooking,
} from "./spaces";

/* The two real rooms, as 06-seed.sql creates them. */
const shared20 = {
  id: 3,
  name: "Shared Space 01",
  room_type: "shared_space",
  maxCapacity: 20,
  day_rate_rwf: 30000,
  /* Both columns, as the live rows look after migration 21: the franc
     price is what is charged and the retired dollar one is still sitting
     there. Keeping both on the fixture is what proves the franc column
     wins rather than merely that it works when it is alone. */
  month_rate_rwf: 147059,
  month_rate_usd: 100,
  hour_rate_rwf: 5000,
};

const shared50 = { ...shared20, id: 4, name: "Shared Space 02", maxCapacity: 50 };

const meetingRoom = {
  id: 1,
  name: "Meeting Room 01",
  room_type: "meeting_room",
  maxCapacity: 8,
  regularPrice: 20,
};

const RATE = 1470.59;

describe("telling the two kinds of room apart", () => {
  it("reads the type from the data", () => {
    expect(isSharedSpace(shared20)).toBe(true);
    expect(isMeetingRoom(shared20)).toBe(false);
    expect(isSharedSpace(meetingRoom)).toBe(false);
    expect(isMeetingRoom(meetingRoom)).toBe(true);
  });

  /* A room from before the column existed, or a row the migration has
     not reached, must keep behaving as it always did. */
  it("treats a room with no type as a meeting room", () => {
    expect(isMeetingRoom({ name: "Old Room" })).toBe(true);
    expect(isMeetingRoom(null)).toBe(true);
  });

  /* The trap this avoids: believing a naming convention. */
  it("does not guess from the name", () => {
    expect(isSharedSpace({ name: "Shared Space 99", room_type: "meeting_room" })).toBe(
      false,
    );
  });
});

describe("seat counting", () => {
  it("uses maxCapacity as the seat count", () => {
    expect(seatCapacity(shared20)).toBe(20);
    expect(seatCapacity(shared50)).toBe(50);
  });

  it("has no seat count for a meeting room", () => {
    expect(seatCapacity(meetingRoom)).toBeNull();
  });

  it("subtracts what is taken", () => {
    expect(seatsLeft(shared20, 0)).toBe(20);
    expect(seatsLeft(shared20, 6)).toBe(14);
    expect(seatsLeft(shared20, 20)).toBe(0);
  });

  /* A room that has somehow been oversold must read as full, not as
     minus three, which would make "seats left" print a negative number
     and any comparison against it behave backwards. */
  it("clamps an oversold room to zero rather than going negative", () => {
    expect(seatsLeft(shared20, 23)).toBe(0);
  });

  /* null and 0 have to be distinguishable: a caller that cannot tell
     them apart prints "sold out" on every meeting room. */
  it("returns null, not zero, for a room not sold by the seat", () => {
    expect(seatsLeft(meetingRoom, 0)).toBeNull();
    expect(seatsLeft(meetingRoom, 0)).not.toBe(0);
  });

  it("writes the seat count as a sentence, including the awkward ones", () => {
    expect(seatsLeftLabel(shared20, 6)).toBe("14 of 20 seats left");
    expect(seatsLeftLabel(shared20, 19)).toBe("1 of 20 seats left");
    expect(seatsLeftLabel(shared20, 20)).toBe("Fully booked");
    expect(seatsLeftLabel(meetingRoom, 0)).toBeNull();
  });

  /* Proportional, so "5 left" is urgent in a 20-desk room and ordinary
     in a 50-desk one. */
  it("scales the low-seat warning to the size of the room", () => {
    expect(seatPressure(shared20, 15)).toBe("low"); // 5 of 20
    expect(seatPressure(shared50, 15)).toBe("open"); // 35 of 50
    expect(seatPressure(shared50, 39)).toBe("low"); // 11 of 50
    expect(seatPressure(shared20, 20)).toBe("full");
    expect(seatPressure(meetingRoom, 0)).toBeNull();
  });
});

describe("pass windows", () => {
  /* The boundary rule the database also relies on: consecutive day
     passes must not overlap, or the room loses a seat every midnight. */
  it("makes a day pass half-open, so Monday and Tuesday do not collide", () => {
    const monday = passWindow({
      startDate: "2026-09-28",
      passType: PASS_TYPES.DAY,
    });
    const tuesday = passWindow({
      startDate: "2026-09-29",
      passType: PASS_TYPES.DAY,
    });

    expect(monday.end.getTime()).toBe(tuesday.start.getTime());
    expect(monday.start < tuesday.start).toBe(true);
    // Overlap test, exactly as seats_taken() runs it.
    expect(monday.start < tuesday.end && tuesday.start < monday.end).toBe(false);
  });

  it("anchors a day pass to midnight, not to the moment of purchase", () => {
    const { start } = passWindow({
      startDate: new Date("2026-09-28T16:45:00"),
      passType: PASS_TYPES.DAY,
    });
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
  });

  it("spans several days when asked for several", () => {
    const { start, end } = passWindow({
      startDate: "2026-09-28",
      passType: PASS_TYPES.DAY,
      units: 5,
    });
    expect(daysInWindow(start, end)).toBe(5);
  });

  it("runs a month to the same date next month, not 30 days", () => {
    const { start, end } = passWindow({
      startDate: "2026-09-15",
      passType: PASS_TYPES.MONTH,
    });
    expect(start.getMonth()).toBe(8); // September
    expect(end.getMonth()).toBe(9); // October
    expect(end.getDate()).toBe(15);
  });

  /* The month-end case that produces an invalid date if done by hand. */
  it("clamps a month that starts on the 31st", () => {
    const { end } = passWindow({
      startDate: "2027-01-31",
      passType: PASS_TYPES.MONTH,
    });
    expect(end.getMonth()).toBe(1); // February, not March
    expect(end.getDate()).toBe(28);
  });

  it("has no window for an unknown pass or a bad date", () => {
    expect(passWindow({ startDate: "2026-09-28", passType: "yearly" })).toBeNull();
    expect(passWindow({ startDate: "not a date", passType: "day" })).toBeNull();
    expect(passWindow({ startDate: "not a date", passType: "hourly" })).toBeNull();
  });
});

describe("pricing a pass", () => {
  it("charges the day rate per seat per day", () => {
    expect(priceForPass({ room: shared20, passType: PASS_TYPES.DAY, rate: RATE }).rwf).toBe(
      30_000,
    );
    expect(
      priceForPass({ room: shared20, passType: PASS_TYPES.DAY, seats: 3, rate: RATE }).rwf,
    ).toBe(90_000);
    expect(
      priceForPass({
        room: shared20,
        passType: PASS_TYPES.DAY,
        seats: 2,
        units: 5,
        rate: RATE,
      }).rwf,
    ).toBe(300_000);
  });

  it("charges the month rate per seat per month", () => {
    expect(
      priceForPass({ room: shared20, passType: PASS_TYPES.MONTH, rate: RATE }).rwf,
    ).toBe(147_059);
    expect(
      priceForPass({ room: shared20, passType: PASS_TYPES.MONTH, seats: 4, rate: RATE }).rwf,
    ).toBe(588_236);
  });

  /* EVERY rate is quoted in francs now, so no pass's real price moves
     when the currency does — only the dollar figure beside it. The
     monthly desk used to be the exception, priced in dollars, which
     meant its franc price changed every morning. */
  it("keeps every price in francs and converts only the dollar figure", () => {
    for (const passType of [PASS_TYPES.DAY, PASS_TYPES.MONTH, PASS_TYPES.HOURLY]) {
      const now = priceForPass({ room: shared20, passType, rate: RATE });
      const later = priceForPass({ room: shared20, passType, rate: 1600 });

      expect(now.quotedIn).toBe("RWF");
      expect(now.rwf).toBe(later.rwf); // the real price did not move
      expect(now.usd).not.toBe(later.usd); // the conversion did
    }
  });

  /* A space the migration has not reached has only the retired dollar
     column, so it is converted rather than reported as unpriced — which
     is what makes deploying this in either order safe. */
  it("falls back to converting the retired month_rate_usd", () => {
    const preMigration = { ...shared20, month_rate_rwf: null };
    expect(
      priceForPass({ room: preMigration, passType: PASS_TYPES.MONTH, rate: 1500 }).rwf,
    ).toBe(150_000);
  });

  it("returns null when the room has no rate for that pass", () => {
    const noRates = {
      ...shared20,
      day_rate_rwf: null,
      month_rate_rwf: null,
      month_rate_usd: null,
    };
    expect(priceForPass({ room: noRates, passType: PASS_TYPES.DAY, rate: RATE })).toBeNull();
    expect(
      priceForPass({ room: noRates, passType: PASS_TYPES.MONTH, rate: RATE }),
    ).toBeNull();
  });

  it("offers the day rate as the headline price", () => {
    expect(fromPriceForSharedSpace(shared20, RATE).rwf).toBe(30_000);
  });

  it("shows what a monthly desk saves against paying daily", () => {
    const saving = monthlySavingVsDaily(shared20, RATE);
    expect(saving.dailyEquivalentRwf).toBe(660_000); // 22 × 30,000
    expect(saving.monthlyRwf).toBe(147_059);
    expect(saving.percent).toBe(78);
  });
});

describe("validateSeatBooking", () => {
  const now = new Date("2026-09-26T10:00:00");
  const tomorrow = "2026-09-27";

  function attempt(overrides = {}) {
    return validateSeatBooking({
      room: shared20,
      seats: 1,
      passType: PASS_TYPES.DAY,
      startDate: tomorrow,
      units: 1,
      seatsTaken: 0,
      rate: RATE,
      now,
      ...overrides,
    });
  }

  it("accepts a plain day pass and prices it", () => {
    const { error, value } = attempt();
    expect(error).toBeUndefined();
    expect(value.rwf).toBe(30_000);
    expect(value.seats).toBe(1);
    expect(value.seatsLeftAfter).toBe(19);
  });

  it("refuses a meeting room, which is not sold by the seat", () => {
    expect(attempt({ room: meetingRoom }).field).toBe("room");
  });

  /* Hourly used to be refused outright for a shared space. It is now the
     third way a desk is sold, so what must be refused is a pass that does
     not exist at all. */
  it("refuses a pass type that is not sold", () => {
    expect(attempt({ passType: "yearly" }).field).toBe("passType");
    expect(attempt({ passType: undefined }).field).toBe("passType");
  });

  it("refuses fewer than one seat, or a fractional one", () => {
    expect(attempt({ seats: 0 }).field).toBe("seats");
    expect(attempt({ seats: 1.5 }).field).toBe("seats");
    expect(attempt({ seats: -2 }).field).toBe("seats");
  });

  it("refuses more seats than the room has at all", () => {
    const { error, field } = attempt({ seats: 25 });
    expect(field).toBe("seats");
    expect(error).toMatch(/only 20 seats/i);
  });

  /* The rule this whole feature exists for. */
  it("refuses more seats than are free over those dates", () => {
    const { error, field } = attempt({ seats: 4, seatsTaken: 18 });
    expect(field).toBe("seats");
    expect(error).toMatch(/only 2 of 20 seats are free/i);
  });

  it("says so plainly when the room is full", () => {
    expect(attempt({ seatsTaken: 20 }).error).toMatch(/fully booked/i);
  });

  it("sells the very last seat", () => {
    const { error, value } = attempt({ seats: 1, seatsTaken: 19 });
    expect(error).toBeUndefined();
    expect(value.seatsLeftAfter).toBe(0);
  });

  it("refuses a start date that has gone", () => {
    expect(attempt({ startDate: "2026-09-20" }).field).toBe("startDate");
  });

  /* The one deliberate difference between the public site and the desk. */
  it("will not sell the public today, but will sell the desk today", () => {
    expect(attempt({ startDate: "2026-09-26" }).field).toBe("startDate");
    expect(
      attempt({ startDate: "2026-09-26", allowToday: true }).error,
    ).toBeUndefined();
  });

  it("blames the rate, not the dates, when a room has no price set", () => {
    const { error, field } = attempt({
      room: { ...shared20, day_rate_rwf: null },
    });
    expect(field).toBe("passType");
    expect(error).toMatch(/no daily rate set/i);
  });

  it("prices a multi-seat monthly desk and reports its window", () => {
    const { error, value } = attempt({
      passType: PASS_TYPES.MONTH,
      seats: 3,
      startDate: "2026-10-01",
    });
    expect(error).toBeUndefined();
    expect(value.usd).toBe(300);
    expect(value.end.getMonth()).toBe(10); // November
  });
});

/* ------------------------------------------------------------------
   Counting seats out of a booking list
   ------------------------------------------------------------------ */

import {
  peakSeatsTaken,
  seatAvailabilityByDay,
  seatsLeftAcrossRange,
  seatsTakenAcrossRange,
  seatsTakenOverWindow,
} from "./spaces";

/* Spanning several days, end exclusive. */
function pass(startDate, endDate, seats, status = "booked") {
  return {
    id: `${startDate}-${endDate}-${seats}`,
    startTime: `${startDate}T00:00:00`,
    endTime: `${endDate}T00:00:00`,
    seats,
    status,
    pass_type: "day",
  };
}

describe("seatsTakenOverWindow", () => {
  const monday = new Date("2026-09-28T00:00:00");
  const tuesday = new Date("2026-09-29T00:00:00");

  it("adds up the seats of overlapping bookings", () => {
    const bookings = [
      pass("2026-09-28", "2026-09-29", 3),
      pass("2026-09-28", "2026-09-29", 2),
    ];
    expect(seatsTakenOverWindow(bookings, monday, tuesday)).toBe(5);
  });

  it("ignores bookings on other days", () => {
    const bookings = [pass("2026-09-30", "2026-10-01", 4)];
    expect(seatsTakenOverWindow(bookings, monday, tuesday)).toBe(0);
  });

  /* Cancelled, no-show and failed free the seat. Counting them would
     make a room read as full because somebody changed their mind. */
  it("ignores bookings whose status has freed the seat", () => {
    const bookings = [
      pass("2026-09-28", "2026-09-29", 5, "cancelled"),
      pass("2026-09-28", "2026-09-29", 5, "no-show"),
      pass("2026-09-28", "2026-09-29", 5, "failed"),
      pass("2026-09-28", "2026-09-29", 2, "booked"),
    ];
    expect(seatsTakenOverWindow(bookings, monday, tuesday)).toBe(2);
  });

  it("counts pending and in-use, which are still holding a seat", () => {
    const bookings = [
      pass("2026-09-28", "2026-09-29", 1, "pending"),
      pass("2026-09-28", "2026-09-29", 1, "in-use"),
    ];
    expect(seatsTakenOverWindow(bookings, monday, tuesday)).toBe(2);
  });

  /* Completed means they have gone, and they usually go before the end
     time they bought. The desk that has just been vacated is on sale
     again from that moment — without the booking having to be deleted,
     which was the only way to free it before. */
  it("stops counting a seat the moment its session is completed", () => {
    const bookings = [
      pass("2026-09-28", "2026-09-29", 4, "in-use"),
      pass("2026-09-28", "2026-09-29", 6, "completed"),
    ];
    expect(seatsTakenOverWindow(bookings, monday, tuesday)).toBe(4);
  });

  /* The boundary the whole scheme rests on: Tuesday's pass must not be
     counted against Monday. */
  it("does not count a pass that starts exactly when the window ends", () => {
    const bookings = [pass("2026-09-29", "2026-09-30", 9)];
    expect(seatsTakenOverWindow(bookings, monday, tuesday)).toBe(0);
  });

  it("treats a booking with no seat count as one seat", () => {
    const legacy = {
      startTime: "2026-09-28T09:00:00",
      endTime: "2026-09-28T11:00:00",
      status: "booked",
    };
    expect(seatsTakenOverWindow([legacy], monday, tuesday)).toBe(1);
  });

  it("survives a booking with unreadable dates", () => {
    const junk = { startTime: "nope", endTime: "also nope", seats: 5, status: "booked" };
    expect(seatsTakenOverWindow([junk], monday, tuesday)).toBe(0);
    expect(seatsTakenOverWindow(null, monday, tuesday)).toBe(0);
  });
});

describe("seatAvailabilityByDay", () => {
  it("reports each day separately", () => {
    const bookings = [
      pass("2026-09-28", "2026-09-29", 4),
      pass("2026-09-29", "2026-09-30", 18),
    ];
    const days = seatAvailabilityByDay(shared20, bookings, {
      from: "2026-09-28",
      days: 3,
    });

    expect(days).toHaveLength(3);
    expect(days[0].seatsLeft).toBe(16);
    expect(days[1].seatsLeft).toBe(2);
    expect(days[1].pressure).toBe("low");
    expect(days[2].seatsLeft).toBe(20);
    expect(days[2].isFull).toBe(false);
  });

  it("marks a full day as full", () => {
    const days = seatAvailabilityByDay(
      shared20,
      [pass("2026-09-28", "2026-09-29", 20)],
      { from: "2026-09-28", days: 1 },
    );
    expect(days[0].isFull).toBe(true);
    expect(days[0].pressure).toBe("full");
  });

  it("has nothing to say about a meeting room", () => {
    expect(seatAvailabilityByDay(meetingRoom, [], { days: 5 })).toEqual([]);
  });
});

describe("seats available across a multi-day range", () => {
  /* The rule that a single seats-left figure hides, and the one that
     oversells if it is got wrong: a five-day pass needs the seat free on
     every one of the five days, so what is available over a range is the
     WORST day in it — not the average, and not the first. */
  it("is the fewest seats free on any single day of the range", () => {
    const bookings = [
      pass("2026-09-28", "2026-09-29", 2), // 18 left
      pass("2026-09-29", "2026-09-30", 17), // 3 left  <- the binding day
      pass("2026-09-30", "2026-10-01", 5), // 15 left
    ];

    expect(
      seatsLeftAcrossRange(
        shared20,
        bookings,
        new Date("2026-09-28T00:00:00"),
        new Date("2026-10-01T00:00:00"),
      ),
    ).toBe(3);
  });

  it("is the full room when nothing is booked", () => {
    expect(
      seatsLeftAcrossRange(
        shared20,
        [],
        new Date("2026-09-28T00:00:00"),
        new Date("2026-10-28T00:00:00"),
      ),
    ).toBe(20);
  });

  /* Composes with the validator: a four-seat request over a range whose
     busiest day has three left must be refused. */
  it("feeds the validator so a multi-day pass cannot oversell its worst day", () => {
    const bookings = [
      pass("2026-09-28", "2026-09-29", 2),
      pass("2026-09-29", "2026-09-30", 17),
    ];
    const start = new Date("2026-09-28T00:00:00");
    const end = new Date("2026-09-30T00:00:00");

    const taken = seatsTakenAcrossRange(shared20, bookings, start, end);
    expect(taken).toBe(17);

    const { error } = validateSeatBooking({
      room: shared20,
      seats: 4,
      passType: PASS_TYPES.DAY,
      startDate: "2026-09-28",
      units: 2,
      seatsTaken: taken,
      rate: RATE,
      now: new Date("2026-09-26T10:00:00"),
    });
    expect(error).toMatch(/only 3 of 20 seats are free/i);
  });

  it("has nothing to say about a meeting room", () => {
    expect(
      seatsLeftAcrossRange(meetingRoom, [], new Date(), new Date()),
    ).toBeNull();
  });
});

/* ------------------------------------------------------------------
   A desk by the hour
   ------------------------------------------------------------------ */

describe("hourly desks", () => {
  const RATE = 1470.59;
  const hourlyRoom = { ...shared20, hour_rate_rwf: 5000 };
  const noHourly = { ...shared20, hour_rate_rwf: null };

  it("is offered only when the space has an hourly rate", () => {
    expect(offersHourly(hourlyRoom)).toBe(true);
    expect(offersHourly(noHourly)).toBe(false);
    expect(offersHourly(meetingRoom)).toBe(false);
  });

  /* A picker must not show an option that cannot be bought. */
  it("drops hourly from the options for a space that does not sell it", () => {
    expect(passesFor(hourlyRoom)).toEqual(["hourly", "day", "month"]);
    expect(passesFor(noHourly)).toEqual(["day", "month"]);
  });

  describe("length", () => {
    it("is at least an hour", () => {
      expect(roundDeskMinutes(15)).toBe(MIN_DESK_MINUTES);
      expect(roundDeskMinutes(0)).toBe(MIN_DESK_MINUTES);
      expect(roundDeskMinutes(-30)).toBe(MIN_DESK_MINUTES);
      expect(roundDeskMinutes(undefined)).toBe(MIN_DESK_MINUTES);
    });

    /* Rounded UP, so a booking is never quietly shorter than asked. */
    it("rounds up onto the 15-minute grid", () => {
      expect(roundDeskMinutes(61)).toBe(75);
      expect(roundDeskMinutes(90)).toBe(90);
      expect(roundDeskMinutes(91)).toBe(105);
    });
  });

  describe("window", () => {
    it("keeps the time of day, unlike a day pass", () => {
      const { start, end } = passWindow({
        startDate: "2026-09-28T14:00:00",
        passType: PASS_TYPES.HOURLY,
        minutes: 180,
      });
      expect(start.getHours()).toBe(14);
      expect(end.getHours()).toBe(17);
    });

    it("drops stray seconds rather than billing them", () => {
      const { start } = passWindow({
        startDate: "2026-09-28T14:00:41",
        passType: PASS_TYPES.HOURLY,
        minutes: 60,
      });
      expect(start.getSeconds()).toBe(0);
    });

    it("can run past midnight, since the space never closes", () => {
      const { start, end } = passWindow({
        startDate: "2026-09-28T23:00:00",
        passType: PASS_TYPES.HOURLY,
        minutes: 180,
      });
      expect(start.getDate()).toBe(28);
      expect(end.getDate()).toBe(29);
      expect(end.getHours()).toBe(2);
    });
  });

  describe("price", () => {
    it("charges the hourly rate per seat per hour", () => {
      expect(
        priceForPass({
          room: hourlyRoom,
          passType: PASS_TYPES.HOURLY,
          minutes: 60,
          rate: RATE,
        }).rwf,
      ).toBe(5000);

      expect(
        priceForPass({
          room: hourlyRoom,
          passType: PASS_TYPES.HOURLY,
          seats: 3,
          minutes: 120,
          rate: RATE,
        }).rwf,
      ).toBe(30000);
    });

    /* Pro-rata by the quarter hour. Rounding 90 minutes up to two hours
       would be a second, invisible rounding on top of the grid. */
    it("bills part hours pro-rata", () => {
      expect(
        priceForPass({
          room: hourlyRoom,
          passType: PASS_TYPES.HOURLY,
          minutes: 90,
          rate: RATE,
        }).rwf,
      ).toBe(7500);
    });

    it("is quoted in RWF, like the day rate", () => {
      const price = priceForPass({
        room: hourlyRoom,
        passType: PASS_TYPES.HOURLY,
        minutes: 60,
        rate: RATE,
      });
      expect(price.quotedIn).toBe("RWF");
      // The real price does not move with the exchange rate.
      expect(
        priceForPass({
          room: hourlyRoom,
          passType: PASS_TYPES.HOURLY,
          minutes: 60,
          rate: 1600,
        }).rwf,
      ).toBe(price.rwf);
    });

    it("has no price for a space with no hourly rate", () => {
      expect(
        priceForPass({
          room: noHourly,
          passType: PASS_TYPES.HOURLY,
          minutes: 60,
          rate: RATE,
        }),
      ).toBeNull();
    });
  });

  describe("the day-pass crossover", () => {
    /* 30,000 a day against 5,000 an hour: six hours. */
    it("knows where the line is", () => {
      expect(crossoverMinutes(hourlyRoom)).toBe(360);
    });

    it("says nothing below the line", () => {
      expect(
        dayPassBeatsHourly({ room: hourlyRoom, minutes: 300, rate: RATE }),
      ).toBeNull();
    });

    /* Past it, hourly costs MORE for LESS, and letting that happen
       quietly is how a shop loses trust. */
    it("speaks up at and past the line", () => {
      const at = dayPassBeatsHourly({ room: hourlyRoom, minutes: 360, rate: RATE });
      expect(at.dayRwf).toBe(30000);
      expect(at.hourlyRwf).toBe(30000);

      const past = dayPassBeatsHourly({
        room: hourlyRoom,
        minutes: 480,
        rate: RATE,
      });
      expect(past.savedRwf).toBe(10000);
    });

    it("scales with the number of desks", () => {
      const past = dayPassBeatsHourly({
        room: hourlyRoom,
        minutes: 480,
        seats: 3,
        rate: RATE,
      });
      expect(past.savedRwf).toBe(30000);
    });

    it("has nothing to say when a space sells only one way", () => {
      expect(
        dayPassBeatsHourly({ room: noHourly, minutes: 600, rate: RATE }),
      ).toBeNull();
    });
  });

  describe("validation", () => {
    const now = new Date("2026-09-28T09:00:00");

    function attempt(overrides = {}) {
      return validateSeatBooking({
        room: hourlyRoom,
        seats: 1,
        passType: PASS_TYPES.HOURLY,
        startDate: "2026-09-28T14:00:00",
        minutes: 120,
        seatsTaken: 0,
        rate: RATE,
        now,
        ...overrides,
      });
    }

    it("accepts an afternoon desk and prices it", () => {
      const { error, value } = attempt();
      expect(error).toBeUndefined();
      expect(value.rwf).toBe(10000);
      expect(value.minutes).toBe(120);
      expect(value.durationMinutes).toBe(120);
    });

    /* Unlike a day pass, an hourly booking is judged against the moment:
       ten o'clock this morning is in the past at eleven. */
    it("refuses a start time that has already gone today", () => {
      const { error, field } = attempt({ startDate: "2026-09-28T08:00:00" });
      expect(field).toBe("startDate");
      expect(error).toMatch(/start time has passed/i);
    });

    it("allows later today, which a day pass would not", () => {
      expect(attempt({ startDate: "2026-09-28T10:00:00" }).error).toBeUndefined();
    });

    /* "They are going in now" writes the current minute as the start, and
       passWindow() drops the seconds — so at 09:00:40 the start is 09:00
       and forty seconds "in the past". Refusing that would make the one
       button for a walk-in the one button that never works. */
    it("does not treat the current minute as the past", () => {
      expect(
        attempt({
          startDate: "2026-09-28T09:00:00",
          now: new Date("2026-09-28T09:00:40"),
        }).error,
      ).toBeUndefined();
    });

    it("still refuses the minute before", () => {
      const { error } = attempt({
        startDate: "2026-09-28T08:59:00",
        now: new Date("2026-09-28T09:00:40"),
      });
      expect(error).toMatch(/start time has passed/i);
    });

    it("refuses a space that is not sold by the hour", () => {
      const { error, field } = attempt({ room: noHourly });
      expect(field).toBe("passType");
      expect(error).toMatch(/not sold by the hour/i);
    });

    /* The seat rule is the same rule; only the window is shorter. */
    it("still refuses to oversell the space", () => {
      const { error } = attempt({ seats: 4, seatsTaken: 18 });
      expect(error).toMatch(/only 2 of 20 seats are free/i);
    });

    it("lifts a short booking to the one-hour minimum", () => {
      const { error, value } = attempt({ minutes: 20 });
      expect(error).toBeUndefined();
      expect(value.minutes).toBe(60);
      expect(value.rwf).toBe(5000);
    });
  });
});

/* The whole point of an hourly desk: two bookings on the same day, at
   different times, do not compete for the same seat. */
describe("hourly desks and seat counting", () => {
  function hours(startIso, endIso, seats, status = "booked") {
    return { id: `${startIso}-${seats}`, startTime: startIso, endTime: endIso, seats, status };
  }

  it("frees the seat again once the booking ends", () => {
    const morning = hours("2026-09-28T09:00:00", "2026-09-28T12:00:00", 20);

    // Overlapping the morning: full.
    expect(
      seatsTakenOverWindow(
        [morning],
        new Date("2026-09-28T10:00:00"),
        new Date("2026-09-28T11:00:00"),
      ),
    ).toBe(20);

    // The afternoon is untouched by it.
    expect(
      seatsTakenOverWindow(
        [morning],
        new Date("2026-09-28T14:00:00"),
        new Date("2026-09-28T16:00:00"),
      ),
    ).toBe(0);
  });

  /* A day pass covers the whole day, so it competes with every hourly
     booking inside it — which is exactly right. */
  it("counts a day pass against an hourly booking on the same day", () => {
    const dayPass = hours("2026-09-28T00:00:00", "2026-09-29T00:00:00", 5);

    expect(
      seatsTakenOverWindow(
        [dayPass],
        new Date("2026-09-28T14:00:00"),
        new Date("2026-09-28T16:00:00"),
      ),
    ).toBe(5);
  });

  it("does not let two back-to-back hours collide", () => {
    const first = hours("2026-09-28T14:00:00", "2026-09-28T15:00:00", 20);
    expect(
      seatsTakenOverWindow(
        [first],
        new Date("2026-09-28T15:00:00"),
        new Date("2026-09-28T16:00:00"),
      ),
    ).toBe(0);
  });
});

/* ------------------------------------------------------------------
   Peak concurrency — the one sweep both questions come out of
   ------------------------------------------------------------------ */

describe("peakSeatsTaken", () => {
  const b = (from, to, seats, status = "booked") => ({
    id: `${from}-${to}-${seats}`,
    startTime: from,
    endTime: to,
    seats,
    status,
  });

  const win = (from, to) => [new Date(from), new Date(to)];

  it("is the most desks held at once, not the sum over the window", () => {
    /* Two 5-desk bookings that never overlap each other: the peak is 5,
       not 10. Summing would refuse a sale the room can take. */
    const bookings = [
      b("2026-09-28T09:00:00", "2026-09-28T11:00:00", 5),
      b("2026-09-28T13:00:00", "2026-09-28T15:00:00", 5),
    ];
    expect(
      peakSeatsTaken(bookings, ...win("2026-09-28T08:00:00", "2026-09-28T18:00:00")),
    ).toBe(5);
  });

  it("adds up bookings that genuinely overlap", () => {
    const bookings = [
      b("2026-09-28T09:00:00", "2026-09-28T12:00:00", 5),
      b("2026-09-28T10:00:00", "2026-09-28T11:00:00", 3),
    ];
    expect(
      peakSeatsTaken(bookings, ...win("2026-09-28T09:00:00", "2026-09-28T12:00:00")),
    ).toBe(8);
  });

  /* The bug this replaced: a morning that ended is irrelevant to an
     afternoon booking. Bucketing by whole days said otherwise. */
  it("ignores a booking that ended before the window began", () => {
    const bookings = [b("2026-09-28T09:00:00", "2026-09-28T12:00:00", 20)];
    expect(
      peakSeatsTaken(bookings, ...win("2026-09-28T14:00:00", "2026-09-28T16:00:00")),
    ).toBe(0);
  });

  it("frees a desk at the instant the booking ends", () => {
    const bookings = [b("2026-09-28T14:00:00", "2026-09-28T15:00:00", 20)];
    expect(
      peakSeatsTaken(bookings, ...win("2026-09-28T15:00:00", "2026-09-28T16:00:00")),
    ).toBe(0);
  });

  it("counts a booking that only partly overlaps the window", () => {
    const bookings = [b("2026-09-28T13:00:00", "2026-09-28T15:00:00", 6)];
    expect(
      peakSeatsTaken(bookings, ...win("2026-09-28T14:00:00", "2026-09-28T18:00:00")),
    ).toBe(6);
  });

  it("still finds the worst day of a multi-day range", () => {
    const bookings = [
      b("2026-09-28T00:00:00", "2026-09-29T00:00:00", 2),
      b("2026-09-29T00:00:00", "2026-09-30T00:00:00", 17),
      b("2026-09-30T00:00:00", "2026-10-01T00:00:00", 5),
    ];
    expect(
      peakSeatsTaken(bookings, ...win("2026-09-28T00:00:00", "2026-10-01T00:00:00")),
    ).toBe(17);
  });

  it("ignores statuses that have freed their desks", () => {
    const bookings = [
      b("2026-09-28T09:00:00", "2026-09-28T12:00:00", 20, "cancelled"),
    ];
    expect(
      peakSeatsTaken(bookings, ...win("2026-09-28T09:00:00", "2026-09-28T12:00:00")),
    ).toBe(0);
  });

  it("copes with no bookings at all", () => {
    expect(peakSeatsTaken([], ...win("2026-09-28", "2026-09-29"))).toBe(0);
    expect(peakSeatsTaken(null, ...win("2026-09-28", "2026-09-29"))).toBe(0);
  });
});

describe("an hourly desk against a day pass, on the same day", () => {
  /* A day pass covers midnight to midnight, so it competes with every
     hourly booking inside that day — which is correct. */
  it("counts a day pass against an afternoon desk", () => {
    const dayPass = {
      id: "d",
      startTime: "2026-09-28T00:00:00",
      endTime: "2026-09-29T00:00:00",
      seats: 18,
      status: "booked",
    };

    expect(
      seatsLeftAcrossRange(
        shared20,
        [dayPass],
        new Date("2026-09-28T14:00:00"),
        new Date("2026-09-28T16:00:00"),
      ),
    ).toBe(2);
  });

  /* And the reverse: a morning desk does not eat into a day pass bought
     for a different day. */
  it("does not count an hourly desk from another day", () => {
    const morning = {
      id: "h",
      startTime: "2026-09-27T09:00:00",
      endTime: "2026-09-27T11:00:00",
      seats: 20,
      status: "booked",
    };

    expect(
      seatsLeftAcrossRange(
        shared20,
        [morning],
        new Date("2026-09-28T00:00:00"),
        new Date("2026-09-29T00:00:00"),
      ),
    ).toBe(20);
  });
});
