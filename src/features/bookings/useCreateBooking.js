import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createBookingApi } from "../../services/apiBookings";
import { revalidateClientSite } from "../../services/revalidateClientSite";

export function useCreateBooking() {
  const queryClient = useQueryClient();

  const { mutate: createBooking, isLoading: isCreating } = useMutation({
    mutationFn: createBookingApi,
    onSuccess: (booking) => {
      toast.success(
        `Booking #${booking.id} created for ${
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
