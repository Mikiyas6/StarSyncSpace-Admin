/* ------------------------------------------------------------------
   Booking rules, admin side.

   The public site owns the same rules in
   StarSyncSpace-Client/app/_lib/availability.js. The two apps are
   separate builds with no shared package, so this is a deliberate
   mirror rather than an import — keep the two in step, and keep the
   deliberate DIFFERENCES to the short list below, all of which exist
   because a person is standing at the desk:

     - no one-hour lead time. A walk-in books for right now.
     - the admin may set the status and the paid flag directly.

   Everything else — the turnaround gap between bookings, which statuses
   hold a room, how a room's hourly price becomes a total — is identical
   on purpose, because a booking taken at the desk has to be as valid as
   one taken on the site.
   ------------------------------------------------------------------ */

import { rwfForUsd, usdForRwf } from "./fx";

export const MINUTE_MS = 60 * 1000;
export const FULL_DAY_MINUTES = 24 * 60;
export const SLOT_STEP_MINUTES = 15;
export const DEFAULT_BUFFER_MINUTES = 15;

/* Kept in sync with RWF_PER_USD in the client's availability.js.

   A FALLBACK, not the rate. Everything that prices a real booking is
   handed the live rate from useFxRate(); this is only what to use when
   nobody passed one, and every RWF figure produced from it is by
   definition out of date. */
export const RWF_PER_USD = 1470.59;

/* The last-resort per-minute price, in francs: 30,000 RWF an hour, which
   is what a meeting room costs. Mirrors PRICE_PER_MINUTE_RWF in the
   client's availability.js.

   Only ever a display fallback for a "from" figure with no priced room
   to read — see fromRwfPerMinute in spaces.js. It must NOT be used to
   price a real booking: rwfPerMinuteFromRoom returns 0 for an unpriced
   room on purpose, so a room nobody has given a rate cannot be quietly
   sold at a guess. */
export const PRICE_PER_MINUTE_RWF = 500;

/* The whole status vocabulary in one place, with who is allowed to set
   each one. `auto` statuses are written by the system; `manual` ones are
   a judgement the admin makes and nothing else may make for them. */
export const BOOKING_STATUSES = {
  pending: {
    label: "Pending payment",
    tag: "silver",
    setBy: "auto",
    holdsRoom: true,
    help: "The guest is on the payment page. Expires on its own after 10 minutes.",
  },
  booked: {
    label: "Booked",
    tag: "yellow",
    setBy: "auto",
    holdsRoom: true,
    help: "Confirmed and paid for, or taken at the desk. Starts on its own at the booked time.",
  },
  "in-use": {
    label: "In use",
    tag: "coral",
    setBy: "auto",
    holdsRoom: true,
    help: "The session is running. Set automatically at the start time, or early by the desk.",
  },
  completed: {
    label: "Completed",
    tag: "green",
    setBy: "auto",
    /* They have left. Whatever the booked end time said, the room and
       every desk in it are free again from this moment.

       This used to say true, on the reading that a completed booking
       still "owns" its slot until the clock catches up. That is wrong in
       the one case the status exists for: the desk presses Complete
       because the guest walked out early, and the whole point is to put
       the room back on sale. The seat count went on holding their desks
       until the original end time, and the only way to free them was to
       DELETE the booking — which destroys the record of a session that
       really happened, and the money it took. */
    holdsRoom: false,
    help: "The session finished. Set automatically at the end time, or early by the desk. Frees the room and its desks immediately.",
  },
  cancelled: {
    label: "Cancelled",
    tag: "silver",
    setBy: "manual",
    holdsRoom: false,
    help: "Called off before it started. Frees the room. Never set automatically.",
  },
  "no-show": {
    label: "No-show",
    tag: "coral",
    setBy: "manual",
    holdsRoom: false,
    help: "Nobody turned up. A judgement call, so the system never makes it for you.",
  },
  failed: {
    label: "Payment failed",
    tag: "silver",
    setBy: "auto",
    holdsRoom: false,
    help: "Payment did not go through, or the hold expired. Frees the room.",
  },
};

export const NON_BLOCKING_STATUSES = Object.entries(BOOKING_STATUSES)
  .filter(([, meta]) => !meta.holdsRoom)
  .map(([status]) => status);

