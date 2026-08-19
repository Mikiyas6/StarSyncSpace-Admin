import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateBooking } from "../../services/apiBookings";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

export function useCheckin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { mutate: checkin, isLoading: isCheckingIn } = useMutation({
    queryKey: ["checkin"],
    mutationFn: ({ bookingId }) =>
      updateBooking(bookingId, {
        status: "in-use",
        isPaid: true,
      }),
    onSuccess: (data) => {
      toast.success(`Booking #${data.id} is now in use`);
      queryClient.invalidateQueries({ active: true });
      navigate("/");
    },
    onError: () => {
      toast.error("An error occurred while marking the booking in use");
    },
  });

  return { isCheckingIn, checkin };
}
