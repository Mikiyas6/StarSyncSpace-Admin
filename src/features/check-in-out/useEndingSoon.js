import { useQuery } from "@tanstack/react-query";
import { getEndingSoonBookings } from "../../services/apiBookings";

export function useEndingSoon() {
  const { data: endingSoon, isLoading } = useQuery({
    queryKey: ["ending-soon"],
    queryFn: getEndingSoonBookings,
    refetchInterval: 60 * 1000,
  });
  return { endingSoon, isLoading };
}