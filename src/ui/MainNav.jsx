import { NavLink } from "react-router-dom";
import styled from "styled-components";
import {
  Building2,
  CalendarClock,
  LayoutDashboard,
  Settings2,
  Star,
  Users,
  UtensilsCrossed,
} from "lucide-react";

import { usePendingReviewCount } from "../features/reviews/usePendingReviewCount";

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
        <li>
          <StyledNavLink to="/rooms">
            <Building2 />
            <span>Rooms</span>
          </StyledNavLink>
        </li>
        <li>
          <StyledNavLink to="/users">
            <Users />
            <span>Users</span>
          </StyledNavLink>
        </li>
        <li>
          <StyledNavLink to="/settings">
            <Settings2 />
            <span>Settings</span>
          </StyledNavLink>
        </li>
        <li>
          <StyledNavLink to="/menu">
            <UtensilsCrossed />
            <span>Menu</span>
          </StyledNavLink>
        </li>
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
