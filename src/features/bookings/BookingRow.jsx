import styled from "styled-components";
import { format, isToday } from "date-fns";

import Tag from "../../ui/Tag";
import Table from "../../ui/Table";

import { formatCurrency } from "../../utils/helpers";
import { formatDistanceFromNow } from "../../utils/helpers";
import Menus from "../../ui/Menus";
import { CalendarCheck, CircleCheckBig, Eye, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../check-in-out/useCheckout";
import { useDeleteBooking } from "../rooms/useDeleteBooking";
import Modal from "../../ui/Modal";
import ConfirmDelete from "../../ui/ConfirmDelete";
import ConfirmComplete from "../../ui/ConfirmComplete";

const Room = styled.div`
  font-size: 1.6rem;
  font-weight: 600;
  color: var(--color-grey-600);
  font-family: "Space Grotesk";
`;

const Stacked = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;

  & span:first-child {
    font-weight: 500;
  }

  & span:last-child {
    color: var(--color-grey-500);
    font-size: 1.2rem;
  }
`;

const Amount = styled.div`
  font-family: "Space Grotesk";
  font-weight: 500;
`;

function BookingRow({
  booking: {
    id: bookingId,
    created_at,
    startTime,
    endTime,
    numHours,
    numGuests,
    totalPrice,
    status,
    guests,
    rooms,
  } = {},
}) {
  const statusToTagName = {
    booked: "yellow",
    "in-use": "coral",
    completed: "green",
    cancelled: "silver",
    "no-show": "coral",
  };

  // Safely access nested properties
  const guestName = guests?.fullName || "Guest not found";
  const email = guests?.email || "No email";
  const roomName = rooms?.name || "Room not found";
  const navigate = useNavigate();
  const { checkout, isCheckingOut } = useCheckout();
  const { isDeleting, deleteBooking } = useDeleteBooking();
  function handleComplete() {
    checkout({ bookingId });
  }
  function handleDelete() {
    deleteBooking(bookingId);
  }
  return (
    <Table.Row>
      <Room>{roomName}</Room>

      <Stacked>
        <span>{guestName}</span>
        <span>{email}</span>
      </Stacked>

      <Stacked>
        <span>
          {isToday(new Date(startTime))
            ? "Today"
            : formatDistanceFromNow(startTime)}{" "}
          &rarr; {numHours} hour{numHours !== 1 ? "s" : ""}
        </span>
        <span>
          {format(new Date(startTime), "EEE MMM dd, HH:mm")} &mdash;{" "}
          {format(new Date(endTime), "EEE MMM dd, HH:mm")}
        </span>
      </Stacked>

      <Tag type={statusToTagName[status]}>
        {status?.replace("-", " ") || "unknown"}
      </Tag>

      <Amount>{formatCurrency(totalPrice)}</Amount>
      <Modal>
        <Menus.Menu>
          <Menus.Toggle id={bookingId} />
          <Menus.List id={bookingId}>
            <Menus.Button
              icon={<Eye />}
              onClick={() => navigate(`/bookings/${bookingId}`)}
            >
              See Details
            </Menus.Button>
            {status === "booked" && (
              <Menus.Button
                onClick={() => navigate(`/checkin/${bookingId}`)}
                icon={<CalendarCheck />}
              >
                Mark in use
              </Menus.Button>
            )}
{status === "in-use" && (
              <Modal.Open opens="confirmComplete">
                <Menus.Button
                  icon={<CircleCheckBig />}
                  disabled={isCheckingOut}
                >
                  Complete
                </Menus.Button>
              </Modal.Open>
            )}
            <Modal.Open opens="deleteBooking">
              <Menus.Button icon={<Trash2 />}>Delete</Menus.Button>
            </Modal.Open>
          </Menus.List>
        </Menus.Menu>
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
            disabled={isDeleting}
            onConfirm={handleDelete}
          />
        </Modal.Window>
      </Modal>
    </Table.Row>
  );
}

export default BookingRow;
