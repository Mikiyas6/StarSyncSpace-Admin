import { NavLink } from "react-router-dom";
import styled from "styled-components";
import {
  Boxes,
  Building2,
  CalendarClock,
  LayoutDashboard,
  Settings2,
  Star,
  Users,
  UtensilsCrossed,
} from "lucide-react";

import { usePendingReviewCount } from "../features/reviews/usePendingReviewCount";
import { useAdminRole } from "../features/authentication/useAdminRole";
import { useLowStockCount } from "../features/inventory/useInventory";

const NavList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

const StyledNavLink = styled(NavLink)`
  &:link,
  &:visited {
    display: flex;
    align-items: center;
    gap: 1.2rem;
    color: var(--color-grey-600);
    font-size: 1.6rem;
    font-weight: 500;
    padding: 1.2rem 2.4rem;
    transition: all 0.3s;
  }

  /* This works because react-router places the active class on the active NavLink */
  &:hover,
  &:active,
  &.active:link,
  &.active:visited {
    color: var(--color-grey-800);
    background-color: var(--color-grey-50);
    border-radius: var(--border-radius-sm);
  }

  & svg {
    width: 2.4rem;
    height: 2.4rem;
    color: var(--color-grey-400);
    transition: all 0.3s;
  }

  &:hover svg,
  &:active svg,
  &.active:link svg,
  &.active:visited svg {
    color: var(--color-brand-600);
  }
`;

const PendingBadge = styled.span`
  margin-left: auto;
  min-width: 2.2rem;
  padding: 0.2rem 0.7rem;
  border-radius: 100px;
  background-color: var(--color-yellow-100);
  color: var(--color-yellow-700);
  font-size: 1.2rem;
  font-weight: 600;
  text-align: center;
`;

function MainNav() {
  const { pendingCount } = usePendingReviewCount();
  const { lowCount } = useLowStockCount();
  const { can } = useAdminRole();

  /* Hiding a link is a courtesy, not a lock — row-level security in the
     database is what refuses the writes, and it does so whether or not
     anything rendered (see useAdminRole). What this achieves is that a
     receptionist is not shown four pages that would only tell them off.

     Note that Bookings, Inventory and Reviews are NOT gated: staff work
     on all three. Inventory in particular is deliberately visible to
     them, because selling a snack and recording one removed is their job;
     the restock and par-level controls inside it are what admins get. */
  return (
    <nav>
      <NavList>
        <li>
          <StyledNavLink to="/dashboard">
            <LayoutDashboard />
            <span>Dashboard</span>
          </StyledNavLink>
        </li>
        <li>
          <StyledNavLink to="/bookings">
            <CalendarClock />
            <span>Bookings</span>
          </StyledNavLink>
        </li>
        {/* Every stocked item in every room, with what is running low.
            Staff see it: selling and removing snacks is desk work. */}
        <li>
          <StyledNavLink to="/inventory">
            <Boxes />
            <span>Inventory</span>
            {/* A count here is a fridge that needs filling. It is the
                only thing that makes anyone open this page before a
                customer asks for something that has run out. */}
            {lowCount > 0 ? <PendingBadge>{lowCount}</PendingBadge> : null}
          </StyledNavLink>
        </li>
        {can.manageRooms ? (
          <li>
            <StyledNavLink to="/rooms">
              <Building2 />
              <span>Rooms</span>
            </StyledNavLink>
          </li>
        ) : null}
        {can.manageStaff ? (
          <li>
            <StyledNavLink to="/users">
              <Users />
              <span>Team</span>
            </StyledNavLink>
          </li>
        ) : null}
        {can.manageSettings ? (
          <li>
            <StyledNavLink to="/settings">
              <Settings2 />
              <span>Settings</span>
            </StyledNavLink>
          </li>
        ) : null}
        {can.manageMenu ? (
          <li>
            <StyledNavLink to="/menu">
              <UtensilsCrossed />
              <span>Menu</span>
            </StyledNavLink>
          </li>
        ) : null}
        <li>
          <StyledNavLink to="/reviews">
            <Star />
            <span>Reviews</span>
            {/* Reviews are invisible to the public until someone acts on
                them, so an unread queue is a guest waiting. The count is
                the only thing that makes anyone open this page. */}
            {pendingCount > 0 ? <PendingBadge>{pendingCount}</PendingBadge> : null}
          </StyledNavLink>
        </li>
      </NavList>
    </nav>
  );
}

export default MainNav;
