import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { deleteReview, setReviewStatus } from "../../services/apiReviews";
import { revalidateClientSite } from "../../services/revalidateClientSite";

/* Moving a review in or out of public view.

   Both mutations below end the same way, and the reason is worth stating
   once. The public site holds its review queries in Next's data cache
   under a `reviews` tag — flipping a row to 'published' in Supabase
   changes nothing a visitor sees until that tag is dropped, so the guest
   who wrote it is told "no reviews yet" for up to five minutes after it
   went live. /api/revalidate drops the tag AND rebuilds the paths, which
   is why every path this review could appear on is listed: the room
   page that prints it, and the rooms index.

   `revalidateClientSite` is best-effort by design — a Client site that
   is down must not make moderation fail here. The site's own 300-second
   window is the backstop. */
function afterModeration(queryClient, review, message) {
  toast.success(message);
  queryClient.invalidateQueries({ active: true });
  revalidateClientSite([`/rooms/${review.room_id}`, "/rooms"]);
}

export function useSetReviewStatus() {
  const queryClient = useQueryClient();

  const { mutate: changeReviewStatus, isLoading: isChangingReviewStatus } =
    useMutation({
      mutationFn: ({ reviewId, status }) => setReviewStatus(reviewId, status),
      onSuccess: (review) => {
        const roomName = review.rooms?.name ?? review.room_id;
        const said = {
          published: `Review published on Room ${roomName}`,
          rejected: `Review rejected — it stays off the site`,
          pending: `Review sent back to the queue`,
        }[review.status];

        afterModeration(queryClient, review, said);
      },
      onError: (err) => {
        toast.error(err.message || "The review could not be updated");
      },
    });

  return { changeReviewStatus, isChangingReviewStatus };
}

/* Deleting is for a row that should never have existed — spam, a test,
   a duplicate. Rejecting is the normal "no": it keeps the record, keeps
   the one-review-per-booking lock, and keeps the guest from silently
   writing the same thing again. Prefer reject; this is the other one. */
export function useDeleteReview() {
  const queryClient = useQueryClient();

  const { mutate: removeReview, isLoading: isDeletingReview } = useMutation({
    mutationFn: (reviewId) => deleteReview(reviewId),
    onSuccess: (review) => {
      afterModeration(queryClient, review, "Review deleted");
    },
    onError: (err) => {
      toast.error(err.message || "The review could not be deleted");
    },
  });

  return { removeReview, isDeletingReview };
}
