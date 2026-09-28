import Table from "../../ui/Table";
import Menus from "../../ui/Menus";
import Empty from "../../ui/Empty";
import Spinner from "../../ui/Spinner";
import { useUser } from "../authentication/useUser";
import TeamRow from "./TeamRow";
import { useTeam } from "./useTeam";

function TeamTable() {
  const { team, isLoading, error } = useTeam();
  const { user } = useUser();

  if (isLoading) return <Spinner />;

  /* The likely error here is a specific, fixable one — the migration has
     not been run — and getTeam() already phrases it as an instruction.
     Showing it beats an error boundary that says "something went wrong". */
  if (error) return <p>{error.message}</p>;
  if (!team.length) return <Empty resourceName="team members" />;

  return (
    <Menus>
      <Table columns="2.2fr 1fr 2.4fr 1fr 3.2rem">
        <Table.Header>
          <div>Person</div>
          <div>Role</div>
          <div>Can do</div>
          <div>Access</div>
          <div></div>
        </Table.Header>

        <Table.Body
          data={team}
          render={(member) => (
            <TeamRow
              key={member.id}
              member={member}
              isSelf={member.id === user?.id}
            />
          )}
        />
      </Table>
    </Menus>
  );
}

export default TeamTable;
