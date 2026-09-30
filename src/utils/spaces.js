/* ------------------------------------------------------------------
   Shared working spaces: seats, passes and what they cost.

   A DELIBERATE MIRROR of StarSyncSpace-Client/app/_lib/spaces.js.

   The two apps are separate builds with no shared package — the same
   arrangement the booking rules already live under (utils/booking.js
   mirrors the client's availability.js). Keep the two in step: if the
   pricing, the pass windows or the seat arithmetic change on one side
   they change on the other, or the desk and the website will sell the
   same desk twice or quote two different prices for it.

   THE ONE DELIBERATE DIFFERENCE is the same one the meeting rooms have,
   and it is not in this file: it is in how it is CALLED. The desk passes
   `allowToday: true`, because a walk-in at two in the afternoon wants a
   desk for the rest of today, and the public site does not. Everything
   protective — the seat limit, the rates, the half-open windows — is
   identical on purpose.

   A meeting room and a shared space are sold on different axes:

     meeting room   the whole room, for a stretch of minutes. Booking it
                    makes it unavailable. Priced per hour in RWF.
     shared space   ONE SEAT, for whole days or a month. Booking it makes
                    the room one seat emptier. Priced per seat per day in
                    RWF, by the hour or by the month — every rate in RWF.

   So this is not a variation on booking.js — it is the other half.
   Nothing here deals in minutes, slots, or the turnaround gap, because
   none of those mean anything to a desk: nobody cleans a chair between
   two people sitting in it.
   ------------------------------------------------------------------ */

import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  startOfDay,
} from "date-fns";

import { rwfForUsd, usdForRwf } from "./fx";

/* Which statuses free a seat is decided in exactly one place. The same
   list drives NON_BLOCKING_STATUSES in booking.js and
   booking_holds_space() in the database, so a new status has to be
   considered once rather than in three arithmetic paths. */
import {
  PRICE_PER_MINUTE_RWF,
  isBlockingBooking,
  rwfPerMinuteFromRoom,
} from "./booking";

export const ROOM_TYPES = {
  MEETING_ROOM: "meeting_room",
  SHARED_SPACE: "shared_space",
};

/* Read from the data, never guessed from the name. A room called
   "Shared Space 01" that is typed as a meeting room is a data error
   somebody can fix; a name-sniffing helper is a bug nobody can. */
export function isSharedSpace(room) {
  return room?.room_type === ROOM_TYPES.SHARED_SPACE;
}

export function isMeetingRoom(room) {
  // Defaulting an unknown or missing type to "meeting room" is what
  // keeps every room that existed before this column did working
  // exactly as it did, including any row the migration has not reached.
  return !isSharedSpace(room);
}

/* ------------------------------------------------------------------
   The "from" price the marketing pages quote.
   ------------------------------------------------------------------ */

/* The cheapest per-minute price on offer, in francs.

   MEETING ROOMS ONLY, and that is the whole point of it living here.
   A shared space's hour_rate_rwf buys ONE DESK for an hour, not a room,
   so folding it into a minimum quotes "from 83 RWF a minute" — a seat
   rate, for a product that is not sold by the minute at all, undercutting
   the thing the sentence is actually about by a factor of six.

   The USD version this replaced got that right by accident: it read the
   retired "regularPrice", which is 0 on every desk, so a shared space
   fell through to the default instead of being counted. Once the franc
   column became the price, the accident stopped working — the desks
   have a real hourly rate in it.

   Falls back to PRICE_PER_MINUTE_RWF when there is no meeting room to
   read, which is also what an empty or failed room query gives. */
export function fromRwfPerMinute(rooms, rate) {
  const perMinute = (rooms ?? [])
    .filter(isMeetingRoom)
    .map((room) => rwfPerMinuteFromRoom(room, rate))
    .filter((value) => Number.isFinite(value) && value > 0);

  return perMinute.length ? Math.min(...perMinute) : PRICE_PER_MINUTE_RWF;
}

/* ----------------------------- passes ---------------------------- */

