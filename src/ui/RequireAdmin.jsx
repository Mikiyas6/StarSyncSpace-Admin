import styled from "styled-components";
import { ShieldAlert } from "lucide-react";

import Heading from "./Heading";
import Spinner from "./Spinner";
import { useAdminRole } from "../features/authentication/useAdminRole";

const Denied = styled.div`
  display: grid;
  justify-items: center;
  gap: 1.2rem;
  padding: 4.8rem 2.4rem;
  text-align: center;
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-md);

  & svg {
    width: 4.8rem;
    height: 4.8rem;
    color: var(--color-grey-400);
  }

  & p {
    color: var(--color-grey-500);
    max-width: 48rem;
  }
`;

/* ------------------------------------------------------------------
   A page that is not for staff.

   Wrapped around the admin-only routes so a staff member who types the
   URL, or follows an old bookmark, gets a sentence instead of a screen
   full of controls that all fail.

   This is NOT what keeps them out — see the long note in useAdminRole.
   Row-level security in the database is what refuses the writes, and it
   refuses them whether or not anything rendered. This is here so that
   nobody is shown work they cannot do.

   It says WHY, and who to ask, because "Access denied" leaves a
   receptionist with nothing to act on. A named role and a next step turn
   a dead end into an errand.
   ------------------------------------------------------------------ */
function RequireAdmin({ children, what = "This page" }) {
  const { isAdmin, isLoading, isDeactivated, hasNoRole } = useAdminRole();

  if (isLoading) return <Spinner />;

  /* A login with no row on the team at all. RLS refuses it everything,
     so drawing the page would be handing somebody a screen of controls
     that each fail on their own. It is worth distinguishing from
     "revoked" below: revoking is something an admin did on purpose and
     can undo from the team page, whereas this is a login that was
     orphaned — usually by deleting the person from `admins` in the
     Supabase table editor, which does not delete their login. Adding
     them again on the team page reclaims it. */
  if (hasNoRole)
    return (
      <Denied>
        <ShieldAlert />
        <Heading as="h2">This account is not on the team</Heading>
        <p>
          The login works, but it has no role, so there is nothing it can read
          or change. An admin can put it back by adding the same email address
          on the team page — that reclaims this login rather than making a
          second one.
        </p>
      </Denied>
    );

  if (isDeactivated)
    return (
      <Denied>
        <ShieldAlert />
        <Heading as="h2">Your access has been revoked</Heading>
        <p>
          Your account is still signed in but can no longer read or change
          anything. Ask an admin to restore your access, or sign out.
        </p>
      </Denied>
    );

  if (!isAdmin)
    return (
      <Denied>
        <ShieldAlert />
        <Heading as="h2">{what} is for admins</Heading>
        <p>
          Your account is set up as <strong>staff</strong>, which covers the
          day-to-day desk work: taking bookings, selling seats, and recording
          snacks sold or removed. Prices, rooms, the menu, restocking, settings
          and the team are admin-only. Ask an admin if you need something here.
        </p>
      </Denied>
    );

  return children;
}

export default RequireAdmin;
