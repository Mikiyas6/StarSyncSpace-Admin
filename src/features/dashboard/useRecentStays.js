import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getStaysAfterDate } from "../../services/apiBookings";
import { useDateRange } from "./useDateRange";

export function useRecentStays() {
  const [searchParams] = useSearchParams();
  const { startDate, endDate, numDays } = useDateRange();
  const fromStr = startDate.toISOString().slice(0, -1);
  const toStr = endDate.toISOString().slice(0, -1);

  const { isLoading, data: stays } = useQuery({
    queryFn: () => getStaysAfterDate(fromStr, toStr),
    queryKey: ["stays", fromStr, toStr, searchParams.get("last")],
  });

  const confirmedStays = stays?.filter(
    (stay) => stay.status === "in-use" || stay.status === "completed"
  );

  return { isLoading, stays, confirmedStays, startDate, endDate, numDays };
}