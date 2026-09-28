/* ------------------------------------------------------------------
   "Is anything free at four?"

   The one question the front desk asks all day, and the one thing the
   rooms list could not answer. It showed what every room IS — its photo,
   its capacity, its rate — and nothing about whether anybody could walk
   into it this afternoon. Answering meant opening the booking form,
   picking a room, reading the clash message, changing the room, and
   repeating that eight times with a guest standing there waiting.

   This file is the arithmetic behind asking it once, for every room at
   the same time. It is pure on purpose: it takes a room, the bookings
   already in the book, and a window, and hands back a verdict. No
   fetching, no React, so the awkward cases — a booking that runs over
   midnight, a monthly desk bought five weeks ago, the turnaround gap
   between two meetings — can be pinned down in tests instead of being
   argued about over a screenshot.

   IT DECIDES NOTHING. Every verdict here is the same judgement the
   booking form and the database already make, read from the same two
   modules they read it from:

     utils/booking.js   a meeting room is let WHOLE. One booking holds
                        it, plus a turnaround gap afterwards, and no
                        second booking may touch that span.
     utils/spaces.js    a shared space is let by the SEAT. Overlapping is
                        the product; the only invalid state is the seat
                        after the last one.

   So a room this file calls free is a room the form will accept, and a
   room it calls busy is one the form would have refused. If the two ever
   disagree, this file is the one that is wrong.
   ------------------------------------------------------------------ */

import { addDays, addMinutes, startOfDay } from "date-fns";

import {
  DEFAULT_BUFFER_MINUTES,
  MINUTE_MS,
  SLOT_STEP_MINUTES,
  blockedUntil,
  fitsBusinessHours,
  isBlockingBooking,
  overlaps,
  roundUpToStep,
} from "../../utils/booking";
import {
  isSharedSpace,
  peakSeatsTaken,
  seatCapacity,
  seatPressure,
} from "../../utils/spaces";

/* ---------------------------- vocabulary -------------------------- */

/* Which kinds of space the search is asking about. Deliberately its own
   short vocabulary rather than ROOM_TYPES: "all" is a real answer here
   and is not a room type, and these three values end up in the URL, so
   they are short words rather than database enums. */
export const KINDS = {
  ALL: "all",
  MEETING: "meeting",
  SHARED: "shared",
};

export function matchesKind(room, kind) {
  if (kind === KINDS.MEETING) return !isSharedSpace(room);
  if (kind === KINDS.SHARED) return isSharedSpace(room);
  return true;
}

/* Every verdict a room can come back with, in one place, with the colour
   and the wording it is shown in — the same arrangement BOOKING_STATUSES
   uses, and for the same reason: a new verdict should be one edit, not
   three components guessing at a tag colour.

   `sellable` is what the board sorts and filters on. It is not the same
   as "free": a space with two desks left when four were asked for is not
   sellable for THIS request, but it is not full either, and telling the
   desk which of those two it is saves a phone call. */
export const VERDICTS = {
  free: {
    label: "Free",
    tag: "green",
    sellable: true,
    rank: 0,
  },
  tight: {
    label: "Filling up",
    tag: "yellow",
    sellable: true,
    rank: 1,
  },
  short: {
    label: "Not enough desks",
    tag: "coral",
    sellable: false,
    rank: 2,
  },
  busy: {
    label: "Booked",
    tag: "coral",
    sellable: false,
    rank: 3,
  },
  full: {
    label: "Fully booked",
    tag: "red",
    sellable: false,
    rank: 4,
  },
  closed: {
    label: "Outside opening hours",
    tag: "silver",
    sellable: false,
    rank: 5,
  },
  "too-small": {
    label: "Too small",
    tag: "silver",
    sellable: false,
    rank: 6,
  },
  /* Nothing was asked yet, or half of it was. A search with one end of
     its window missing is a normal state on the way to a whole one, so it
     gets a verdict of its own rather than being reported as a refusal. */
  unknown: {
    label: "—",
    tag: "silver",
    sellable: false,
    rank: 7,
  },
};

export function verdictMeta(verdict) {
  return VERDICTS[verdict] ?? VERDICTS.busy;
}

