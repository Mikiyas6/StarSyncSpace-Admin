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
        New accounts start as <strong>staff</strong>: bookings, seat sales, and
        recording snacks sold or removed. Promote somebody to{" "}
        <strong>admin</strong> to let them set prices, add or remove rooms and
        menu items, restock, change settings and manage this list.
      </Note>

      <TeamTable />

      <Row type="vertical">
        <Heading as="h2">Add someone</Heading>
        <Note>
          This creates a login and gives it the staff role. They can sign in
          straight away; promote them above if they need more.
        </Note>
        <SignupForm />
      </Row>
    </>
  );
}

export default Users;
