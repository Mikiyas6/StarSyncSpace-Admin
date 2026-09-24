import supabase from "./supabase";

/* Guests the desk can attach a booking to.

   Someone walking in has usually never signed in with Google, so they
   have no guests row. The desk creates one for them here — the same
   table the public site's NextAuth callback writes to, so if that person
   later signs in with the same email they land on their own history
   rather than a duplicate. That is what makes findOrCreateGuest match on
   email first. */

export async function searchGuests(term) {
  const query = String(term ?? "").trim();

  let request = supabase
    .from("guests")
    .select("id, fullName, email")
    .order("fullName")
    .limit(20);

  if (query) {
    // `or` takes a comma-separated filter list; a comma inside the search
    // term itself would be read as a filter separator, so strip it.
    const safe = query.replaceAll(",", " ");
    request = request.or(`fullName.ilike.%${safe}%,email.ilike.%${safe}%`);
  }

  const { data, error } = await request;

  if (error) {
    console.error("[searchGuests]", error);
    throw new Error("Guests could not be loaded");
  }
  return data ?? [];
}

export async function getGuest(id) {
  const { data, error } = await supabase
    .from("guests")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[getGuest]", error);
    throw new Error("Guest not found");
  }
  return data;
}

/* Note the columns this writes. The guests table is (id, created_at,
   fullName, email) and nothing else — no nationality, no countryFlag,
   whatever the seed data in data/data-guests.js still suggests. Writing
   a column PostgREST does not know about fails the whole insert, so
   this deliberately writes only the two fields that exist. */
export async function findOrCreateGuest({ fullName, email }) {
  const name = String(fullName ?? "").trim();
  const address = String(email ?? "").trim().toLowerCase();

  if (!name) throw new Error("A guest name is required");
  if (!address) throw new Error("A guest email is required");

  const { data: existing, error: lookupError } = await supabase
    .from("guests")
    .select("*")
    .ilike("email", address)
    .maybeSingle();

  if (lookupError) {
    console.error("[findOrCreateGuest] lookup", lookupError);
    throw new Error("Guest could not be looked up");
  }
  if (existing) return existing;

  const { data, error } = await supabase
    .from("guests")
    .insert([{ fullName: name, email: address }])
    .select()
    .single();

  if (error) {
    console.error("[findOrCreateGuest] insert", error.message, error);
    // 23505 is the unique-email constraint: two desks adding the same
    // walk-in at once. The row the other one won is the right answer.
    if (error.code === "23505") {
      const { data: raced } = await supabase
        .from("guests")
        .select("*")
        .ilike("email", address)
        .maybeSingle();
      if (raced) return raced;
    }
    throw new Error(`Guest could not be created (${error.message})`);
  }
  return data;
}