/* The turnaround window, read from settings with the same fallback the
   validator uses. One reader, so a settings row that has never been
   saved cannot make the board and the form disagree by 15 minutes. */
export function gapFor(settings) {
  return Number(settings?.booking_buffer_minutes) || DEFAULT_BUFFER_MINUTES;
}

/* ------------------------- grouping the book ---------------------- */

/* One pass over every booking in the window, split by room.

   The board asks its question of every room at once, so the bookings are
   fetched once for all of them and indexed here rather than filtered per
   room inside a render — which is the difference between one pass and one
   pass per room per keystroke.

   Keyed by String(roomId) because a room's id arrives as a number from
   the rooms table and as whatever PostgREST felt like from the join. */
export function bookingsByRoom(bookings) {
  const index = new Map();
  for (const booking of bookings ?? []) {
    if (!isBlockingBooking(booking)) continue;
    const key = String(booking.roomId ?? booking.room_id ?? "");
    if (!key) continue;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(booking);
  }
  return index;
}

/* ------------------------- the verdict itself --------------------- */

/* What is holding this meeting room over the window, if anything.

   The same overlap test conflictsWithBookings() uses — including the
   turnaround tail, so a room whose previous session ends at 15:00 is not
   offered at 15:05 — but it returns the clashing bookings rather than a
   boolean, because "busy" without "until when" is the answer that sends
   somebody back to the bookings list. */
export function clashesFor(bookings, start, end, gapMinutes) {
  return (bookings ?? [])
    .filter(isBlockingBooking)
    .filter((booking) =>
      overlaps(
        new Date(booking.startTime),
        blockedUntil(booking, gapMinutes),
        start,
        end,
      ),
    )
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
}

/* Can this room take the request at all, whatever the clock says?

   Split out from the verdict because it is the one refusal that no change
   of time can fix, and because it means two different things either side
   of the room type: a meeting room seats a party, a shared space sells
   that party one desk each. */
function holdsParty(room, people) {
  const wanted = Math.max(1, Math.floor(Number(people) || 1));
  const capacity = isSharedSpace(room)
    ? seatCapacity(room)
    : Math.floor(Number(room?.maxCapacity) || 0);
  return { wanted, capacity, fits: capacity >= wanted };
}

/* One room, one window, one answer.

   Shape:
     verdict      a key of VERDICTS
     isSellable   whether this request could be written right now
     seats        { capacity, taken, left } for a shared space, else null
     clashes      the bookings in the way, for a meeting room, else []
     freeFrom     the next start on the 15-minute grid where a window of
                  the SAME LENGTH would be free, or null if nothing in
                  the horizon is. Null also when the room is already
                  free — there is nothing to suggest.
     note         one sentence of detail, or null. Never the whole
                  verdict, which the tag already carries.
 */
