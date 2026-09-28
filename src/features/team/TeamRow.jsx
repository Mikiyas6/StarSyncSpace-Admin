import styled from "styled-components";
import { ShieldCheck, UserRound } from "lucide-react";

import Table from "../../ui/Table";
import Tag from "../../ui/Tag";
import Menus from "../../ui/Menus";
import Modal from "../../ui/Modal";
import ConfirmDelete from "../../ui/ConfirmDelete";
import { useSetActive, useSetRole } from "./useTeam";

const Stacked = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;

  & span:first-child {
    font-weight: 600;
    color: var(--color-grey-700);
  }

  & span:last-child {
    color: var(--color-grey-500);
    font-size: 1.2rem;
  }
`;

const Muted = styled.span`
  color: var(--color-grey-500);
  font-size: 1.3rem;
`;

/* What each role may do, in one line, right next to the control that
   changes it. Somebody deciding whether to promote a receptionist should
   not have to go and read a migration to find out what they are granting. */
const ROLE_SUMMARY = {
  admin: "Prices, rooms, menu, restocking, staff and settings",
  staff: "Bookings, seat sales, snack sales and removals",
};

function TeamRow({ member, isSelf }) {
  const { id, role, full_name, email, is_active } = member;
  const { setRole, isSettingRole } = useSetRole();
  const { setActive, isSettingActive } = useSetActive();
  const isWorking = isSettingRole || isSettingActive;

  const isAdmin = role === "admin";

  return (
    <Table.Row>
      <Stacked>
        <span>
          {full_name || email || "Unnamed"}
          {/* Marking your own row matters here: the two dangerous actions
              on this page — demoting and revoking — are dangerous mostly
              when you do them to yourself. */}
          {isSelf ? <Muted> · you</Muted> : null}
        </span>
        <span>{email ?? "no email on record"}</span>
      </Stacked>

      <Tag type={isAdmin ? "green" : "silver"}>
        {isAdmin ? "Admin" : "Staff"}
      </Tag>

      <Muted>{ROLE_SUMMARY[role] ?? "Unknown role"}</Muted>

      <Tag type={is_active ? "blue" : "coral"}>
        {is_active ? "Active" : "Revoked"}
      </Tag>

      <Modal>
        <Menus.Menu>
          <Menus.Toggle id={id} />
          <Menus.List id={id}>
            {isAdmin ? (
              <Menus.Button
                icon={<UserRound />}
                disabled={isWorking}
                onClick={() => setRole({ id, role: "staff" })}
              >
                Make staff
              </Menus.Button>
            ) : (
              <Menus.Button
                icon={<ShieldCheck />}
                disabled={isWorking}
                onClick={() => setRole({ id, role: "admin" })}
              >
                Make admin
              </Menus.Button>
            )}

            {is_active ? (
              /* Revoking is behind a confirmation because it takes
                 somebody's access away mid-shift. It is NOT a delete —
                 the row stays, with their name still on every booking
                 they took — which is what the dialog's copy has to say,
                 or an admin will reasonably expect the history to go
                 too. */
              <Modal.Open opens="revoke">
                <Menus.Button icon={<UserRound />} disabled={isWorking}>
                  Revoke access
                </Menus.Button>
              </Modal.Open>
            ) : (
              <Menus.Button
                icon={<ShieldCheck />}
                disabled={isWorking}
                onClick={() => setActive({ id, isActive: true })}
              >
                Restore access
              </Menus.Button>
            )}
          </Menus.List>

          <Modal.Window name="revoke">
            <ConfirmDelete
              title={`Revoke access for ${full_name || email || "this person"}?`}
              description={
                isSelf
                  ? "This will sign you out of everything in this dashboard. Your name stays on every booking you took and every item you moved. Another admin can restore your access."
                  : "They lose access immediately. Their name stays on every booking they took and every item they moved, and you can restore their access at any time. To stop them signing in at all, delete the login in Supabase → Authentication → Users."
              }
              confirmLabel="Revoke access"
              disabled={isWorking}
              onConfirm={() => setActive({ id, isActive: false })}
            />
          </Modal.Window>
        </Menus.Menu>
      </Modal>
    </Table.Row>
  );
}

export default TeamRow;
