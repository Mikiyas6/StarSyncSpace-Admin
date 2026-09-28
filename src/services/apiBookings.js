import { getToday } from "../utils/helpers";
import supabase from "./supabase";
import { PAGE_SIZE } from "../utils/constants";
import {
  MINUTE_MS,
  needsStatusAdvance,
  validateAdminBooking,
} from "../utils/booking";
import {
  passWindow,
  seatsTakenAcrossRange,
  validateSeatBooking,
} from "../utils/spaces";

export async function getBookings(filter, sortBy, page) {
  let query = supabase
    .from("bookings")
    .select("*, rooms(name), guests(fullName, email)", { count: "exact" });

  // Filter
  if (filter) {
    query = query[filter.method || "eq"](filter.field, filter.value);
  }

  // Sort
  if (sortBy) {
    query = query.order(sortBy.field, {
      ascending: sortBy.direction === "asc",
    });
  }

  //Pagination
  if (page) {
    const from = (page - 1) * PAGE_SIZE;
    const to = page * PAGE_SIZE;
    query = query.range(from, to);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error loading bookings:", error);
    throw new Error("Bookings could not be loaded");
  }

  return { data, count };
}

export async function getBooking(id) {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, rooms(*), guests(*)")
    .eq("id", id)
    .single();

  if (error) {
    console.error(error);
    throw new Error("Booking not found");
  }

  return data;
}

// Returns all BOOKINGS that are were created after the given date. Useful to get bookings created in the last 30 days, for example.
export async function getBookingsAfterDate(
  date,
  endDate = getToday({ end: true })
) {
  const { data, error } = await supabase
    .from("bookings")
    .select("created_at, totalPrice, extrasPrice")
    .gte("created_at", date)
    .lte("created_at", endDate);

  if (error) {
    console.error(error);
    throw new Error("Bookings could not get loaded");
  }

  return data;
}

// Returns all BOOKINGS that start after the given date
export async function getStaysAfterDate(date, endDate = getToday()) {
  const { data, error } = await supabase
    .from("bookings")
    // .select('*')
    .select("*, guests(fullName)")
    .gte("startTime", date)
    .lte("startTime", endDate);

  if (error) {
    console.error(error);
    throw new Error("Bookings could not get loaded");
  }

  return data;
}

// Activity means that there is a booking starting or ending today
export async function getStaysTodayActivity() {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, guests(fullName)")
    /* Both halves need a lower bound. Without `startTime.gte.<today 00:00>`
       the "arriving" half matched EVERY booking still sitting in `booked`
       from any day in the past, so an old unattended booking stayed pinned
       to Today's activity forever and the list only ever grew. */
    .or(
      `and(status.eq.booked,startTime.gte.${getToday()},startTime.lte.${getToday({
        end: true,
      })}),and(status.eq.in-use,endTime.gte.${getToday()})`
    )
    .order("created_at");

  if (error) {
    console.error(error);
    throw new Error("Bookings could not get loaded");
  }
  return data;
}

export async function getEndingSoonBookings() {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 45 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("bookings")
    .select("*, rooms(name), guests(fullName)")
    .or("status.eq.booked,status.eq.in-use")
    .gte("endTime", windowStart)
    .lte("endTime", windowEnd)
    .order("endTime");

  if (error) {
    console.error(error);
    throw new Error("Bookings could not get loaded");
  }
  return data;
}

// Bookings that are still active and will end within the next hour. Used by the
// admin notification system to warn when a client has 10 minutes left to leave.
export async function getActiveBookingsEndingSoon(windowMinutes = 60) {
  const now = new Date();
  // Coerced deliberately: this is a queryFn, and React Query hands a
  // context object to anything passed to it bare. A non-number here used
  // to produce NaN and a thrown RangeError instead of a sane window.
  const minutes = Number(windowMinutes) > 0 ? Number(windowMinutes) : 60;
  const windowEnd = new Date(now.getTime() + minutes * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("bookings")
    .select("*, rooms(name), guests(fullName)")
    .or("status.eq.booked,status.eq.in-use")
    .gte("endTime", now.toISOString())
    .lte("endTime", windowEnd)
    .order("endTime");

  if (error) {
    console.error(error);
    throw new Error("Bookings could not get loaded");
  }
  return data;
}

export async function updateBooking(id, obj) {
  const { data, error } = await supabase
    .from("bookings")
    .update(obj)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw new Error("Booking could not be updated");
  }
  return data;
}

