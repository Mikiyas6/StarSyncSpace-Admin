import styled from "styled-components";

import Heading from "../../ui/Heading";
import Row from "../../ui/Row";
import Tag from "../../ui/Tag";
import Spinner from "../../ui/Spinner";
import { Link } from "react-router-dom";
import { useEndingSoon } from "./useEndingSoon";
import { formatDistanceFromNow } from "../../utils/helpers";

const StyledEndingSoon = styled.div`
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-100);
  border-radius: var(--border-radius-md);

  padding: 2.4rem 3.2rem;
  display: flex;
  flex-direction: column;
  gap: 2.4rem;
  grid-column: 3 / span 2;
  grid-row: 2;
`;

const SoonList = styled.ul`
  overflow: scroll;
  overflow-x: hidden;

  &::-webkit-scrollbar {
    width: 0 !important;
  }
  scrollbar-width: none;
  -ms-overflow-style: none;
`;

const NoActivity = styled.p`
  text-align: center;
  font-size: 1.8rem;
  font-weight: 500;
  margin-top: 0.8rem;
`;

const StyledItem = styled.li`
  display: grid;
  grid-template-columns: 6rem 1fr 8rem 10rem;
  gap: 1.2rem;
  align-items: center;

  font-size: 1.4rem;
  padding: 0.8rem 0;
  border-bottom: 1px solid var(--color-grey-100);

  &:first-child {
    border-top: 1px solid var(--color-grey-100);
  }
`;

const Stacked = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;

  & div:first-child {
    font-weight: 500;
  }
`;

const Guest = styled.div`
  color: var(--color-grey-500);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Detail = styled.div`
  color: var(--color-grey-500);
  text-align: right;
`;

const SoonLink = styled(Link)`
  color: var(--color-brand-600);
  text-align: right;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

function EndingSoon() {
  const { endingSoon, isLoading } = useEndingSoon();

  function minutesUntil(endTime) {
    const diff = new Date(endTime).getTime() - Date.now();
    return Math.round(diff / (60 * 1000));
  }

  return (
    <StyledEndingSoon>
      <Row type="horizontal">
        <Heading as="h2">Ending soon</Heading>
      </Row>

      {!isLoading ? (
        endingSoon?.length > 0 ? (
          <SoonList>
            {endingSoon.map((booking) => {
              const mins = minutesUntil(booking.endTime);
              const ended = mins < 0;
              return (
                <StyledItem key={booking.id}>
                  {ended ? (
                    <Tag type="coral">Ended</Tag>
                  ) : mins <= 15 ? (
                    <Tag type="yellow">
                      {mins === 0 ? "Now" : `${mins} min`}
                    </Tag>
                  ) : (
                    <Tag type="green">{mins} min</Tag>
                  )}
                  <Stacked>
                    <div>Room {booking.rooms?.name}</div>
                    <Guest>{booking.guests?.fullName}</Guest>
                  </Stacked>
                  <Detail>
                    ends {formatDistanceFromNow(booking.endTime)}
                  </Detail>
                  <SoonLink to={`/bookings/${booking.id}`}>View</SoonLink>
                </StyledItem>
              );
            })}
          </SoonList>
        ) : (
          <NoActivity>No bookings ending right now...</NoActivity>
        )
      ) : (
        <Spinner />
      )}
    </StyledEndingSoon>
  );
}

export default EndingSoon;