export const PASS_TYPES = {
  HOURLY: "hourly",
  DAY: "day",
  MONTH: "month",
};

/* The three ways a desk is sold, shortest first — which is also the
   order they appear in the picker.

   HOURLY is deliberately the same value a meeting-room booking carries.
   What makes a booking an hourly DESK booking rather than an hourly ROOM
   booking is the room's type, not the pass: a shared space holds seats
   over the window, a meeting room holds the whole room. Giving it a
   fourth value would have meant a second thing to keep in step for no
   gain, and would have broken every existing row. */
export const SHARED_SPACE_PASSES = [
  PASS_TYPES.HOURLY,
  PASS_TYPES.DAY,
  PASS_TYPES.MONTH,
];

export function isSharedSpacePass(passType) {
  return SHARED_SPACE_PASSES.includes(passType);
}

/* The shortest desk booking. An hour, because that is how people think
   about a desk and because a fifteen-minute desk booking churns the seat
   count for nothing. Above the first hour, bookings run on the same
   15-minute grid the meeting rooms use. */
export const MIN_DESK_MINUTES = 60;
export const DESK_STEP_MINUTES = 15;

export function passLabel(passType, units = 1) {
  if (passType === PASS_TYPES.MONTH)
    return units === 1 ? "Monthly desk" : `${units} months`;
  if (passType === PASS_TYPES.DAY)
    return units === 1 ? "Day pass" : `${units} day passes`;
  if (passType === PASS_TYPES.HOURLY)
    return units === 1 ? "1 hour" : `${units} hours`;
  return "Hourly";
}

/* Does this space sell by the hour at all?

   A space with no hourly rate is not broken — it simply is not offered
   that way, and the picker should not show an option that cannot be
   bought. Distinct from "the rate is zero", which ratePerSeat() also
   rejects; see the note there. */
export function offersHourly(room) {
  return isSharedSpace(room) && ratePerSeat(room?.hour_rate_rwf) !== null;
}

export function passesFor(room) {
  return SHARED_SPACE_PASSES.filter(
    (pass) => pass !== PASS_TYPES.HOURLY || offersHourly(room),
  );
}

/* ------------------------- the seat maths ------------------------ */

/* How many seats a shared space has. maxCapacity already means exactly
   this, so there is no second column to disagree with it. */
export function seatCapacity(room) {
  if (!isSharedSpace(room)) return null;
  const capacity = Number(room?.maxCapacity);
  return Number.isFinite(capacity) && capacity > 0 ? Math.floor(capacity) : 0;
}

/* What is LEFT, which is what a screen wants, clamped so that a room
   which has somehow been oversold reads as full rather than negative.

   Returns null for a meeting room on purpose. A caller that got 0 back
   would reasonably print "sold out" for a room that is simply not sold
   by the seat, so the absence of an answer has to be distinguishable
   from the answer zero. */
export function seatsLeft(room, seatsTaken = 0) {
  const capacity = seatCapacity(room);
  if (capacity === null) return null;
  const taken = Math.max(0, Number(seatsTaken) || 0);
  return Math.max(0, capacity - taken);
}

export function isSoldOut(room, seatsTaken = 0) {
  return seatsLeft(room, seatsTaken) === 0;
}

/* The phrase that goes on a room card. Worth centralising because it is
   the one sentence a customer reads to decide whether to bother, and
   "1 seats left" on the last seat of a coworking space is the kind of
   detail that makes a site look unfinished. */
export function seatsLeftLabel(room, seatsTaken = 0) {
  const left = seatsLeft(room, seatsTaken);
  if (left === null) return null;
  const capacity = seatCapacity(room);
  if (left === 0) return "Fully booked";
  if (left === 1) return `1 of ${capacity} seats left`;
  return `${left} of ${capacity} seats left`;
}

/* A traffic light for the same number, so the UI does not re-derive
   thresholds in three components. "Filling up" starts at a quarter of
   the room, which on a 20-desk floor is 5 seats and on a 50-desk floor
   is 12 — proportional, because "3 left" is alarming in a small room and
   unremarkable in a large one. */