export async function deleteBookingApi(id) {
  // REMEMBER RLS POLICIES
  const { data, error } = await supabase.from("bookings").delete().eq("id", id);

  if (error) {
    console.error(error);
    throw new Error("Booking could not be deleted");
  }
  return data;
}

/* ------------------------------------------------------------------
   Everything a booking taken at the front desk needs.
   ------------------------------------------------------------------ */

// Every booking for one room that could possibly clash with a new one.
// Scoped to a window around the proposed slot rather than "all bookings
// ever", but deliberately generous at both ends: a booking that started
// two days ago can still be running (a 24-hour booking crossing a day
// boundary is exactly the case the old logic got wrong), so the window
// looks back far enough to catch it.
export async function getRoomBookingsAround(roomId, start, end) {
  const from = new Date(new Date(start).getTime() - 3 * 24 * 60 * MINUTE_MS);
  const to = new Date(new Date(end).getTime() + 3 * 24 * 60 * MINUTE_MS);

  const { data, error } = await supabase
    .from("bookings")
    .select("id, startTime, endTime, status, guestId")
    .eq("roomId", roomId)
    .gte("startTime", from.toISOString())
    .lte("startTime", to.toISOString())
    .order("startTime");

  if (error) {
    console.error("[getRoomBookingsAround]", error);
    throw new Error("Existing bookings could not be checked");
  }
  return data ?? [];
}

/* Create a booking on behalf of someone standing at the desk.

   Differs from the public site's createBooking in exactly two ways, both
   intentional (see utils/booking.js): there is no one-hour lead time, so
   "starting now" works; and the desk decides the status and whether the
   money has been taken, instead of a payment provider deciding for it.

   Everything protective is kept: the slot is re-checked against the
   database immediately before the insert, so two admins on two laptops
   cannot both sell the same room. */
export async function createBookingApi({
  roomId,
  guestId,
  room,
  settings,
  start,
  end,
  durationMinutes,
  observations = "",
  numGuests = 1,
  isPaid = false,
  status = "booked",
}) {
  if (!roomId) throw new Error("Pick a room");
  if (!guestId) throw new Error("Pick or create a guest");

  /* The desk sends a start and an end. A length is still accepted for
     callers that hold one, and the validator settles which wins — this
     only needs SOME end to know which day's bookings to read. */
  const endsAt =
    end instanceof Date && !Number.isNaN(end.getTime())
      ? end
      : new Date(new Date(start).getTime() + durationMinutes * MINUTE_MS);

  const existing = await getRoomBookingsAround(roomId, start, endsAt);

  const { error: invalid, value } = validateAdminBooking({
    start,
    end,
    durationMinutes,
    room,
    settings,
    existingBookings: existing,
  });
  if (invalid) throw new Error(invalid);

  const newBooking = {
    roomId,
    guestId,
    startTime: value.start.toISOString(),
    endTime: value.end.toISOString(),
    duration_minutes: value.durationMinutes,
    numHours: value.numHours,
    numGuests,
    observations: String(observations ?? "").slice(0, 1000),
    cabinPrice: value.usd,
    extrasPrice: 0,
    totalPrice: value.usd,
    amount_rwf: value.rwf,
    isPaid,
    status,
  };

  const { data, error } = await supabase
    .from("bookings")
    .insert([newBooking])
    .select("*, rooms(name), guests(fullName, email)")
    .single();

  if (error) {
    console.error("[createBookingApi]", error, "payload:", newBooking);
    // 23P01 is an exclusion-constraint violation: the database's own
    // no-double-booking guarantee, which beats us to it under a race.
    if (error.code === "23P01")
      throw new Error("That slot was just taken — pick another time");
    throw new Error(
      `Booking could not be created (${error.message ?? "unknown error"})`,
    );
  }

  return data;
}

