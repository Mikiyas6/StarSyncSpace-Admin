import { getToday } from "../utils/helpers";
import supabase from "./supabase";
import { PAGE_SIZE } from "../utils/constants";
import {
  MINUTE_MS,
  needsStatusAdvance,
  validateAdminBooking,
} from "../utils/booking";

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
  durationMinutes,
  observations = "",
  numGuests = 1,
  isPaid = false,
  status = "booked",
}) {
  if (!roomId) throw new Error("Pick a room");
  if (!guestId) throw new Error("Pick or create a guest");

  const existing = await getRoomBookingsAround(
    roomId,
    start,
    new Date(new Date(start).getTime() + durationMinutes * MINUTE_MS),
  );

  const { error: invalid, value } = validateAdminBooking({
    start,
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
