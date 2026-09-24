import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { getReviews } from "../../services/apiReviews";
import { PAGE_SIZE } from "../../utils/constants";

export function useReviews() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  /* Pending first by default: the queue exists to be emptied, so the
     landing view is the work, not the archive. */
  const filterValue = searchParams.get("status") || "pending";
  const filter =
    filterValue === "all"
      ? null
      : { field: "status", value: filterValue, method: "eq" };

  const sortByRaw = searchParams.get("sortBy") || "created_at-desc";
  const [field, direction] = sortByRaw.split("-");
  const sortBy = { field, direction };

  const page = Number(searchParams.get("page")) || 1;

  const {
    isLoading,
    data: { data: reviews, count } = {},
    error,
  } = useQuery({
    queryKey: ["reviews", filter, sortBy, page],
    queryFn: () => getReviews(filter, sortBy, page),
  });

  const pageCount = Math.ceil((count ?? 0) / PAGE_SIZE);

  if (page < pageCount) {
    queryClient.prefetchQuery({
      queryKey: ["reviews", filter, sortBy, page + 1],
      queryFn: () => getReviews(filter, sortBy, page + 1),
    });
  }
  if (page > 1) {
    queryClient.prefetchQuery({
      queryKey: ["reviews", filter, sortBy, page - 1],
      queryFn: () => getReviews(filter, sortBy, page - 1),
    });
  }

  return { isLoading, reviews, error, count };
}
