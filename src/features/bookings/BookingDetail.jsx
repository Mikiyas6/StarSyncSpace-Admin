import styled from "styled-components";

import BookingDataBox from "./BookingDataBox";
import Row from "../../ui/Row";
import Heading from "../../ui/Heading";
import Tag from "../../ui/Tag";
import ButtonGroup from "../../ui/ButtonGroup";
import Button from "../../ui/Button";
import ButtonText from "../../ui/ButtonText";

import { useMoveBack } from "../../hooks/useMoveBack";
import { useBooking } from "./useBooking";
import Spinner from "../../ui/Spinner";
import { CircleCheckBig, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../check-in-out/useCheckout";
import Modal from "../../ui/Modal";
import Menus from "../../ui/Menus";
import ConfirmDelete from "../../ui/ConfirmDelete";
import ConfirmComplete from "../../ui/ConfirmComplete";
import { useDeleteBooking } from "../rooms/useDeleteBooking";
import Empty from "../../ui/Empty";

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
  if (!booking) return <Empty resourceName="booking" />;
  const { status, id: bookingId } = booking;
  if (isLoading || isDeletingBooking) return <Spinner />;

  const statusToTagName = {
    booked: "yellow",
    "in-use": "coral",
    completed: "green",
    cancelled: "silver",
    "no-show": "coral",
  };
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
          <Tag type={statusToTagName[status]}>{status.replace("-", " ")}</Tag>
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
              <Button
                icon={<CircleCheckBig />}
                disabled={isCheckingOut}
              >
                Complete booking
              </Button>
            </Modal.Open>
          )}
          <Button variation="secondary" onClick={moveBack}>
            Back
          </Button>
          <Modal.Open opens="deleteBooking">
            <Button variation="danger" icon={<Trash2 />}>
              Delete Booking
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