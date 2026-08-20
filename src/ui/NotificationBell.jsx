import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineBell } from "react-icons/hi2";
import styled from "styled-components";
import { useOutsideClick } from "../hooks/useOutsideClick";
import { useNotifications } from "../features/check-in-out/useNotifications";

const BellWrapper = styled.div`
  position: relative;
`;

const BellButton = styled.button`
  position: relative;
  display: flex;
  align-items: center;
  background: none;
  border: none;
  padding: 0.6rem;
  border-radius: var(--border-radius-sm);
  transition: all 0.2s;

  &:hover {
    background-color: var(--color-grey-100);
  }

  & svg {
    width: 2.2rem;
    height: 2.2rem;
    color: var(--color-brand-600);
  }
`;

const Badge = styled.span`
  position: absolute;
  top: -0.4rem;
  right: -0.4rem;
  min-width: 1.9rem;
  height: 1.9rem;
  padding: 0 0.4rem;
  border-radius: 50%;
  background-color: var(--color-red-700);
  color: var(--color-grey-0);
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Dropdown = styled.div`
  position: absolute;
  top: calc(100% + 0.8rem);
  right: 0;
  width: 32rem;
  background-color: var(--color-grey-0);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--color-grey-100);
  overflow: hidden;
  z-index: 1000;
`;

const DropdownHeader = styled.div`
  padding: 1.2rem 2.4rem;
  font-weight: 600;
  font-size: 1.5rem;
  border-bottom: 1px solid var(--color-grey-100);
`;

const Item = styled.div`
  display: flex;
  align-items: center;
  gap: 1.2rem;
  padding: 1.2rem 2.4rem;
  border-bottom: 1px solid var(--color-grey-100);

  &:last-child {
    border-bottom: none;
  }

  & div {
    flex: 1;
    min-width: 0;
  }

  & strong {
    display: block;
    font-size: 1.4rem;
  }

  & span {
    display: block;
    font-size: 1.2rem;
    color: var(--color-grey-500);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const ViewButton = styled.button`
  background: none;
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-sm);
  color: var(--color-brand-600);
  cursor: pointer;
  font-size: 1.2rem;
  font-family: inherit;
  padding: 0.6rem 1rem;

  &:hover {
    background-color: var(--color-brand-50);
  }
`;

const EmptyText = styled.p`
  padding: 2.4rem;
  text-align: center;
  font-size: 1.4rem;
  color: var(--color-grey-500);
`;

function minutesLeft(endTime) {
  return Math.max(
    0,
    Math.floor((new Date(endTime).getTime() - Date.now()) / 60000)
  );
}

function NotificationBell() {
  const { notifications, unreadCount, markAllSeen } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClick(() => setOpen(false), false);
  const navigate = useNavigate();

  function handleToggle() {
    if (!open) markAllSeen();
    setOpen((o) => !o);
  }

  return (
    <BellWrapper ref={ref}>
      <BellButton
        onClick={handleToggle}
        title="Notifications"
        aria-label="Notifications"
      >
        <HiOutlineBell />
        {unreadCount > 0 && <Badge>{unreadCount > 9 ? "9+" : unreadCount}</Badge>}
      </BellButton>

      {open && (
        <Dropdown>
          <DropdownHeader>Notifications</DropdownHeader>
          {notifications.length > 0 ? (
            notifications.map((n) => (
              <Item key={n.id}>
                <div>
                  <strong>Room {n.roomName ?? "—"}</strong>
                  <span>
                    {n.guestName} •{" "}
                    {minutesLeft(n.endTime) === 0
                      ? "leaving now"
                      : `${minutesLeft(n.endTime)} min left`}
                  </span>
                </div>
                <ViewButton onClick={() => navigate(`/bookings/${n.id}`)}>
                  View
                </ViewButton>
              </Item>
            ))
          ) : (
            <EmptyText>No notifications</EmptyText>
          )}
        </Dropdown>
      )}
    </BellWrapper>
  );
}

export default NotificationBell;