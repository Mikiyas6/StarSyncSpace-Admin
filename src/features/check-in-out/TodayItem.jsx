import styled from "styled-components";
import Tag from "../../ui/Tag";
import Button from "../../ui/Button";
import { Link } from "react-router-dom";
import { bookingMinutes, formatDuration } from "../../utils/booking";
const StyledTodayItem = styled.li`
  display: grid;
  grid-template-columns: 9rem 1fr 6rem 10rem;
  gap: 1.2rem;
  align-items: center;

  font-size: 1.4rem;
  padding: 0.8rem 0;
  border-bottom: 1px solid var(--color-grey-100);

  &:first-child {
    border-top: 1px solid var(--color-grey-100);
  }
`;

const Guest = styled.div`
  font-weight: 500;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
function TodayItem({ activity }) {
  const { id, status, guests } = activity;
  return (
    <StyledTodayItem>
      {status === "booked" && <Tag type="yellow">Arriving</Tag>}
      {status === "in-use" && <Tag type="coral">Leaving</Tag>}
      <Guest>{guests?.fullName}</Guest>
      <div>{formatDuration(bookingMinutes(activity))}</div>
      {status === "booked" && (
        <Button
          size="small"
          variation="primary"
          as={Link}
          to={`/checkin/${id}`}
        >
          Mark in use
        </Button>
      )}
      {status === "in-use" && (
        <Button
          size="small"
          variation="primary"
          as={Link}
          to={`/bookings/${id}`}
        >
          Complete
        </Button>
      )}
    </StyledTodayItem>
  );
}

export default TodayItem;