export function roomAvailability({
  room,
  bookings = [],
  start,
  end,
  people = 1,
  settings = {},
  horizonHours = 48,
}) {
  const party = holdsParty(room, people);
  const gapMinutes = gapFor(settings);
  const shared = isSharedSpace(room);

  const base = {
    room,
    kind: shared ? "shared" : "meeting",
    wanted: party.wanted,
    capacity: party.capacity,
    clashes: [],
    seats: null,
    freeFrom: null,
    note: null,
  };

  if (!(start instanceof Date) || !(end instanceof Date) || !(end > start))
    return { ...base, verdict: "unknown", isSellable: false };

  if (!party.fits)
    return {
      ...base,
      verdict: "too-small",
      isSellable: false,
      note: shared
        ? `Only ${party.capacity} desks in total`
        : `Seats ${party.capacity}, ${party.wanted} asked for`,
    };

  if (shared) {
    /* Seats are counted at the busiest INSTANT of the window, not
       averaged over it and not totalled across it — peakSeatsTaken is
       the same sweep the desk form prices from and the database's seat
       trigger agrees with. */
    const capacity = seatCapacity(room);
    const taken = peakSeatsTaken(bookings, start, end);
    const left = Math.max(0, capacity - taken);
    const seats = { capacity, taken, left };

    /* Opening hours are deliberately NOT applied to a desk. The seat
       validator does not apply them either — a monthly desk holder is not
       turned out at six — so applying them here would refuse sales the
       form would happily take. */
    if (left === 0)
      return {
        ...base,
        seats,
        verdict: "full",
        isSellable: false,
        freeFrom: nextFreeStart({
          room,
          bookings,
          start,
          end,
          people: party.wanted,
          settings,
          horizonHours,
        }),
        note: `All ${capacity} desks held`,
      };

    if (left < party.wanted)
      return {
        ...base,
        seats,
        verdict: "short",
        isSellable: false,
        freeFrom: nextFreeStart({
          room,
          bookings,
          start,
          end,
          people: party.wanted,
          settings,
          horizonHours,
        }),
        note: `${left} of ${capacity} free, ${party.wanted} asked for`,
      };

    return {
      ...base,
      seats,
      verdict: seatPressure(room, taken) === "low" ? "tight" : "free",
      isSellable: true,
      note: `${left} of ${capacity} desks free`,
    };
  }

  /* A meeting room: whole, or not at all. */
  if (!fitsBusinessHours(start, end, settings))
    return {
      ...base,
      verdict: "closed",
      isSellable: false,
      note: `Opens ${settings.business_hours_start ?? "00:00"}–${
        settings.business_hours_end ?? "23:59"
      }`,
    };

  const clashes = clashesFor(bookings, start, end, gapMinutes);
  if (clashes.length)
    return {
      ...base,
      clashes,
      verdict: "busy",
      isSellable: false,
      freeFrom: nextFreeStart({
        room,
        bookings,
        start,
        end,
        people: party.wanted,
        settings,
        horizonHours,
      }),
      note:
        clashes.length === 1
          ? "One booking in the way"
          : `${clashes.length} bookings in the way`,
    };

  return { ...base, verdict: "free", isSellable: true, note: null };
}

/* ------------------------- "free from when?" ---------------------- */

/* The next moment a window of the same length would fit.

   This is the single most useful thing the board says, and the reason it
   is worth computing rather than leaving the desk to guess: "booked" ends
   a conversation, "free from 16:15" continues it.

   Walked on the same 15-minute grid the public slot picker and the desk
   form's quick lengths use, so every answer it gives is a time somebody
   can actually type back into the booking form. The scan is seeded past
   whatever is in the way — the end of the last clashing booking's
   turnaround, for a room — so the common case settles in one or two
   steps rather than crawling the grid from now.

   Bounded by a horizon rather than run to exhaustion: past a couple of
   days "free from" stops being an answer to a walk-in, and null reads
   honestly as "not in the next two days".
 */
export function nextFreeStart({
  room,
  bookings = [],
  start,
  end,
  people = 1,
  settings = {},
  horizonHours = 48,
}) {
  const minutes = Math.round((end - start) / MINUTE_MS);
  if (!(minutes > 0)) return null;

  const gapMinutes = gapFor(settings);
  const shared = isSharedSpace(room);
  const party = holdsParty(room, people);
  if (!party.fits) return null;

  const limit = new Date(start.getTime() + horizonHours * 60 * MINUTE_MS);

  /* Seeded past the obstruction. For a room that is the moment the last
     thing in the way has finished turning around; for a space there is no
     single obstruction to skip to, so the scan starts where it stands. */
  let candidate = roundUpToStep(start, SLOT_STEP_MINUTES);
  if (!shared) {
    const clashes = clashesFor(bookings, start, end, gapMinutes);
    for (const clash of clashes) {
      const freed = blockedUntil(clash, gapMinutes);
      if (freed > candidate) candidate = roundUpToStep(freed, SLOT_STEP_MINUTES);
    }
  }
  if (candidate <= start)
    candidate = addMinutes(candidate, SLOT_STEP_MINUTES);

  while (candidate <= limit) {
    const candidateEnd = new Date(candidate.getTime() + minutes * MINUTE_MS);

    if (shared) {
      const left =
        seatCapacity(room) - peakSeatsTaken(bookings, candidate, candidateEnd);
      if (left >= party.wanted) return candidate;
      candidate = addMinutes(candidate, SLOT_STEP_MINUTES);
      continue;
    }

    const clashes = clashesFor(bookings, candidate, candidateEnd, gapMinutes);
    if (
      !clashes.length &&
      fitsBusinessHours(candidate, candidateEnd, settings)
    )
      return candidate;

    /* The step is a quarter of an hour, except that a candidate blocked
       by a booking jumps straight past it: without that, a scan through a
       fully booked afternoon walks the grid one step at a time and does
       most of its work discovering the same booking over and over. */
    let next = addMinutes(candidate, SLOT_STEP_MINUTES);
    for (const clash of clashes) {
      const freed = roundUpToStep(
        blockedUntil(clash, gapMinutes),
        SLOT_STEP_MINUTES,
      );
      if (freed > next) next = freed;
    }
    candidate = next;
  }

  return null;
}

