/* The team: who works here, and which of the two roles they hold.

   `admins` rows are keyed by the Supabase auth user, one per login, and
   created by a trigger the moment a login is (see 05-admin-roles.sql).
   What this file does is read the team and change roles; creating the
   login itself cannot be done from a browser at all, and lives in
   apiCreateTeamMember.js with the explanation of why.

   Why there is no delete
   ----------------------
   A departed staff member's name stays attached to the bookings they
   took and the stock they moved: `bookings.created_by` and
   `stock_movements.actor_id` both reference `admins.id`. Deleting the row
   would either break those references or, worse, quietly blank the
   history of who did what. So "remove a staff member" sets is_active to
   false, which every RLS policy tests — they lose access immediately and
   keep their name on their work. The row can be reactivated if they come
   back.

   Removing their ability to SIGN IN at all is a separate matter and lives
   in the Supabase dashboard (Authentication → Users), because deleting an
   auth user needs the service-role key and this app deliberately does not
   hold one.
*/

import supabase from "./supabase";

export async function getTeam() {
  const { data, error } = await supabase
    .from("admins")
    .select("id, role, full_name, email, is_active, created_at")
    .order("created_at");

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205")
      throw new Error(
        "The team table is not set up yet. Run supabase/05-admin-roles.sql in the Supabase SQL editor, then reload.",
      );

    // A staff member reading this list gets their own row and nothing
    // else (policy admins_read_self), which is not an error — the page
    // simply is not for them, and it is gated in the UI as well.
    console.error(error);
    throw new Error("The team could not be loaded");
  }

  return data ?? [];
}

export async function setTeamMemberRole(id, role) {
  if (!["admin", "staff"].includes(role))
    throw new Error(`Unknown role: ${role}`);

  const { data, error } = await supabase
    .from("admins")
    .update({ role })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw new Error(explain(error, "This person's role could not be changed"));
  }

  return data;
}

export async function setTeamMemberActive(id, isActive) {
  const { data, error } = await supabase
    .from("admins")
    .update({ is_active: isActive })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw new Error(
      explain(
        error,
        isActive
          ? "This person could not be reactivated"
          : "This person's access could not be revoked",
      ),
    );
  }

  return data;
}

export async function updateTeamMemberName(id, fullName) {
  const { data, error } = await supabase
    .from("admins")
    .update({ full_name: fullName?.trim() || null })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw new Error(explain(error, "The name could not be saved"));
  }

  return data;
}

/* Turn a Postgres error into a sentence somebody at a desk can act on.

   Two cases are worth naming rather than reporting generically, because
   both are rules the database is enforcing on purpose and both look like
   a malfunction otherwise:

     23514  the guard_last_admin() trigger — you cannot demote or
            deactivate the only remaining admin.
     42501  row-level security refused the write, i.e. a staff member
            reached a control that is not theirs.
*/
function explain(error, fallback) {
  if (error.code === "23514" && /only active admin/i.test(error.message ?? ""))
    return "That is the only active admin. Promote somebody else first.";

  if (error.code === "42501" || /row-level security/i.test(error.message ?? ""))
    return "Only an admin can change who works here.";

  return fallback;
}
