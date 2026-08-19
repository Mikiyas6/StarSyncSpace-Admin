import { useQuery } from "@tanstack/react-query";
import { getBookingsAfterDate } from "../../services/apiBookings";
import { useDateRange } from "./useDateRange";

export function useRecentBookings() {
  const { startDate, endDate } = useDateRange();
  const fromStr = startDate.toISOString().slice(0, -1);
  const toStr = endDate.toISOString().slice(0, -1);

  const {
    isLoading,
    data: bookings,
    error,
  } = useQuery({
    queryFn: () => getBookingsAfterDate(fromStr, toStr),
    queryKey: ["bookings", fromStr, toStr],
  });
  return { isLoading, bookings, error };
}