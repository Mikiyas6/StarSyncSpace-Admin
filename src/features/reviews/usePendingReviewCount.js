import { useQuery } from "@tanstack/react-query";

import { getPendingReviewCount } from "../../services/apiReviews";

/* The badge in the sidebar. Its only job is to stop reviews sitting
   unread — nobody visits a moderation queue they have no reason to
   think has anything in it. */
export function usePendingReviewCount() {
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["reviews", "pending-count"],
    queryFn: getPendingReviewCount,
  });

  return { pendingCount };
}