/* The manual half of the status lifecycle.

   cancel and no-show are the two statuses nothing in the system will
   ever set on its own, because both are statements about what a person
   did, not about what the clock did. This is the only writer for them.
   The guards are here rather than in the UI so that a stale page cannot
   complete a cancelled booking. */
export async function setBookingStatus(id, status) {
  const current = await getBooking(id);

  if (current.status === status) return current;

  if (status === "cancelled" && current.status === "completed")
    throw new Error("A completed booking cannot be cancelled");

  if (status === "no-show" && new Date(current.startTime) > new Date())
    throw new Error("This booking has not started yet");

  // Deliberately NOT blocked from "completed": that status is normally
  // written by the clock, not by anyone who watched the room. The desk
  // correcting it to a no-show afterwards is the whole point.
  if (status === "no-show" && current.status === "cancelled")
    throw new Error("A cancelled booking cannot be marked a no-show");

  return updateBooking(id, { status });
}

export async function setBookingPaid(id, isPaid) {
  return updateBooking(id, { isPaid });
}

/* ------------------------------------------------------------------
   The automatic half of the status lifecycle.

   Nothing ever moved a booking along on its own: a booking sat in
   `booked` through its own session and for every day after it, so the
   room read as free while someone was sitting in it, the dashboard
   counted stays that had finished last month as upcoming, and Today's
   activity filled with fossils. Marking "in use" and "completed" was
   entirely manual, and anything the desk forgot stayed wrong forever.

   This runs on every load of the bookings list and the dashboard. It is
   cheap (one narrow read, then at most two writes) and idempotent, so
   running it from several places at once is harmless.

   It only ever moves a booking FORWARD along the timeline it was sold
   with. It never invents a cancellation or a no-show — see
   derivedStatus() for why those stay with the desk.
   ------------------------------------------------------------------ */
export async function reconcileBookingStatuses(now = new Date()) {
  const nowIso = now.toISOString();

  const { data, error } = await supabase
    .from("bookings")
    .select("id, startTime, endTime, status")
    .in("status", ["booked", "in-use"])
    .lte("startTime", nowIso);

  if (error) {
    // Never let housekeeping break the page that triggered it.
    console.error("[reconcileBookingStatuses]", error);
    return { updated: 0 };
  }

  const moves = new Map();
  for (const booking of data ?? []) {
    const next = needsStatusAdvance(booking, now);
    if (!next) continue;
    moves.set(next, [...(moves.get(next) ?? []), booking.id]);
  }

  let updated = 0;
  for (const [status, ids] of moves) {
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status })
      .in("id", ids);

    if (updateError) console.error("[reconcileBookingStatuses]", updateError);
    else updated += ids.length;
  }

  return { updated };
}

/* ------------------------------------------------------------------
   Bookings, for the revenue screens.

   Distinct from getBookingsAfterDate() above, which selects only
   created_at, totalPrice and extrasPrice — enough for a single "sales"
   line and nothing else. Splitting the takings by room and by KIND of
   room needs four more things:

     roomId + rooms(name, room_type)  which room, and which business it
                                      belongs to — meeting room or
                                      shared space
     amount_rwf                       what was actually CHARGED, frozen
                                      at payment. The revenue module
                                      prefers this over converting
                                      totalPrice, so that last month's
                                      figures do not move when the
                                      exchange rate does
     status + isPaid                   whether this is money at all: a
                                      pending payment is not, and a
                                      paid-then-cancelled booking is,
                                      because the terms are
                                      non-refundable

   `rooms` is a join rather than a second query so that a room renamed
   since a booking was taken still reports under its current name, and so
   that one round trip answers the whole screen.
   ------------------------------------------------------------------ */
