import styled from "styled-components";
import BookingDataBox from "../../features/bookings/BookingDataBox";
import { useState } from "react";
import Row from "../../ui/Row";
import Heading from "../../ui/Heading";
import ButtonGroup from "../../ui/ButtonGroup";
import Button from "../../ui/Button";
import ButtonText from "../../ui/ButtonText";
import { useBooking } from "../../features/bookings/useBooking";
import Spinner from "../../ui/Spinner";
import Checkbox from "../../ui/Checkbox";
import { useMoveBack } from "../../hooks/useMoveBack";
import { useEffect } from "react";
import { useCheckin } from "./useCheckin";
import { formatCurrency } from "../../utils/helpers";
import Empty from "../../ui/Empty";

const Box = styled.div`
  /* Box */
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-100);
  border-radius: var(--border-radius-md);
  padding: 2.4rem 4rem;
`;

function CheckinBooking() {
  const [confirmPaid, setConfirmPaid] = useState(false);
  const { isLoading, booking } = useBooking();
  useEffect(() => setConfirmPaid(booking?.isPaid ?? false), [booking]);
  const moveBack = useMoveBack();

  const { checkin, isCheckingIn } = useCheckin();
  if (isLoading) return <Spinner />;
  if (!booking) return <Empty resourceName="booking" />;

  const { id: bookingId, guests, totalPrice, status } = booking;

  /* Statuses now advance on their own at the start time (see
     useReconcileStatuses), so by the time the desk opens this page a
     booking can already be "in use" — and then marking it in use again
     is a no-op that hides the one thing this page is actually for, which
     is recording that the money arrived. So the confirm-paid step stands
     on its own, and the status change only happens when there is a
     status change to make. */
  const alreadyRunning = status !== "booked";

  function handleCheckin() {
    if (!confirmPaid) return;
    checkin({ bookingId, alreadyRunning });
  }

  return (
    <>
      <Row type="horizontal">
        <Heading as="h1">Mark booking #{bookingId} in use</Heading>
        <ButtonText onClick={moveBack}>&larr; Back</ButtonText>
      </Row>

      <BookingDataBox booking={booking} />
      <Box>
        <Checkbox
          checked={confirmPaid}
          onChange={() => setConfirmPaid((confirmed) => !confirmed)}
          id="confirmPaid"
          disabled={confirmPaid || isCheckingIn}
        >
          I confirm that {guests.fullName} has paid the total amount of{" "}
          {formatCurrency(totalPrice)}.
        </Checkbox>
      </Box>
      <ButtonGroup>
        <Button onClick={handleCheckin} disabled={!confirmPaid || isCheckingIn}>
          {alreadyRunning
            ? `Confirm payment for booking #${bookingId}`
            : `Mark booking #${bookingId} in use`}
        </Button>
        <Button variation="secondary" onClick={moveBack}>
          Back
        </Button>
      </ButtonGroup>
    </>
  );
}

export default CheckinBooking;
