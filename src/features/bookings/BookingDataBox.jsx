import styled from "styled-components";
import { format, isToday } from "date-fns";
import {
  Building2,
  CircleDollarSign,
  MessageSquareText,
  UserCheck,
} from "lucide-react";

import DataItem from "../../ui/DataItem";

import { formatDistanceFromNow, formatCurrency } from "../../utils/helpers";
import { bookingMinutes, formatDuration } from "../../utils/booking";

const StyledBookingDataBox = styled.section`
  /* Box */
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-100);
  border-radius: var(--border-radius-md);

  overflow: hidden;
`;

const Header = styled.header`
  background-color: var(--color-brand-600);
  padding: 2rem 4rem;
  color: var(--color-brand-50);
  font-size: 1.8rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: space-between;

  svg {
    height: 3.2rem;
    width: 3.2rem;
  }

  & div:first-child {
    display: flex;
    align-items: center;
    gap: 1.6rem;
    font-weight: 600;
    font-size: 1.8rem;
  }

  & span {
    font-family: "Space Grotesk";
    font-size: 2rem;
    margin-left: 4px;
  }
`;

const Section = styled.section`
  padding: 3.2rem 4rem 1.2rem;
`;

const Guest = styled.div`
  display: flex;
  align-items: center;
  gap: 1.2rem;
  margin-bottom: 1.6rem;
  color: var(--color-grey-500);

  & p:first-of-type {
    font-weight: 500;
    color: var(--color-grey-700);
  }
`;

const Price = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.6rem 3.2rem;
  border-radius: var(--border-radius-sm);
  margin-top: 2.4rem;

  background-color: ${(props) =>
    props.isPaid ? "var(--color-green-100)" : "var(--color-yellow-100)"};
  color: ${(props) =>
    props.isPaid ? "var(--color-green-700)" : "var(--color-yellow-700)"};

  & p:last-child {
    text-transform: uppercase;
    font-size: 1.4rem;
    font-weight: 600;
  }

  svg {
    height: 2.4rem;
    width: 2.4rem;
    color: currentColor !important;
  }
`;

const Footer = styled.footer`
  padding: 1.6rem 4rem;
  font-size: 1.2rem;
  color: var(--color-grey-500);
  text-align: right;
`;

// A purely presentational component
function BookingDataBox({ booking }) {
  const {
    created_at,
    startTime,
    endTime,
    numGuests,
    cabinPrice,
    totalPrice,
    observations,
    isPaid,
    // No country/countryFlag: the guests table is (id, created_at,
    // fullName, email) and never had them, so the flag this used to try
    // to render was always undefined.
    guests: { fullName: guestName, email },
    rooms: { name: roomName },
  } = booking;

  return (
    <StyledBookingDataBox>
      <Header>
        <div>
          <Building2 />
          <p>
            {formatDuration(bookingMinutes(booking))} in Room{" "}
            <span>{roomName}</span>
          </p>
        </div>

        <p>
          {format(new Date(startTime), "EEE, MMM dd yyyy, HH:mm")} (
          {isToday(new Date(startTime))
            ? "Today"
            : formatDistanceFromNow(startTime)}
          ) &mdash; {format(new Date(endTime), "EEE, MMM dd yyyy, HH:mm")}
        </p>
      </Header>

      <Section>
        <Guest>
          <p>
            {guestName} {numGuests > 1 ? `+ ${numGuests - 1} guests` : ""}
          </p>
          <span>&bull;</span>
          <p>{email}</p>
        </Guest>

        {observations && (
          <DataItem icon={<MessageSquareText />} label="Observations">
            {observations}
          </DataItem>
        )}

        <DataItem icon={<UserCheck />} label={`Guests`}>
          {numGuests}
        </DataItem>

        <Price isPaid={isPaid}>
          <DataItem icon={<CircleDollarSign />} label={`Total price`}>
            {formatCurrency(totalPrice)}
            {` (${formatCurrency(cabinPrice)} room × ${formatDuration(
              bookingMinutes(booking),
            ).toLowerCase()})`}
          </DataItem>

          <p>{isPaid ? "Paid" : "Payment pending"}</p>
        </Price>
      </Section>

      <Footer>
        <p>Booked {format(new Date(created_at), "EEE, MMM dd yyyy, p")}</p>
      </Footer>
    </StyledBookingDataBox>
  );
}

export default BookingDataBox;
