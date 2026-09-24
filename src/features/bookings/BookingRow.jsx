import styled from "styled-components";
import { format, isToday } from "date-fns";

import Tag from "../../ui/Tag";
import Table from "../../ui/Table";

import { formatCurrency } from "../../utils/helpers";
import { formatDistanceFromNow } from "../../utils/helpers";
import Menus from "../../ui/Menus";
import {
  BadgeDollarSign,
  CalendarCheck,
  CircleCheckBig,
  CircleX,
  Eye,
  Trash2,
  UserX,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "../check-in-out/useCheckout";
import { useDeleteBooking } from "../rooms/useDeleteBooking";
import Modal from "../../ui/Modal";
import ConfirmDelete from "../../ui/ConfirmDelete";
import ConfirmComplete from "../../ui/ConfirmComplete";
import {
  bookingMinutes,
  formatDuration,
  statusLabel,
  statusTag,
} from "../../utils/booking";
import { useSetBookingPaid, useSetBookingStatus } from "./useBookingStatus";

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
    isPaid,
    guests,
    rooms,
  } = {},
}) {

  // Safely access nested properties
  const guestName = guests?.fullName || "Guest not found";
  const email = guests?.email || "No email";
  const roomName = rooms?.name || "Room not found";
  const navigate = useNavigate();
  const { checkout, isCheckingOut } = useCheckout();
  // useDeleteBooking exports `isDeletingBooking`. This used to destructure
  // `isDeleting`, which is simply not a key it returns — so the confirm
  // button was never disabled and a second click fired a second delete.
  const { isDeletingBooking, deleteBooking } = useDeleteBooking();
  const { changeStatus, isChangingStatus } = useSetBookingStatus();
  const { setPaid, isSettingPaid } = useSetBookingPaid();

  const hasStarted = new Date(startTime) <= new Date();
  const isClosed =
    status === "completed" || status === "cancelled" || status === "no-show";
  // Cancelled and no-show are the desk's own verdicts; "completed" is
  // usually just the clock's, so it does not close the door on no-show.
  const isClosedByDesk = status === "cancelled" || status === "no-show";

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
          &rarr; {formatDuration(bookingMinutes({ startTime, endTime, numHours }))}
        </span>
        <span>
          {format(new Date(startTime), "EEE MMM dd, HH:mm")} &mdash;{" "}
          {format(new Date(endTime), "EEE MMM dd, HH:mm")}
        </span>
      </Stacked>

      {/* statusTag() falls back to a real colour for any status the map
          does not know. The inline map here had no entry for "pending" or
          "failed", so those rows rendered var(--color-undefined-700) —
          an invalid custom property, i.e. an unstyled tag. */}
      <Tag type={statusTag(status)}>{statusLabel(status)}</Tag>

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
            {!isPaid && !isClosed && (
              <Menus.Button
                icon={<BadgeDollarSign />}
                disabled={isSettingPaid}
                onClick={() => setPaid({ bookingId, isPaid: true })}
              >
                Mark paid
              </Menus.Button>
            )}
            {/* Cancel is for a booking called off BEFORE it started;
                no-show for one nobody turned up to. Neither is ever set
                automatically, and until now neither could be set at all. */}
            {!hasStarted && !isClosed && (
              <Menus.Button
                icon={<CircleX />}
                disabled={isChangingStatus}
                onClick={() => changeStatus({ bookingId, status: "cancelled" })}
              >
                Cancel booking
              </Menus.Button>
            )}
            {/* No-show stays available for any booking that has started,
                not just a 'booked' one. The reconciler advances a started
                booking to "in-use" within a minute of its start time — and
                that is an ASSUMPTION from the clock, not an observation. If
                it also hid this button, the desk could never record that
                nobody actually turned up, because the automation would
                always get there first. */}
            {hasStarted && !isClosedByDesk && (
              <Menus.Button
                icon={<UserX />}
                disabled={isChangingStatus}
                onClick={() => changeStatus({ bookingId, status: "no-show" })}
              >
                Mark no-show
              </Menus.Button>
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
            disabled={isDeletingBooking}
            onConfirm={handleDelete}
          />
        </Modal.Window>
      </Modal>
    </Table.Row>
  );
}

export default BookingRow;
