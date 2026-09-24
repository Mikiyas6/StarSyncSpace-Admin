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

export const MINUTE_MS = 60 * 1000;
export const FULL_DAY_MINUTES = 24 * 60;
export const SLOT_STEP_MINUTES = 15;
export const DEFAULT_BUFFER_MINUTES = 15;

// Kept in sync with RWF_PER_USD in the client's availability.js.
export const RWF_PER_USD = 1470.59;

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
    holdsRoom: true,
    help: "The session finished. Set automatically at the end time, or early by the desk.",
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

// rooms.regularPrice is the room's HOURLY rate in USD, as the admin types
// it. Every total is per-minute, so this is the one place it is divided.
export function usdPerMinuteFromRoom(room) {
  const hourly = Number(room?.regularPrice);
  return hourly > 0 ? hourly / 60 : 0;
}

export function priceForMinutes(minutes, usdPerMinute) {
  const rate = Number(usdPerMinute) || 0;
  const usd = Math.round(rate * minutes * 100) / 100;
  return { usd, rwf: Math.round(usd * RWF_PER_USD) };
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

/* ------------------------------------------------------------------
   One validator for a booking the desk is about to write.

   Returns { error } or { value }. Deliberately NOT applying the public
   site's one-hour lead time: the point of this form is the person who
   just walked in and wants the room now. What it does keep is every
   rule that protects the room itself — no double-booking, no eating
   into the turnaround window, no zero-length or absurd durations.
   ------------------------------------------------------------------ */
export function validateAdminBooking({
  start,
  durationMinutes,
  room,
  settings = {},
  existingBookings = [],
  ignoreBookingId = null,
  now = new Date(),
}) {
  if (!room) return { error: "Pick a room" };
  if (!(start instanceof Date) || Number.isNaN(start.getTime()))
    return { error: "Pick a valid start date and time" };

  const minutes = Number(durationMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0)
    return { error: "Pick how long the booking runs for" };

  const minMinutes = Number(settings.min_booking_duration_minutes) || 15;
  const maxMinutes =
    Number(settings.max_booking_duration_minutes) || FULL_DAY_MINUTES;
  if (minutes < minMinutes)
    return { error: `Bookings must be at least ${minMinutes} minutes long` };
  if (minutes > maxMinutes)
    return { error: `Bookings cannot exceed ${maxMinutes} minutes` };

  const end = new Date(start.getTime() + minutes * MINUTE_MS);

  if (!fitsBusinessHours(start, end, settings))
    return {
      error: `That runs outside opening hours (${
        settings.business_hours_start ?? "00:00"
      }–${settings.business_hours_end ?? "23:59"})`,
    };

  const gapMinutes =
    Number(settings.booking_buffer_minutes) || DEFAULT_BUFFER_MINUTES;
  if (
    conflictsWithBookings(start, end, existingBookings, gapMinutes, ignoreBookingId)
  )
    return {
      error: `That clashes with another booking for this room (rooms need ${gapMinutes} minutes to turn around between bookings)`,
    };

  const usdPerMinute = usdPerMinuteFromRoom(room);
  const { usd, rwf } = priceForMinutes(minutes, usdPerMinute);

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