/* --------------------------- the whole board ---------------------- */

/* Every room, answered and ordered.

   Sorted by how useful the row is rather than by name: what can be sold
   first, then what is nearly sellable, then what is out of the question —
   and inside each group by name, numerically, so 9 comes before 10. A
   desk with a guest waiting reads the top of this list and stops. */
export function availabilityBoard({
  rooms = [],
  bookings = [],
  start,
  end,
  people = 1,
  kind = KINDS.ALL,
  settings = {},
  onlyFree = false,
}) {
  const index = bookingsByRoom(bookings);

  const results = rooms
    .filter((room) => !room?.is_archived)
    .filter((room) => matchesKind(room, kind))
    .map((room) =>
      roomAvailability({
        room,
        bookings: index.get(String(room.id)) ?? [],
        start,
        end,
        people,
        settings,
      }),
    )
    .sort((a, b) => {
      const byVerdict = verdictMeta(a.verdict).rank - verdictMeta(b.verdict).rank;
      if (byVerdict !== 0) return byVerdict;
      return String(a.room.name).localeCompare(String(b.room.name), undefined, {
        numeric: true,
      });
    });

  return onlyFree ? results.filter((result) => result.isSellable) : results;
}

/* The one line at the top of the board.

   Counted from the results rather than re-derived, so the headline can
   never disagree with the rows underneath it. `desksFree` deliberately
   sums only the spaces that could take the request — desks in a space
   too small for the party are not desks anybody can sell. */
export function boardSummary(results = []) {
  let sellable = 0;
  let desksFree = 0;
  let soonest = null;

  for (const result of results) {
    if (result.isSellable) {
      sellable += 1;
      if (result.seats) desksFree += result.seats.left;
    } else if (result.freeFrom && (!soonest || result.freeFrom < soonest)) {
      soonest = result.freeFrom;
    }
  }

  return {
    total: results.length,
    sellable,
    unavailable: results.length - sellable,
    desksFree,
    /* Only meaningful when nothing is free now. A "next free" shown
       beside four available rooms reads as a warning about nothing. */
    soonest: sellable === 0 ? soonest : null,
  };
}

/* --------------------------- the day strip ------------------------ */

/* Which stretch of clock the timeline draws.

   A window inside one day is shown against that whole day, because the
   useful thing about the strip is where the request sits among the day's
   other bookings — a strip cropped to the request itself would show the
   request and nothing to compare it with. A window that crosses midnight
   (a 24-hour booking is allowed, and is exactly the case the old clash
   logic got wrong) is shown against every day it touches. */
export function timelineRange(start, end) {
  const from = startOfDay(start);
  const last = startOfDay(new Date(end.getTime() - 1));
  const days = Math.max(1, Math.round((last - from) / (24 * 60 * MINUTE_MS)) + 1);
  return { from, to: addDays(from, days), days };
}

function pctBetween(at, from, to) {
  const span = to - from;
  if (!(span > 0)) return 0;
  return ((at - from) / span) * 100;
}

function clampPct(value) {
  return Math.min(100, Math.max(0, value));
}

/* A meeting room's day, as blocks to draw.

   Each booking carries its turnaround tail as a separate width so the
   strip can shade it differently: the room is unavailable for both, but
   only one of them is somebody's session, and a desk looking at "15:00
   to 17:15" wants to know the last quarter of an hour is cleaning. */
