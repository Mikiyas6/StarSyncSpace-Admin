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

/* Two different nothings.

   "The table would not answer" and "the table answered, and this person
   is not in it" used to come back as the same null, and the fallback
   below guessed ADMIN for both. That was right for the first and wrong
   for the second — see the note on `role` — so they are told apart here
   rather than conflated and guessed about. */
async function getAdminRecord(userId) {
  if (!userId) return { status: "unknown", admin: null };

  const { data, error } = await supabase
    .from("admins")
    .select("id, role, full_name, email, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    // The migration has not been run yet, or `admins` is unreachable.
    console.error("[useAdminRole]", error.message);
    return { status: "unknown", admin: null };
  }

  // A clean read that found nobody. This login has no role at all.
  return { status: data ? "found" : "missing", admin: data ?? null };
}

export function useAdminRole() {
  const { user, isLoading: isLoadingUser } = useUser();

  const { data: record, isLoading: isLoadingRole } = useQuery({
    queryKey: ["admin-role", user?.id],
    queryFn: () => getAdminRecord(user?.id),
    enabled: Boolean(user?.id),
    // A role change is rare and consequential. Long enough not to be
    // asked on every navigation, short enough that a promotion takes
    // effect within the shift rather than needing a sign-out.
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = isLoadingUser || isLoadingRole;
  const admin = record?.admin ?? null;

  /* ------------------------------------------------------------------
     What happens when there is no admins row.

     There are two ways to have none, and they want opposite answers.

     The table would not answer ("unknown"). Almost always the migration
     has not been run. Falling back to ADMIN is right here:

       · this is not the security boundary — RLS is. Guessing generously
         grants nothing, because every write still has to satisfy a
         policy in the database;
       · defaulting to STAFF in that state would hide Rooms, Settings,
         the Menu and the team page from the ONLY existing user — an
         apparently broken dashboard, with no visible cause.

     The table answered and this login is not in it ("missing"). This was
     assumed unreachable — a trigger on auth.users creates a row with
     every login — and on 2026-09-30 it turned out not to be: deleting
     somebody from `admins` in the Supabase table editor does not delete
     their login, and leaves exactly this. Guessing ADMIN for them draws
     the whole dashboard for somebody RLS will refuse every single
     action, which is the "here is a bug to report" failure the note at
     the top of this file warns against. They get no role, and
     `hasNoRole` below says why.
     ------------------------------------------------------------------ */
  const role =
    admin?.role ??
    (isLoading || record?.status === "missing" ? null : ROLES.ADMIN);
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

    /* A login that exists with no role at all — see the note above. It
       is not the same as deactivated (which is deliberate and
       reversible from the team page) and not the same as staff, so it
       cannot borrow either one's explanation. */
    hasNoRole: record?.status === "missing",

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

      /* Looking, for both roles, at the two catalogues the desk needs
         in front of it to do its job: which rooms exist and what is
         free, and what the kitchen actually serves. Deliberately
         separate from manageRooms / manageMenu above — reading a price
         list and setting a price are different questions, and rolling
         them into one capability is what shut staff out of the rooms
         page entirely. */
      viewRooms: Boolean(role),
      viewMenu: Boolean(role),

      // The day job, for both roles.
      takeBookings: Boolean(role),
      changeBookingStatus: Boolean(role),
      sellStock: Boolean(role), // sale — the desk's whole job here
      /* Taking stock out WITHOUT a sale. Admin-only since supabase/20:
         a removal or a write-off is the one line that makes stock
         vanish with no money to reconcile it against, so it does not
         belong to the person who would otherwise be reconciled. */
      removeStock: isAdmin, // removal / waste
      /* Moving it between rooms stays desk work — both legs are written
         at once, so nothing goes missing. */
      transferStock: Boolean(role), // transfer out
      moderateReviews: Boolean(role),
    },
  };
}
