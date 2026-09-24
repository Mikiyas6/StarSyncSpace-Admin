import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  setBookingPaid,
  setBookingStatus,
} from "../../services/apiBookings";
import { revalidateClientSite } from "../../services/revalidateClientSite";
import { statusLabel } from "../../utils/booking";

/* The two status changes nothing else in the system will ever make.

   Cancelling and no-show are statements about what a person did, so the
   clock-driven reconciler deliberately refuses to guess at them (see
   derivedStatus in utils/booking.js). Until now there was no way to make
   either statement at all: both statuses were filterable and had a
   colour in the tag map, but no code path anywhere wrote them. A booking
   called off by phone had to be deleted, which destroyed the record. */
export function useSetBookingStatus() {
  const queryClient = useQueryClient();

  const { mutate: changeStatus, isLoading: isChangingStatus } = useMutation({
    mutationFn: ({ bookingId, status }) => setBookingStatus(bookingId, status),
    onSuccess: (booking) => {
      toast.success(
        `Booking #${booking.id} marked ${statusLabel(
          booking.status,
        ).toLowerCase()}`,
      );
      queryClient.invalidateQueries({ active: true });
      // Cancelling and no-show both RELEASE the room, so the public
      // site's cached availability is now wrong until it is told.
      revalidateClientSite([`/rooms/${booking.roomId}`, "/rooms", "/"]);
    },
    onError: (err) => {
      toast.error(err.message || "The status could not be changed");
    },
  });

  return { changeStatus, isChangingStatus };
}

export function useSetBookingPaid() {
  const queryClient = useQueryClient();

  const { mutate: setPaid, isLoading: isSettingPaid } = useMutation({
    mutationFn: ({ bookingId, isPaid }) => setBookingPaid(bookingId, isPaid),
    onSuccess: (booking) => {
      toast.success(
        booking.isPaid
          ? `Booking #${booking.id} marked paid`
          : `Booking #${booking.id} marked unpaid`,
      );
      queryClient.invalidateQueries({ active: true });
    },
    onError: (err) => {
      toast.error(err.message || "The payment flag could not be changed");
    },
  });

  return { setPaid, isSettingPaid };
}