export function seatPressure(room, seatsTaken = 0) {
  const left = seatsLeft(room, seatsTaken);
  if (left === null) return null;
  const capacity = seatCapacity(room) || 1;
  if (left === 0) return "full";
  if (left <= Math.max(1, Math.ceil(capacity * 0.25))) return "low";
  return "open";
}

/* -------------------------- the date maths ----------------------- */

/* The window a pass covers, as a half-open interval [start, end).

   Half-open is load-bearing and matches the database exactly (see
   seats_taken() in 02-seat-limit.sql, which compares with strict
   inequalities). A day pass for Monday runs to Tuesday 00:00, so
   Monday's pass and Tuesday's pass do not overlap and the room does not
   silently lose a seat on every boundary.

   A day pass is anchored to midnight rather than to the moment of
   purchase because that is what it is: a day, not 24 hours from now. A
   customer buying at 4pm gets the rest of that day, and everybody's
   Monday is the same Monday — which is what makes counting seats per day
   meaningful at all.

   A month is a CALENDAR month (date-fns addMonths), not 30 days: a pass
   bought on the 15th runs to the 15th. addMonths already clamps the
   month-end case, so the 31st of January gives the 28th of February
   rather than rolling into March. */
/* Snap a desk booking's length to the rules: at least an hour, and on
   the same 15-minute grid everything else in this building uses.

   Rounded UP rather than to the nearest step, so a length is never
   quietly shortened below what somebody asked for. */
export function roundDeskMinutes(minutes) {
  const requested = Number(minutes);
  if (!Number.isFinite(requested) || requested <= 0) return MIN_DESK_MINUTES;
  const stepped =
    Math.ceil(requested / DESK_STEP_MINUTES) * DESK_STEP_MINUTES;
  return Math.max(MIN_DESK_MINUTES, stepped);
}

export function passWindow({ startDate, passType, units = 1, minutes }) {
  /* An hourly desk is the one pass measured from a MOMENT rather than
     from a date: "two o'clock until five", not "Tuesday". So its start
     keeps its time of day, where a day or a month pass is anchored to
     midnight — a day pass bought at 4pm is still that whole day, and
     everybody's Monday has to be the same Monday for seat counting per
     day to mean anything. */
  if (passType === PASS_TYPES.HOURLY) {
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) return null;

    /* Whole minutes only. A datetime-local box hands over hours and
       minutes and nothing finer, so any seconds riding along came from
       the clock rather than from anyone's intention. */
    start.setSeconds(0, 0);

    const length = roundDeskMinutes(minutes ?? units * 60);
    return { start, end: new Date(start.getTime() + length * 60_000) };
  }

  const start = startOfDay(new Date(startDate));
  if (Number.isNaN(start.getTime())) return null;

  const count = Math.max(1, Math.floor(Number(units) || 1));

  if (passType === PASS_TYPES.MONTH)
    return { start, end: addMonths(start, count) };

  if (passType === PASS_TYPES.DAY)
    return { start, end: addDays(start, count) };

  return null;
}

/* How many days a window spans, for pricing a day pass that was given
   as a range rather than a count. */
export function daysInWindow(start, end) {
  const days = differenceInCalendarDays(startOfDay(new Date(end)), startOfDay(new Date(start)));
  return Math.max(1, days);
}

/* --------------------------- the money -------------------------- */

/* What a pass costs, in both currencies, with the live rate supplied
   rather than looked up.

   Every rate is stored in FRANCS and converted only for display:

     hour_rate_rwf    one seat for one hour.
     day_rate_rwf     one seat for one day.
     month_rate_rwf   one seat for one month.

   The monthly rate used to be the exception — month_rate_usd, quoted in
   dollars, with the franc figure derived. That meant a monthly desk cost
   a different number of francs every morning, which is not something a
   published price may do. Migration 21 moved it to francs with the other
   two; month_rate_usd is retired and read only as a fallback for a row
   the migration has not reached.

   The USD figures returned alongside are derived, and are what a card
   checkout charges — see priceForMinutes in availability.js.

   `rate` is required rather than defaulted so that a caller which forgot
   to fetch the live rate gets the old constant only through an explicit
   fallback inside rwfForUsd/usdForRwf, and never silently. */
