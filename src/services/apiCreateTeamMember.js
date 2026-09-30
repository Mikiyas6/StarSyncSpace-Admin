/* Adding somebody to the team.

   This is a separate file from apiTeam.js because it is the one thing on
   that page that CANNOT be done from the browser, and the reason is
   worth keeping next to the code rather than buried in a commit.

   What was here before was supabase.auth.signUp, and it broke in two
   ways at once:

     · signUp signs the new account in. The admin filling in the form
       was swapped for the person they had just hired — their session
       overwritten in localStorage. (useSignup then wrote the new user
       into the ["user"] query cache by hand, so the whole dashboard
       agreed you were now the receptionist.)

     · this Supabase project requires email confirmation, so the account
       signUp created could not sign in until somebody clicked a link in
       an email that the built-in mailer will not reliably deliver.
       "Create a new user" produced a user who could not log in.

   Neither is fixable in a browser holding an anon key. Creating the
   login needs the service-role key, and the service-role key must never
   be in a browser — so the work happens on the Client site's server,
   which already holds one, at POST /api/admin/team. This file is the
   call to it, plus the honest fallback for when that site is not
   configured.
*/

import { createClient } from "@supabase/supabase-js";

import supabase, { supabaseKey, supabaseUrl } from "./supabase";

/* Where the server route lives. VITE_TEAM_API_URL overrides it outright
   (useful when the Admin runs against a local `next dev`); otherwise it
   is derived from the site URL that the cache-busting helper already
   uses, so a working deployment needs no new configuration. */
export function teamApiUrl() {
  const explicit = import.meta.env.VITE_TEAM_API_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const base = import.meta.env.VITE_CLIENT_SITE_URL;
  if (!base) return null;

  return `${base.replace(/\/+$/, "")}/api/admin/team`;
}

export async function createTeamMember({
  fullName,
  email,
  password,
  role = "staff",
}) {
  const url = teamApiUrl();
  if (!url) return createWithoutServer({ fullName, email, password });

  /* The caller's own access token is what authorises this. The server
     asks Supabase whose token it is and then checks the admins table —
     so a staff member who finds this endpoint gets a 403 from the same
     rule that RLS applies everywhere else. */
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token)
    throw new Error("You are not signed in. Sign in and try again.");

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ fullName, email, password, role }),
    });
  } catch {
    /* The site is down, or CORS refused the request before it left. The
       fallback below still creates a working account (it just needs an
       email confirmation), which beats telling an admin to come back
       later. */
    return createWithoutServer({ fullName, email, password });
  }

  /* The site is reachable but does not have this route — an older
     deployment. A 404 here is not the admin's mistake and there is
     nothing for them to do about it, so it degrades to the fallback
     rather than reporting a failure they cannot act on. */
  if (response.status === 404 || response.status === 405)
    return createWithoutServer({ fullName, email, password });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok)
    throw new Error(payload.message ?? "That login could not be created.");

  return payload;
}

/* ------------------------------------------------------------------
   No server route available.

   Falls back to signUp — but on a throwaway client, which is the part
   that matters. persistSession: false and a storage key of its own mean
   the new session is never written anywhere: the admin stays signed in
   as themselves, which is the worse half of the original bug fixed even
   in the degraded path.

   The account still has to confirm its email before it can be used, and
   this says so rather than reporting a success the admin cannot act on.
   ------------------------------------------------------------------ */
async function createWithoutServer({ fullName, email, password }) {
  const scratch = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "starsync-signup-scratch",
    },
  });

  const { data, error } = await scratch.auth.signUp({
    email,
    password,
    options: { data: { fullName } },
  });

  if (error) {
    console.error("[createTeamMember] signUp failed:", error);
    if (/already registered|already exists/i.test(error.message ?? ""))
      throw new Error(
        "That email address already has a login, and this dashboard could not reach the site's server to reclaim it. See Supabase → Authentication → Users.",
      );
    throw new Error(error.message || "That login could not be created.");
  }

  /* Supabase does not say "that address is taken" to an anon caller —
     it would let anyone test which of their customers has an account.
     It returns a user-shaped object with no identities instead, and
     sends nothing. Reporting that as a new hire would leave an admin
     waiting for somebody who was never created.

     The message has to name the degraded path, because the commonest
     reason to be here is an address whose login outlived its `admins`
     row — deleted from the table editor, which does not delete the
     login. The server route reclaims exactly that. This path cannot,
     and an earlier version of this message sent admins looking for the
     person on a list they are by definition missing from. */
  if (data?.user && Array.isArray(data.user.identities) && !data.user.identities.length)
    throw new Error(
      "That email address already has a login, and this dashboard could not reach the site's server to reclaim it. " +
        "Check that VITE_CLIENT_SITE_URL points at a host that answers without redirecting, and that /api/admin/team is deployed there. " +
        "Until then the account can only be sorted out in Supabase → Authentication → Users.",
    );

  return {
    member: {
      id: data?.user?.id,
      role: "staff",
      full_name: fullName || null,
      email,
      is_active: true,
    },
    role: "staff",
    // signUp cannot confirm an address, so this one genuinely cannot.
    canSignInNow: Boolean(data?.session),
    warning: data?.session
      ? null
      : "They must click the confirmation link Supabase emailed them before they can sign in. To skip that step, set VITE_CLIENT_SITE_URL so this dashboard can create logins through the site's server.",
  };
}
