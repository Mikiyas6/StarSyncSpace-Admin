import styled from "styled-components";

import SignupForm from "../features/authentication/SignupForm";
import TeamTable from "../features/team/TeamTable";
import Heading from "../ui/Heading";
import Row from "../ui/Row";

const Note = styled.p`
  color: var(--color-grey-500);
  font-size: 1.4rem;
  max-width: 78ch;
`;

/* ------------------------------------------------------------------
   The team.

   This page used to be a bare signup form with no way to see who already
   had an account, which meant the answer to "who can change our prices?"
   lived only in the Supabase dashboard. Now it lists everybody, what
   their role lets them do, and whether they can still sign in — with the
   form to add somebody underneath, where it belongs once the list is the
   point of the page.
   ------------------------------------------------------------------ */
function Users() {
  return (
    <>
      <Row type="horizontal">
        <Heading as="h1">Team</Heading>
      </Row>

      <Note>
        <strong>Staff</strong> do the day: bookings, seat sales, and recording
        snacks sold or removed. An <strong>admin</strong> can also set prices,
        add or remove rooms and menu items, restock, change settings and manage
        this list. Pick a role when you add somebody below, or change theirs
        here at any time.
      </Note>

      <TeamTable />

      <Row type="vertical">
        <Heading as="h2">Add someone</Heading>
        <Note>
          This creates a login with the password you type here, already
          confirmed — give them the password and they can sign in straight
          away. Pick their role below; you can change it above at any time.
        </Note>
        <SignupForm />
      </Row>
    </>
  );
}

export default Users;
