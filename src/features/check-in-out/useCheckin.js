import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateBooking } from "../../services/apiBookings";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

export function useCheckin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { mutate: checkin, isLoading: isCheckingIn } = useMutation({
    queryKey: ["checkin"],
    // A booking that already started has been moved to "in-use" by the
    // reconciler; forcing the status back would be wrong for one that has
    // meanwhile finished. Only the payment flag is unconditional here.
    mutationFn: ({ bookingId, alreadyRunning = false }) =>
      updateBooking(
        bookingId,
        alreadyRunning ? { isPaid: true } : { status: "in-use", isPaid: true },
      ),
    onSuccess: (data) => {
      toast.success(
        data.status === "in-use"
          ? `Booking #${data.id} is now in use`
          : `Booking #${data.id} marked paid`,
      );
      queryClient.invalidateQueries({ active: true });
      navigate("/");
    },
    onError: () => {
      toast.error("An error occurred while marking the booking in use");
    },
  });

  return { isCheckingIn, checkin };
}
