import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateBooking } from "../../services/apiBookings";
import toast from "react-hot-toast";

export function useCheckout() {
  const queryClient = useQueryClient();
  const { mutate: checkout, isLoading: isCheckingOut } = useMutation({
    queryKey: ["checkout"],
    mutationFn: ({ bookingId }) =>
      updateBooking(bookingId, {
        status: "completed",
      }),
    onSuccess: (data) => {
      toast.success(`Booking #${data.id} completed`);
      queryClient.invalidateQueries({ active: true });
    },
    onError: () => {
      toast.error("An error occurred while completing the booking");
    },
  });

  return { isCheckingOut, checkout };
}
