import styled from "styled-components";

import BookingDataBox from "./BookingDataBox";
import Row from "../../ui/Row";
import Heading from "../../ui/Heading";
import Tag from "../../ui/Tag";
import ButtonGroup from "../../ui/ButtonGroup";
import Button, { ButtonContent } from "../../ui/Button";
import ButtonText from "../../ui/ButtonText";

import { useMoveBack } from "../../hooks/useMoveBack";
import { useBooking } from "./useBooking";
import Spinner from "../../ui/Spinner";
import { BadgeDollarSign, CircleCheckBig, CircleX, Trash2, UserX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../check-in-out/useCheckout";
import Modal from "../../ui/Modal";
import Menus from "../../ui/Menus";
import ConfirmDelete from "../../ui/ConfirmDelete";
import ConfirmComplete from "../../ui/ConfirmComplete";
import { useDeleteBooking } from "../rooms/useDeleteBooking";
import Empty from "../../ui/Empty";
import { statusLabel, statusTag } from "../../utils/booking";
import { useSetBookingPaid, useSetBookingStatus } from "./useBookingStatus";

const HeadingGroup = styled.div`
  display: flex;
  gap: 2.4rem;
  align-items: center;
`;

function BookingDetail() {
  const navigate = useNavigate();
  const moveBack = () => navigate(-1);
  const { isLoading, booking, error } = useBooking();
  const { checkout, isCheckingOut } = useCheckout();
  const { isDeletingBooking, deleteBooking } = useDeleteBooking();
  const { changeStatus, isChangingStatus } = useSetBookingStatus();
  const { setPaid, isSettingPaid } = useSetBookingPaid();

  // Order matters, and it used to be wrong: the "no booking" branch ran
  // BEFORE the loading branch, so every first render — when booking is
  // still undefined because the request is in flight — flashed "No
  // booking could be found" instead of a spinner.
  if (isLoading || isDeletingBooking) return <Spinner />;
  if (error || !booking) return <Empty resourceName="booking" />;

  const { status, id: bookingId, isPaid, startTime } = booking;
  const hasStarted = new Date(startTime) <= new Date();
  const isClosed =
    status === "completed" || status === "cancelled" || status === "no-show";
  const isClosedByDesk = status === "cancelled" || status === "no-show";

  function handleComplete() {
    checkout({ bookingId });
    navigate("/bookings");
  }
  function handleDelete() {
    deleteBooking(bookingId, { onSettled: () => navigate(-1) });
  }
  return (
    <>
      <Row type="horizontal">
        <HeadingGroup>
          <Heading as="h1">Booking #{bookingId}</Heading>
          <Tag type={statusTag(status)}>{statusLabel(status)}</Tag>
        </HeadingGroup>
        <ButtonText onClick={moveBack}>&larr; Back</ButtonText>
      </Row>

      <BookingDataBox booking={booking} />

      <Modal>
        <ButtonGroup>
          {status === "booked" && (
            <Button onClick={() => navigate(`/checkin/${bookingId}`)}>
              Mark in use
            </Button>
          )}
          {status === "in-use" && (
            <Modal.Open opens="confirmComplete">
              <Button disabled={isCheckingOut}>
                <ButtonContent>
                  <CircleCheckBig size={18} /> Complete booking
                </ButtonContent>
              </Button>
            </Modal.Open>
          )}
          {!isPaid && !isClosed && (
            <Button
              variation="secondary"
              disabled={isSettingPaid}
              onClick={() => setPaid({ bookingId, isPaid: true })}
            >
              <ButtonContent>
                <BadgeDollarSign size={18} /> Mark paid
              </ButtonContent>
            </Button>
          )}
          {!hasStarted && !isClosed && (
            <Button
              variation="secondary"
              disabled={isChangingStatus}
              onClick={() => changeStatus({ bookingId, status: "cancelled" })}
            >
              <ButtonContent>
                <CircleX size={18} /> Cancel booking
              </ButtonContent>
            </Button>
          )}
          {/* No-show stays available for any booking that has started,
              not just a 'booked' one. The reconciler advances a started
              booking to "in-use" within a minute of its start time — and
              that is an ASSUMPTION from the clock, not an observation. If
              it also hid this button, the desk could never record that
              nobody actually turned up, because the automation would
              always get there first. */}
          {hasStarted && !isClosedByDesk && (
            <Button
              variation="secondary"
              disabled={isChangingStatus}
              onClick={() => changeStatus({ bookingId, status: "no-show" })}
            >
              <ButtonContent>
                <UserX size={18} /> Mark no-show
              </ButtonContent>
            </Button>
          )}
          <Button variation="secondary" onClick={moveBack}>
            Back
          </Button>
          <Modal.Open opens="deleteBooking">
            <Button variation="danger">
              <ButtonContent>
                <Trash2 size={18} /> Delete Booking
              </ButtonContent>
            </Button>
          </Modal.Open>
        </ButtonGroup>
        <Modal.Window name="confirmComplete">
          <ConfirmComplete
            resourceName="booking"
            disabled={isCheckingOut}
            onConfirm={handleComplete}
          />
        </Modal.Window>
        <Modal.Window name="deleteBooking">
          <ConfirmDelete
            resourceName="booking"
            disabled={isDeletingBooking}
            onConfirm={handleDelete}
          />
        </Modal.Window>
      </Modal>
    </>
  );
}

export default BookingDetail;