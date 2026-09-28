import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  createBookingApi,
  createSeatBookingApi,
} from "../../services/apiBookings";
import { revalidateClientSite } from "../../services/revalidateClientSite";
import { isSharedSpacePass } from "../../utils/spaces";

export function useCreateBooking() {
  const queryClient = useQueryClient();

  const { mutate: createBooking, isLoading: isCreating } = useMutation({
    /* One hook, two writers. Which one is decided by the payload rather
       than by the caller choosing a hook, so the form does not have to
       hold two mutations and keep their loading states in step — and so
       that everything AFTER the write (the toast, the cache
       invalidation, pushing the public site's cache over) happens
       identically for a room and for a desk. Forgetting one of those on
       one path is exactly how a room stays bookable online after it has
       been sold at the counter. */
    mutationFn: (payload) =>
      isSharedSpacePass(payload.passType)
        ? createSeatBookingApi(payload)
        : createBookingApi(payload),

    onSuccess: (booking) => {
      const seats = Number(booking.seats) || 1;
      const isDesk = isSharedSpacePass(booking.pass_type);

      toast.success(
        isDesk
          ? `${seats} desk${seats === 1 ? "" : "s"} in ${
              booking.rooms?.name ?? "the space"
            } for ${booking.guests?.fullName ?? "the guest"}`
          : `Booking #${booking.id} created for ${
              booking.guests?.fullName ?? "the guest"
            }`,
      );
      queryClient.invalidateQueries({ active: true });
      // The public site caches each room's availability, so a booking
      // taken at the desk has to push that cache over or the room keeps
      // showing the slot as free to everyone online.
      revalidateClientSite([`/rooms/${booking.roomId}`, "/rooms", "/"]);
    },
    onError: (err) => {
      toast.error(err.message || "The booking could not be created");
    },
  });

  return { createBooking, isCreating };
}