export async function getRevenueBookings(
  from,
  to = getToday({ end: true }),
) {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `id, created_at, startTime, endTime, status, isPaid,
       totalPrice, extrasPrice, amount_rwf, seats, pass_type, "roomId",
       rooms ( id, name, room_type )`,
    )
    .gte("created_at", from)
    .lte("created_at", to)
    .order("created_at");

  if (error) {
    /* 42703 is "column does not exist": seats/pass_type arrive with the
       shared-spaces migration, and room_type with it. Rather than taking
       the whole dashboard down before it has been run, fall back to the
       columns that have always been there — the revenue module already
       treats an untyped room as a meeting room, which is exactly what
       every booking in the table is until shared spaces exist. */
    if (error.code === "42703") {
      const { data: legacy, error: legacyError } = await supabase
        .from("bookings")
        .select(
          `id, created_at, startTime, endTime, status, isPaid,
           totalPrice, extrasPrice, amount_rwf, "roomId",
           rooms ( id, name )`,
        )
        .gte("created_at", from)
        .lte("created_at", to)
        .order("created_at");

      if (legacyError) {
        console.error(legacyError);
        throw new Error("Bookings could not get loaded");
      }
      return legacy ?? [];
    }

    console.error(error);
    throw new Error("Bookings could not get loaded");
  }

  return data ?? [];
}

/* ------------------------------------------------------------------
   Selling a desk at the front counter.

   The shared-space counterpart to createBookingApi above, and separate
   from it for the same reason the two forms are separate: almost none of
   a meeting room's rules apply. There is no turnaround gap, no opening-
   hours gate, no length in minutes — and crucially, no overlap check,
   because overlapping is the product. Twenty people are meant to hold
   desks at once; the only invalid state is the twenty-first.

   What replaces all of it is one question — are there enough seats free
   on every day of the range — answered by validateSeatBooking, which is
   the same function the form prices and draws "14 of 20 left" from, and
   which the database's own seat trigger independently agrees with.

   The desk's one liberty over the public site: allowToday. A walk-in at
   two in the afternoon wants a desk for the rest of today.
   ------------------------------------------------------------------ */

// Every booking that could compete for a seat in this room over a range.
// Deliberately not windowed the way getRoomBookingsAround is: a monthly
// pass bought five weeks ago is still holding its desk today, so a window
// measured in days would miss exactly the bookings that matter most.
export async function getRoomSeatBookings(roomId) {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, startTime, endTime, status, seats")
    .eq("roomId", roomId)
    .not("status", "in", "(cancelled,no-show,failed)")
    .order("startTime");

  if (error) {
    console.error("[getRoomSeatBookings]", error);
    throw new Error("Existing desk bookings could not be checked");
  }
  return data ?? [];
}