export function isBlockingBooking(booking) {
  return !NON_BLOCKING_STATUSES.includes(booking?.status);
}

export function statusTag(status) {
  return BOOKING_STATUSES[status]?.tag ?? "silver";
}

export function statusLabel(status) {
  return BOOKING_STATUSES[status]?.label ?? String(status ?? "unknown");
}

/* ----------------------------- money ----------------------------- */

/* THE PRICE IS IN FRANCS.

   rooms.hour_rate_rwf is the room's HOURLY rate in RWF, as the admin
   types it. For a meeting room that buys the whole room for an hour; for
   a shared space it buys one seat (see spaces.js). Every total is
   per-minute, so this is the one place it is divided by sixty.

   It used to be rooms."regularPrice", in dollars, with every franc a
   customer saw derived from it at whatever the rate happened to be.
   Migration 21 inverted that: the franc figure is the price, the dollar
   figure is the conversion, and "regularPrice" is retired — read here
   only as a fallback for a room the migration has not reached, which is
   what makes deploying this in either order safe.

   `rate` is consulted ONLY for that fallback. A room with hour_rate_rwf
   set is priced without any exchange rate at all, which is the whole
   point: its price does not move when the currency does. */
export function rwfPerMinuteFromRoom(room, rate = RWF_PER_USD) {
  const hourlyRwf = Number(room?.hour_rate_rwf);
  if (Number.isFinite(hourlyRwf) && hourlyRwf > 0) return hourlyRwf / 60;

  const hourlyUsd = Number(room?.regularPrice);
  if (Number.isFinite(hourlyUsd) && hourlyUsd > 0)
    return rwfForUsd(hourlyUsd, rate) / 60;

  return 0;
}

/* `rwfPerUsd` is the LIVE exchange rate; `rwfPerMinute` is the room's
   own price. Two different rates, which is why they are separate
   arguments.

   The FRANC total is the price. The DOLLAR total is what it converts to
   right now — what a card checkout charges, and what gets frozen onto
   the booking beside the francs as the conversion that was true at the
   moment of sale.

   The exchange rate used to be dropped on the floor here: this took a
   USD per-minute rate and converted with a hardcoded 1470.59 while
   CreateBookingForm was already handing the live rate in as a third
   argument. That is how a two-hour booking came to carry 60,000 RWF —
   40.80 USD times a rate from 2025. With the price in francs the
   exchange rate cannot get into it at all. */
export function priceForMinutes(minutes, rwfPerMinute, rwfPerUsd = RWF_PER_USD) {
  const perMinute = Number(rwfPerMinute) || 0;
  const rwf = Math.round(perMinute * minutes);
  return { rwf, usd: usdForRwf(rwf, rwfPerUsd), quotedIn: "RWF" };
}

/* ---------------------------- the clock -------------------------- */