export function occupancyBlocks(bookings, from, to, gapMinutes = DEFAULT_BUFFER_MINUTES) {
  return (bookings ?? [])
    .filter(isBlockingBooking)
    .map((booking) => {
      const bookingStart = new Date(booking.startTime);
      const bookingEnd = new Date(booking.endTime);
      const blockedEnd = blockedUntil(booking, gapMinutes);
      if (!(blockedEnd > from) || !(bookingStart < to)) return null;

      const left = clampPct(pctBetween(bookingStart, from, to));
      const bookedRight = clampPct(pctBetween(bookingEnd, from, to));
      const blockedRight = clampPct(pctBetween(blockedEnd, from, to));

      return {
        booking,
        leftPct: left,
        widthPct: Math.max(0.6, bookedRight - left),
        gapPct: Math.max(0, blockedRight - bookedRight),
        start: bookingStart,
        end: bookingEnd,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.leftPct - b.leftPct);
}

/* A shared space's day, as a heat strip.

   Blocks are the wrong shape for a space where twenty bookings overlap by
   design — they would draw twenty bars on top of each other. What matters
   is how FULL it is, so the day is sampled into equal cells and each one
   carries the fraction of the room held at its busiest instant.

   Half-hour cells by default: 48 across a day is fine enough to see a
   morning rush and coarse enough to stay legible at a few hundred pixels,
   and cheap enough — one sweep per cell over one room's bookings. */
export function seatHeatCells(room, bookings, from, to, cells = 48) {
  const capacity = seatCapacity(room);
  if (!capacity) return [];

  const count = Math.max(1, Math.floor(cells));
  const span = (to - from) / count;

  return Array.from({ length: count }, (_, index) => {
    const cellStart = new Date(from.getTime() + index * span);
    const cellEnd = new Date(from.getTime() + (index + 1) * span);
    const taken = peakSeatsTaken(bookings, cellStart, cellEnd);

    return {
      start: cellStart,
      end: cellEnd,
      taken,
      capacity,
      left: Math.max(0, capacity - taken),
      ratio: Math.min(1, taken / capacity),
      leftPct: (index / count) * 100,
      widthPct: 100 / count,
    };
  });
}

/* The same cells, with equal neighbours joined up.

   Drawn cell by cell, a day comes out faintly striped: forty-eight
   absolutely positioned boxes whose percentage widths land between
   pixels leave a hairline seam at every join, and a room that was evenly
   full all morning reads as a barcode rather than as one band. Joining
   runs of equal occupancy fixes the look and the meaning at once — the
   strip now has one box per CHANGE in how full the room is, which is
   also the only place a seam belongs — and gives each box a time range
   worth putting in its tooltip.

   Cells are still what the arithmetic produces; this is purely about
   what gets drawn. */
export function mergeHeatRuns(cells) {
  const runs = [];

  for (const cell of cells ?? []) {
    const last = runs.at(-1);
    if (last && last.taken === cell.taken) {
      last.end = cell.end;
      last.widthPct += cell.widthPct;
      continue;
    }
    runs.push({ ...cell });
  }

  return runs;
}

/* Where the request itself sits on the strip, so it can be outlined over
   whatever is already drawn there. */
export function windowMarker(start, end, from, to) {
  const left = clampPct(pctBetween(start, from, to));
  const right = clampPct(pctBetween(end, from, to));
  return { leftPct: left, widthPct: Math.max(0.8, right - left) };
}

/* The hour labels under the strip. Three-hourly for a single day, daily
   for anything longer — an axis with 48 labels on it is not an axis. */
export function timelineTicks(from, to) {
  const hours = (to - from) / (60 * MINUTE_MS);
  const stepHours = hours <= 26 ? 3 : 24;

  const ticks = [];
  for (let hour = 0; hour <= hours; hour += stepHours) {
    const at = new Date(from.getTime() + hour * 60 * MINUTE_MS);
    ticks.push({
      at,
      leftPct: clampPct(pctBetween(at, from, to)),
      label:
        stepHours === 24
          ? at.toLocaleDateString(undefined, { day: "numeric", month: "short" })
          : `${String(at.getHours()).padStart(2, "0")}:00`,
    });
  }
  return ticks;
}

/* The "now" hairline, and nothing when now is off the strip — a marker
   pinned to an edge is a marker lying about where now is. */
export function nowMarker(from, to, now = new Date()) {
  if (now < from || now > to) return null;
  return { leftPct: pctBetween(now, from, to) };
}