export async function createSeatBookingApi({
  roomId,
  guestId,
  room,
  startDate,
  passType,
  units = 1,
  /* Hourly only: the length in minutes. Ignored for a day or month pass,
     whose length comes from `units`. */
  minutes,
  seats = 1,
  rwfPerUsd,
  observations = "",
  isPaid = false,
  status = "booked",
}) {
  if (!roomId) throw new Error("Pick a space");
  if (!guestId) throw new Error("Pick or create a guest");

  // Re-read immediately before writing, so two desks cannot both sell the
  // last seat between a render and a submit.
  const existing = await getRoomSeatBookings(roomId);

  const window = passWindow({ startDate, passType, units, minutes });
  if (!window) throw new Error("Pick a valid start date");

  const seatsTaken = seatsTakenAcrossRange(
    room,
    existing,
    window.start,
    window.end,
  );

  const { error: invalid, value } = validateSeatBooking({
    room,
    seats,
    passType,
    startDate,
    units,
    minutes,
    seatsTaken,
    rate: rwfPerUsd,
    // The whole point of this form: somebody is standing here now.
    allowToday: true,
  });
  if (invalid) throw new Error(invalid);

  const newBooking = {
    roomId,
    guestId,
    startTime: value.start.toISOString(),
    endTime: value.end.toISOString(),
    duration_minutes: value.durationMinutes,
    numHours: Math.max(1, Math.round(value.durationMinutes / 60)),
    /* numGuests is "how many people are coming", seats is "how much of
       the room's capacity was bought". For a desk pass they are the same
       number; both are written so neither silently reads as 1. */
    numGuests: value.seats,
    seats: value.seats,
    pass_type: value.passType,
    observations: String(observations ?? "").slice(0, 1000),
    cabinPrice: value.usd,
    extrasPrice: 0,
    totalPrice: value.usd,
    /* Frozen at the moment of sale. This is what the customer paid, and
       it must never be re-derived from a later exchange rate — see the
       note at the top of utils/fx.js. */
    amount_rwf: value.rwf,
    isPaid,
    status,
  };

  const { data, error } = await supabase
    .from("bookings")
    .insert([newBooking])
    .select("*, rooms(name), guests(fullName, email)")
    .single();

  if (error) {
    console.error("[createSeatBookingApi]", error, "payload:", newBooking);
    /* 23514 is the seat-capacity trigger, whose own message already names
       the room and both counts ("Only 2 of 20 seats are free in Shared
       Space 01 ... 4 requested") — better than anything written here. */
    if (error.code === "23514") throw new Error(error.message);
    if (error.code === "42703")
      throw new Error(
        "Desk bookings need the shared-spaces migration. Run supabase/01-shared-spaces.sql and 02-seat-limit.sql, then reload.",
      );
    /* 23P01 is no_overlapping_bookings — the rule that one meeting room
       cannot be let twice over the same hours. Reaching it on a DESK
       means the constraint has not been narrowed to whole-room bookings
       yet, and a shared space is being held to a rule that contradicts
       what it sells. Nothing about this sale is wrong, so it must not
       read as "those dates are taken". */
    if (error.code === "23P01")
      throw new Error(
        "This space is still under the old one-booking-at-a-time rule, so a second desk cannot be sold over the same hours. Run supabase/08-shared-space-overlap.sql, then try again.",
      );
    throw new Error(
      `The desk booking could not be created (${error.message ?? "unknown error"})`,
    );
  }

  return data;
}

/* ------------------------------------------------------------------
   Every booking that touches a window, across every room.

   The one query behind the availability search. Deliberately NOT
   getRoomBookingsAround() called once per room: the desk asks "what is
   free at four" about the whole building at once, and eight or forty
   round trips per keystroke is a different kind of application.

   FILTERED ON BOTH ENDS, which the per-room reader above cannot be. It
   windows on startTime alone and then pads the window by three days at
   each end to catch a long booking that began before it — a workaround
   for not being able to say "overlaps". Here the half-open overlap test
   is expressible directly: a booking touches [from, to) when it starts
   before `to` and ends after `from`. That catches a 24-hour meeting room
   booking, and a monthly desk bought five weeks ago, without reading a
   day of bookings either side and without a padding constant that has to
   be guessed at.

   `guests(fullName)` rides along because a busy room is half an answer:
   the desk wants to know who has it, so it can ask whether they are
   nearly done.
   ------------------------------------------------------------------ */
export async function getBookingsInRange(from, to) {
  const fromIso = new Date(from).toISOString();
  const toIso = new Date(to).toISOString();

  const columns = `id, "roomId", startTime, endTime, status, seats, pass_type,
       numGuests, guests ( fullName )`;

  const run = (select) =>
    supabase
      .from("bookings")
      .select(select)
      .lt("startTime", toIso)
      .gt("endTime", fromIso)
      .order("startTime");

  let { data, error } = await run(columns);

  /* 42703 is "column does not exist": seats and pass_type arrive with the
     shared-spaces migration. Falling back keeps the search working on a
     database that has not had it run yet — every booking there is a
     whole-room booking, and seatsTakenOverWindow() already treats a
     missing `seats` as one. */
  if (error?.code === "42703") {
    ({ data, error } = await run(
      `id, "roomId", startTime, endTime, status, numGuests, guests ( fullName )`,
    ));
  }

  if (error) {
    console.error("[getBookingsInRange]", error);
    throw new Error("Availability could not be checked");
  }
  return data ?? [];
}