/* Is this stored rate a price at all?

   Strictly greater than zero, and null/undefined/"" rejected rather than
   coerced — because Number(null) is 0, and "0 is a finite number >= 0"
   would have made an unpriced shared space sell for nothing. A rate of
   zero is never a decision to give desks away; it is a column nobody has
   filled in yet, and the honest answer to "what does this cost" is then
   "we cannot say", not "free". */
function ratePerSeat(value) {
  if (value === null || value === undefined || value === "") return null;
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export function priceForPass({
  room,
  passType,
  seats = 1,
  units = 1,
  minutes,
  rate,
}) {
  const seatCount = Math.max(1, Math.floor(Number(seats) || 1));
  const unitCount = Math.max(1, Math.floor(Number(units) || 1));

  if (passType === PASS_TYPES.HOURLY) {
    const perSeatPerHour = ratePerSeat(room?.hour_rate_rwf);
    if (perSeatPerHour === null) return null;

    /* Charged pro-rata by the quarter hour, not rounded up to whole
       hours: the length is already snapped to a 15-minute grid, and
       billing 90 minutes as two hours would be a second, invisible
       rounding on top of the first. */
    const length = roundDeskMinutes(minutes ?? unitCount * 60);
    const hours = length / 60;
    const rwf = Math.round(perSeatPerHour * seatCount * hours);

    return {
      rwf,
      usd: usdForRwf(rwf, rate),
      quotedIn: "RWF",
      perSeatRwf: Math.round(perSeatPerHour),
      perSeatUsd: usdForRwf(perSeatPerHour, rate),
      minutes: length,
    };
  }

  if (passType === PASS_TYPES.DAY) {
    const perSeatPerDay = ratePerSeat(room?.day_rate_rwf);
    if (perSeatPerDay === null) return null;

    const rwf = Math.round(perSeatPerDay * seatCount * unitCount);
    return {
      rwf,
      usd: usdForRwf(rwf, rate),
      // Which number is the real price and which is the conversion. A UI
      // that knows this can show the derived one as "≈".
      quotedIn: "RWF",
      perSeatRwf: Math.round(perSeatPerDay),
      perSeatUsd: usdForRwf(perSeatPerDay, rate),
    };
  }

  if (passType === PASS_TYPES.MONTH) {
    /* month_rate_rwf since migration 21. A space the migration has not
       reached still carries only the retired month_rate_usd, so that is
       converted as a fallback — which keeps a deploy safe in either
       order rather than reporting a monthly desk as unpriced. */
    const perSeatPerMonth =
      ratePerSeat(room?.month_rate_rwf) ??
      (ratePerSeat(room?.month_rate_usd) === null
        ? null
        : rwfForUsd(ratePerSeat(room.month_rate_usd), rate));
    if (perSeatPerMonth === null) return null;

    const rwf = Math.round(perSeatPerMonth * seatCount * unitCount);
    return {
      rwf,
      usd: usdForRwf(rwf, rate),
      quotedIn: "RWF",
      perSeatRwf: Math.round(perSeatPerMonth),
      perSeatUsd: usdForRwf(perSeatPerMonth, rate),
    };
  }

  return null;
}

/* The cheapest way in, for a room card that has one line to sell with.
   Returns the day rate, since that is the entry price and the one a
   first-time visitor is comparing. */
export function fromPriceForSharedSpace(room, rate) {
  return priceForPass({
    room,
    passType: PASS_TYPES.DAY,
    seats: 1,
    units: 1,
    rate,
  });
}

/* The point at which an hourly desk stops being the cheaper option.

   At 5,000 an hour against a 30,000 day, that is six hours — and past it
   somebody booking hourly is paying MORE for LESS. A shop that lets that
   happen silently is one people stop trusting, so both apps say so and
   offer the swap.

   Returns null when there is nothing to say: no hourly rate, no day
   rate, or a length still on the right side of the line. */
export function dayPassBeatsHourly({ room, minutes, seats = 1, rate }) {
  const hourly = priceForPass({
    room,
    passType: PASS_TYPES.HOURLY,
    seats,
    minutes,
    rate,
  });
  const daily = priceForPass({
    room,
    passType: PASS_TYPES.DAY,
    seats,
    units: 1,
    rate,
  });

  if (!hourly || !daily) return null;
  if (hourly.rwf < daily.rwf) return null;

  return {
    hourlyRwf: hourly.rwf,
    dayRwf: daily.rwf,
    savedRwf: hourly.rwf - daily.rwf,
    /* Where the line actually falls, so the copy can say "from six
       hours" rather than only reacting once somebody crosses it. */
    breakEvenMinutes: crossoverMinutes(room),
  };
}

/* The shortest booking at which a day pass costs no more than hourly. */
export function crossoverMinutes(room) {
  const perHour = ratePerSeat(room?.hour_rate_rwf);
  const perDay = ratePerSeat(room?.day_rate_rwf);
  if (perHour === null || perDay === null) return null;
  return roundDeskMinutes((perDay / perHour) * 60);
}

/* How much a month saves against buying the same days one at a time.
   Worth showing: at 30,000 RWF a day a month of weekdays is over 600,000
   RWF, and $100 is a fraction of it — a discount that large is the main
   reason to take a monthly desk, and it is invisible unless stated. */
export function monthlySavingVsDaily(room, rate, workingDaysPerMonth = 22) {
  const daily = priceForPass({
    room,
    passType: PASS_TYPES.DAY,
    units: workingDaysPerMonth,
    rate,
  });
  const monthly = priceForPass({ room, passType: PASS_TYPES.MONTH, rate });

  if (!daily || !monthly) return null;
  if (monthly.rwf >= daily.rwf) return null;

  return {
    dailyEquivalentRwf: daily.rwf,
    monthlyRwf: monthly.rwf,
    savedRwf: daily.rwf - monthly.rwf,
    percent: Math.round((1 - monthly.rwf / daily.rwf) * 100),
    workingDaysPerMonth,
  };
}

/* ------------------------------------------------------------------
   One validator for a seat booking.

   Same shape as validateAdminBooking: { error, field } or { value }, so
   a form can put each message under the control that caused it instead
   of showing one red line and making the customer guess.

   `seatsTaken` is how many seats are already held over the SAME window,
   which only the caller can know (it is a database question). Passing it
   in keeps this function pure and keeps the count being asked for once
   rather than once per rule.

   This is a courtesy check, not the guarantee. Two people buying the
   last seat at the same instant will both pass it, and the database's
   seat-capacity trigger is what stops the second one. The apps check
   first so that the common case gets a sentence instead of a constraint
   violation.
   ------------------------------------------------------------------ */
export function validateSeatBooking({
  room,
  seats = 1,
  passType,
  startDate,
  units = 1,
  minutes,
  seatsTaken = 0,
  rate,
  now = new Date(),
  // The public site will not sell a seat for a day that has already
  // started; the desk will, because a walk-in at 2pm wants today. Same
  // deliberate split as the meeting rooms' lead time.
  allowToday = false,
}) {
  if (!room) return { error: "Pick a space", field: "room" };

  if (!isSharedSpace(room))
    return {
      error: "That room is rented whole, not by the seat",
      field: "room",
    };

  if (!isSharedSpacePass(passType))
    return { error: "Choose a day pass or a monthly desk", field: "passType" };

  const seatCount = Number(seats);
  if (!Number.isInteger(seatCount) || seatCount < 1)
    return { error: "Book at least one seat", field: "seats" };

  const capacity = seatCapacity(room);
  if (seatCount > capacity)
    return {
      error: `${room.name} has only ${capacity} seats in total`,
      field: "seats",
    };

  const isHourly = passType === PASS_TYPES.HOURLY;

  if (isHourly && !offersHourly(room))
    return {
      error: `${room.name} is not sold by the hour`,
      field: "passType",
    };

  const window = passWindow({ startDate, passType, units, minutes });
  if (!window)
    return {
      error: isHourly
        ? "Pick a valid start date and time"
        : "Pick a valid start date",
      field: "startDate",
    };

  /* An hourly desk is checked against the MOMENT, because a booking for
     ten o'clock this morning is in the past at eleven. A day or a month
     pass is checked against the DAY, because buying today's day pass at
     four in the afternoon is perfectly normal. */
  if (isHourly) {
    /* Compared against the top of the current MINUTE, not the exact
       instant. Every control that feeds this — the time box, and the
       desk's "they are going in now" — expresses whole minutes, and
       passWindow() zeroes the seconds to match. Against a raw `now` a
       desk sold at 14:05:30 to start at 14:05 is half a minute in the
       past and would be refused for a start time the seller had just
       picked. This minute is not the past. */
    const thisMinute = new Date(now);
    thisMinute.setSeconds(0, 0);
    if (window.start < thisMinute)
      return { error: "That start time has passed", field: "startDate" };
  } else {
    const today = startOfDay(now);
    if (window.start < today)
      return { error: "That start date has passed", field: "startDate" };
    if (!allowToday && window.start.getTime() === today.getTime())
      return {
        error:
          "Day passes start from tomorrow — come to reception for a desk today",
        field: "startDate",
      };
  }

  const free = seatsLeft(room, seatsTaken);
  if (free === 0)
    return {
      error: `${room.name} is fully booked for those dates`,
      field: "seats",
    };
  if (seatCount > free)
    return {
      error: `Only ${free} of ${capacity} seats are free for those dates`,
      field: "seats",
    };

  const price = priceForPass({
    room,
    passType,
    seats: seatCount,
    units,
    minutes,
    rate,
  });
  if (!price) {
    // A shared space with no rate set is a configuration error, not
    // something the customer can fix by choosing differently, so it
    // says so rather than pretending the dates were wrong.
    const which =
      passType === PASS_TYPES.MONTH
        ? "monthly"
        : passType === PASS_TYPES.HOURLY
          ? "hourly"
          : "daily";
    return {
      error: `${room.name} has no ${which} rate set yet`,
      field: "passType",
    };
  }

  return {
    value: {
      start: window.start,
      end: window.end,
      seats: seatCount,
      passType,
      units: Math.max(1, Math.floor(Number(units) || 1)),
      usd: price.usd,
      rwf: price.rwf,
      quotedIn: price.quotedIn,
      // The bookings table still carries these two from the original
      // hotel schema and several views read them, so they are filled in
      // consistently rather than left to whatever a caller guesses.
      durationMinutes: Math.round((window.end - window.start) / 60000),
      seatsLeftAfter: free - seatCount,
      /* Only meaningful for an hourly desk, and null otherwise so a
         caller cannot mistake a day pass's 1440 for a chosen length. */
      minutes: isHourly ? price.minutes : null,
    },
  };
}

/* ------------------------------------------------------------------
   Counting seats out of a list of bookings.

   The database can answer this too (seats_taken() in 02-seat-limit.sql,
   which is what the capacity trigger uses), and that is the answer that
   ENFORCES the limit. These are for DISPLAY: the room pages already load
   a room's bookings, so a calendar of "how full is each of the next
   thirty days" is arithmetic on data in hand rather than thirty round
   trips.

   Both implementations have to agree, so both use the same half-open
   overlap test — a booking counts against a window when it starts before
   the window ends and ends after the window starts, with strict
   inequalities at both ends so touching intervals do not collide.
   ------------------------------------------------------------------ */

export function overlapsWindow(booking, start, end) {
  const bookingStart = new Date(booking?.startTime);
  const bookingEnd = new Date(booking?.endTime);
  if (Number.isNaN(bookingStart.getTime()) || Number.isNaN(bookingEnd.getTime()))
    return false;
  return bookingStart < end && start < bookingEnd;
}

/* How many seats are held across a window.

   `seats` defaults to 1 for any row that predates the column — those are
   all meeting-room bookings, where one booking is the whole room, so
   treating a missing value as 1 is both safe and correct. */
export function seatsTakenOverWindow(bookings, start, end) {
  return (bookings ?? [])
    .filter(isBlockingBooking)
    .filter((booking) => overlapsWindow(booking, start, end))
    .reduce((total, booking) => total + (Number(booking.seats) || 1), 0);
}

/* The same question asked once per day, for a strip of dates.

   Returned as a list rather than a map so the caller can render it in
   order without sorting keys, and each entry carries the numbers a UI
   needs rather than making every consumer re-derive them.

   One pass per day over the bookings list is O(days × bookings), which
   for thirty days and a room's worth of bookings is nothing — and is
   worth far more than a cleverer algorithm nobody can check. */
export function seatAvailabilityByDay(room, bookings, { from = new Date(), days = 30 } = {}) {
  if (!isSharedSpace(room)) return [];

  const capacity = seatCapacity(room);
  const first = startOfDay(new Date(from));

  return Array.from({ length: Math.max(1, Math.floor(days)) }, (_, offset) => {
    const start = addDays(first, offset);
    const end = addDays(first, offset + 1);
    const taken = seatsTakenOverWindow(bookings, start, end);
    const left = Math.max(0, capacity - taken);

    return {
      date: start,
      seatsTaken: taken,
      seatsLeft: left,
      capacity,
      isFull: left === 0,
      pressure: seatPressure(room, taken),
    };
  });
}

/* The busiest MOMENT in a window: the most desks held at once.

   This is the number that decides whether a booking can be sold, and the
   subtlety a single "seats left" figure hides. Two different questions
   have to come out right:

     a five-day pass   needs its desk free on all five days, so what is
                       available is the worst day in the range — not the
                       average, and not the total over it.
     a two-hour desk   competes only with what overlaps those two hours.
                       A room that was full all morning is irrelevant to
                       an afternoon booking, and that is the entire point
                       of selling by the hour.

   Both are the same question — what is the PEAK number of desks held at
   any instant inside the window — so both are answered by one sweep.

   An earlier version bucketed by whole days, which was right for a day
   pass and wrong for an hourly one: it counted a booking that had ended
   at noon against a desk starting at two, and refused the sale.

   The sweep clips every booking to the window, sorts the resulting
   arrivals and departures, and walks them tracking a running total.
   Departures are processed before arrivals at the same instant, so a
   booking ending at 3pm frees its desk for one starting at 3pm — the
   same half-open rule the database uses. */
export function peakSeatsTaken(bookings, start, end) {
  const from = new Date(start);
  const to = new Date(end);

  const events = [];
  for (const booking of bookings ?? []) {
    if (!isBlockingBooking(booking)) continue;
    if (!overlapsWindow(booking, from, to)) continue;

    const seats = Number(booking.seats) || 1;
    const arrives = Math.max(new Date(booking.startTime).getTime(), from.getTime());
    const leaves = Math.min(new Date(booking.endTime).getTime(), to.getTime());
    if (!(leaves > arrives)) continue;

    events.push({ at: arrives, delta: seats });
    events.push({ at: leaves, delta: -seats });
  }

  // -1 before +1 at the same instant: a desk freed at 3pm is available
  // to a booking starting at 3pm.
  events.sort((a, b) => a.at - b.at || a.delta - b.delta);

  let running = 0;
  let peak = 0;
  for (const { delta } of events) {
    running += delta;
    if (running > peak) peak = running;
  }
  return peak;
}

export function seatsLeftAcrossRange(room, bookings, start, end) {
  if (!isSharedSpace(room)) return null;
  return Math.max(0, seatCapacity(room) - peakSeatsTaken(bookings, start, end));
}

/* The inverse, in the shape validateSeatBooking() wants. */
export function seatsTakenAcrossRange(room, bookings, start, end) {
  if (!isSharedSpace(room)) return 0;
  return peakSeatsTaken(bookings, start, end);
}
