import { useQuery } from "@tanstack/react-query";

import supabase from "../../services/supabase";
import { useUser } from "./useUser";

/* ------------------------------------------------------------------
   Which of the two roles the signed-in person holds.

   ---------------------------------------------------------------
    THIS IS NOT THE SECURITY BOUNDARY
   ---------------------------------------------------------------
   This app is a browser SPA holding a Supabase anon key. Everything it
   can do, anyone who opens the developer console can do — so hiding a
   button hides nothing, and a `canManageRooms` that returns false is a
   courtesy, not a lock.

   The lock is row-level security, in supabase/05-admin-roles.sql. A
   staff member who forced their way to the Settings page and pressed
   Save would get "new row violates row-level security policy" from the
   database, because the policy on `settings` tests is_admin() and there
   is nothing in a browser that can make that true.

   What this hook is FOR is not offering people work they cannot do:
   greying out a control, hiding a nav item, explaining why. That is a
   real job — a staff member who can see a Restock button that always
   fails has been given a bug to report rather than a tool.
   ------------------------------------------------------------------ */

export const ROLES = { ADMIN: "admin", STAFF: "staff" };

async function getAdminRecord(userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("admins")
    .select("id, role, full_name, email, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    // The migration has not been run yet, or `admins` is unreachable.
    // Returning null means "no role", and the caller below decides what
    // to do about it — see the comment on `role`.
    console.error("[useAdminRole]", error.message);
    return null;
  }

  return data;
}

export function useAdminRole() {
  const { user, isLoading: isLoadingUser } = useUser();

  const { data: admin, isLoading: isLoadingRole } = useQuery({
    queryKey: ["admin-role", user?.id],
    queryFn: () => getAdminRecord(user?.id),
    enabled: Boolean(user?.id),
    // A role change is rare and consequential. Long enough not to be
    // asked on every navigation, short enough that a promotion takes
    // effect within the shift rather than needing a sign-out.
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = isLoadingUser || isLoadingRole;

  /* ------------------------------------------------------------------
     What happens when there is no admins row.

     `admin` deliberately falls back to the ADMIN role rather than STAFF,
     and the reasoning is worth spelling out because the cautious-looking
     choice is the wrong one here:

       · this is not the security boundary — RLS is. Guessing generously
         grants nothing, because every write still has to satisfy a
         policy in the database;
       · the only way to have no row is for the migration not to have run
         yet. Defaulting to STAFF in that state would hide Rooms,
         Settings, the Menu and the team page from the ONLY existing user
         — an apparently broken dashboard, with no visible cause;
       · and once the migration HAS run, every login has a row (a trigger
         on auth.users creates one), so this branch stops being reachable.

     So: before the migration, the UI looks exactly as it does today and
     the database is as permissive as it is today. After it, the roles are
     real on both sides.
     ------------------------------------------------------------------ */
  const role = admin?.role ?? (isLoading ? null : ROLES.ADMIN);
  const isAdmin = role === ROLES.ADMIN;
  const isStaff = role === ROLES.STAFF;

  return {
    isLoading,
    role,
    isAdmin,
    isStaff,
    admin,
    /* A deactivated account is still signed in until its session
       expires. RLS already refuses it everything (every policy tests
       is_active), so the UI should say so rather than showing a
       dashboard where each action fails on its own. */
    isDeactivated: admin ? admin.is_active === false : false,

    /* Named capabilities rather than `isAdmin` sprinkled through the
       components. Two reasons: a screen reads better when it says what
       it needs ("can this person restock?") than when it says who the
       person is, and the day a third role appears there is one file to
       change instead of forty call sites. */
    can: {
      // Admin only — the things that change what the business is.
      manageRooms: isAdmin,
      manageMenu: isAdmin,
      manageStock: isAdmin, // restocking, par levels, corrections
      manageStaff: isAdmin,
      manageSettings: isAdmin,
      deleteBookings: isAdmin,
      viewRevenue: isAdmin,

      // The day job, for both roles.
      takeBookings: Boolean(role),
      changeBookingStatus: Boolean(role),
      sellStock: Boolean(role), // sale, and the removals below
      removeStock: Boolean(role), // removal / waste / transfer out
      moderateReviews: Boolean(role),
    },
  };
}
