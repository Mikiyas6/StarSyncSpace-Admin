import { getToday } from "../utils/helpers";
import supabase from "./supabase";
import { PAGE_SIZE } from "../utils/constants";

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
    .or(
      `and(status.eq.booked,startTime.lte.${getToday({
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