function minutesOfDay(value, fallback) {
  const [hour, minute] = String(value ?? fallback)
    .split(":")
    .map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

// A venue whose hours run 00:00 → 23:59 (or 24:00) never closes, so a
// booking there has no closing time to run past. This is the distinction
// that makes a 24-hour booking startable at any moment of the day.
export function isOpen24Hours(settings = {}) {
  const open = minutesOfDay(settings.business_hours_start, "00:00");
  const close = minutesOfDay(settings.business_hours_end, "23:59");
  if (open === null || close === null) return true;
  if (open !== 0) return false;
  return close >= 23 * 60 + 59 || close === 0;
}

export function fitsBusinessHours(start, end, settings = {}) {
  if (isOpen24Hours(settings)) return true;

  const openMinutes = minutesOfDay(settings.business_hours_start, "00:00");
  const closeMinutes = minutesOfDay(settings.business_hours_end, "23:59");

  const open = new Date(start);
  open.setHours(Math.floor(openMinutes / 60), openMinutes % 60, 0, 0);
  const close = new Date(start);
  close.setHours(Math.floor(closeMinutes / 60), closeMinutes % 60, 0, 0);

  return start >= open && end <= close;
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// A booking holds the room until its end PLUS the turnaround window, so
// the next group cannot walk in before the room has been reset.
export function blockedUntil(booking, gapMinutes = DEFAULT_BUFFER_MINUTES) {
  return new Date(new Date(booking.endTime).getTime() + gapMinutes * MINUTE_MS);
}

export function conflictsWithBookings(
  start,
  end,
  bookings,
  gapMinutes = DEFAULT_BUFFER_MINUTES,
  ignoreBookingId = null,
) {
  return (bookings ?? [])
    .filter(isBlockingBooking)
    .filter((booking) => booking.id !== ignoreBookingId)
    .some((booking) =>
      overlaps(
        new Date(booking.startTime),
        blockedUntil(booking, gapMinutes),
        start,
        end,
      ),
    );
}

/* Whole minutes only. A datetime-local box hands over hours and minutes
   and nothing finer, so any seconds riding along came from the clock, not
   from anyone's intention — and rounding them to the nearest minute would
   turn a 14:00 end typed 40 seconds in into an extra billed minute. */
function wholeMinutes(date) {
  return Math.floor(date.getTime() / MINUTE_MS) * MINUTE_MS;
}

/* Round a moment UP to the next 15-minute step, so the desk's default
   start lines up with the same grid the public slot picker uses. */
export function roundUpToStep(date, stepMinutes = SLOT_STEP_MINUTES) {
  const ms = stepMinutes * MINUTE_MS;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

export function durationOptions(settings = {}) {
  const rawMin = Number(settings?.min_booking_duration_minutes) || 15;
  const min = Math.max(15, Math.ceil(rawMin / 15) * 15);
  const max = Math.max(
    min,
    Number(settings?.max_booking_duration_minutes) || FULL_DAY_MINUTES,
  );

  const options = [];
  for (let minutes = min; minutes <= max; minutes += SLOT_STEP_MINUTES)
    options.push(minutes);
  if (!options.includes(max)) options.push(max);
  return options;
}

export function formatDuration(minutes) {
  if (minutes >= FULL_DAY_MINUTES) {
    const days = Math.floor(minutes / FULL_DAY_MINUTES);
    const rest = minutes % FULL_DAY_MINUTES;
    if (days === 1 && rest === 0) return "Full day, 24 hrs";
    if (rest === 0) return `${days} days`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr${hours > 1 ? "s" : ""}`;
  return `${hours} hr${hours > 1 ? "s" : ""} ${mins} min`;
}

/* The shortest and longest a booking may run, as plain numbers, so a
   screen can say "15 min to 24 hrs" without walking the whole option
   list to find its own ends. */
export function durationBounds(settings = {}) {
  const min = Math.max(1, Number(settings?.min_booking_duration_minutes) || 15);
  const max = Math.max(
    min,
    Number(settings?.max_booking_duration_minutes) || FULL_DAY_MINUTES,
  );
  return { min, max };
}

/* ------------------------------------------------------------------
   One validator for a booking the desk is about to write.

   Returns { error } or { value }. Deliberately NOT applying the public
   site's one-hour lead time: the point of this form is the person who
   just walked in and wants the room now. What it does keep is every
   rule that protects the room itself — no double-booking, no eating
   into the turnaround window, no zero-length or absurd durations.

   LENGTH comes in one of two shapes. The desk now types a start and an
   end — that is how a person at a counter thinks about a room, and it
   was the only way to say "until 6" without counting hours in your head
   — so `end` is the preferred input. `durationMinutes` is still accepted
   for callers that hold a length instead. When both arrive, `end` wins.
   Either way the stored end is recomputed from the rounded minute count,
   so endTime and duration_minutes can never disagree.
   ------------------------------------------------------------------ */
export function validateAdminBooking({
  start,
  end: endInput,
  durationMinutes,
  room,
  settings = {},
  existingBookings = [],
  ignoreBookingId = null,
  /* The live USD→RWF rate, so the RWF total frozen onto the booking is
     today's conversion of the room's USD rate and not a stale constant.
     Defaulted rather than required so the rule-checking half of this
     validator stays callable from a test with no rate to hand. */
  rate = RWF_PER_USD,
  now = new Date(),
}) {
  /* Every rejection carries the `field` it belongs to, so the form can
     put the message under the control that caused it instead of making
     the admin guess which of six inputs a lone red line refers to. */
  if (!room) return { error: "Pick a room", field: "room" };
  if (!(start instanceof Date) || Number.isNaN(start.getTime()))
    return { error: "Pick a valid start date and time", field: "start" };

  const hasEnd = endInput instanceof Date && !Number.isNaN(endInput.getTime());
  // Length complaints belong under whichever control the caller actually
  // showed: the end-time box, or the older duration control.
  const lengthField = hasEnd ? "end" : "duration";
  const minutes = hasEnd
    ? (wholeMinutes(endInput) - wholeMinutes(start)) / MINUTE_MS
    : Number(durationMinutes);

  if (!Number.isFinite(minutes) || minutes <= 0)
    return {
      error: hasEnd
        ? "The end time has to be after the start time"
        : "Pick how long the booking runs for",
      field: lengthField,
    };

  const { min: minMinutes, max: maxMinutes } = durationBounds(settings);
  if (minutes < minMinutes)
    return {
      error: `Bookings must be at least ${formatDuration(minMinutes)} long`,
      field: lengthField,
    };
  if (minutes > maxMinutes)
    return {
      error: `Bookings cannot be longer than ${formatDuration(maxMinutes)}`,
      field: lengthField,
    };

  const end = new Date(start.getTime() + minutes * MINUTE_MS);

  if (!fitsBusinessHours(start, end, settings))
    return {
      error: `That runs outside opening hours (${
        settings.business_hours_start ?? "00:00"
      }–${settings.business_hours_end ?? "23:59"})`,
      field: "start",
    };

  const gapMinutes =
    Number(settings.booking_buffer_minutes) || DEFAULT_BUFFER_MINUTES;
  if (
    conflictsWithBookings(start, end, existingBookings, gapMinutes, ignoreBookingId)
  )
    return {
      error: `That clashes with another booking for this room — rooms need ${gapMinutes} minutes to turn around in between`,
      field: "start",
    };

  const rwfPerMinute = rwfPerMinuteFromRoom(room, rate);
  const { usd, rwf } = priceForMinutes(minutes, rwfPerMinute, rate);

  return {
    value: {
      start,
      end,
      durationMinutes: minutes,
      usd,
      rwf,
      // Whole hours, rounded, kept only because the bookings table has
      // carried this column since the original hotel schema and several
      // views still read it. duration_minutes is the real number.
      numHours: Math.max(1, Math.round(minutes / 60)),
      startsInPast: start < now,
    },
  };
}

/* ------------------------------------------------------------------
   What a booking's status SHOULD be, given the clock.

   This is the whole of the automatic half of the lifecycle, expressed
   as a pure function so it can be tested without a database:

     booked   → in-use     once the start time passes
     in-use   → completed  once the end time passes
     booked   → completed  when the entire window elapsed unattended

   Deliberately absent: no-show. Whether nobody turned up is a fact only
   a person in the building knows, and auto-labelling a paying customer
   a no-show because the desk was busy is worse than leaving it to the
   desk. Also absent: cancelled, for the same reason.
   ------------------------------------------------------------------ */
export function derivedStatus(booking, now = new Date()) {
  const status = booking?.status;
  if (status !== "booked" && status !== "in-use") return status;

  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);

  if (now >= end) return "completed";
  if (now >= start) return "in-use";
  return status;
}

export function needsStatusAdvance(booking, now = new Date()) {
  const next = derivedStatus(booking, now);
  return next !== booking?.status ? next : null;
}

/* The true length of a booking, in minutes.

   The bookings table still carries `numHours` from the original hotel
   schema, and it is a ROUNDED WHOLE NUMBER — a 30-minute booking stores
   1, and so does a 90-minute one. This space sells 15-minute blocks, so
   every screen that printed "{numHours} hours" was lying about roughly
   half of them. Prefer duration_minutes, fall back to the timestamps,
   and only fall back to numHours if a very old row has neither.
 */
export function bookingMinutes(booking) {
  const stored = Number(booking?.duration_minutes);
  if (Number.isFinite(stored) && stored > 0) return stored;

  const start = new Date(booking?.startTime);
  const end = new Date(booking?.endTime);
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    const minutes = Math.round((end - start) / MINUTE_MS);
    if (minutes > 0) return minutes;
  }

  return (Number(booking?.numHours) || 0) * 60;
}
