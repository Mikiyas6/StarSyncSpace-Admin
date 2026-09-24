import styled from "styled-components";
import { format } from "date-fns";
import { Star, CircleCheckBig, CircleSlash, Trash2, Undo2 } from "lucide-react";

import Table from "../../ui/Table";
import Tag from "../../ui/Tag";
import Menus from "../../ui/Menus";
import Modal from "../../ui/Modal";
import ConfirmDelete from "../../ui/ConfirmDelete";
import { useDeleteReview, useSetReviewStatus } from "./useReviewStatus";

const STATUS_TAG = {
  pending: "yellow",
  published: "green",
  rejected: "silver",
};

const Room = styled.div`
  font-size: 1.6rem;
  font-weight: 600;
  color: var(--color-grey-600);
  font-family: "Space Grotesk";
`;

const Stacked = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;

  & span:first-child {
    font-weight: 500;
  }

  & span:last-child {
    color: var(--color-grey-500);
    font-size: 1.2rem;
  }
`;

const Stars = styled.div`
  display: flex;
  align-items: center;
  gap: 0.2rem;

  & svg {
    width: 1.6rem;
    height: 1.6rem;
  }

  & svg.on {
    fill: var(--color-yellow-700);
    color: var(--color-yellow-700);
  }

  & svg.off {
    color: var(--color-grey-300);
  }
`;

/* The review itself, which is the thing being judged, so it is not
   truncated to a single line: a moderator cannot approve what they
   cannot read. */
const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-width: 52ch;

  & strong {
    font-weight: 600;
    color: var(--color-grey-700);
  }

  & p {
    color: var(--color-grey-500);
    font-size: 1.3rem;
    line-height: 1.5;
  }
`;

function ReviewRow({ review }) {
  const {
    id: reviewId,
    rating,
    title,
    body,
    status,
    created_at,
    author_name,
    rooms,
    guests,
  } = review;

  const { changeReviewStatus, isChangingReviewStatus } = useSetReviewStatus();
  const { removeReview, isDeletingReview } = useDeleteReview();

  return (
    <Table.Row>
      <Room>{rooms?.name ?? "Room not found"}</Room>

      <Stacked>
        <span>{author_name || guests?.fullName || "Guest"}</span>
        <span>{guests?.email ?? "No email"}</span>
      </Stacked>

      <Stars title={`${rating} out of 5`}>
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={i < rating ? "on" : "off"} strokeWidth={1.5} />
        ))}
      </Stars>

      <Body>
        {title ? <strong>{title}</strong> : null}
        <p>{body}</p>
      </Body>

      <Stacked>
        <span>{format(new Date(created_at), "MMM dd yyyy")}</span>
        <span>{format(new Date(created_at), "HH:mm")}</span>
      </Stacked>

      <Tag type={STATUS_TAG[status] ?? "silver"}>{status}</Tag>

      <Modal>
        <Menus.Menu>
          <Menus.Toggle id={reviewId} />
          <Menus.List id={reviewId}>
            {status !== "published" && (
              <Menus.Button
                icon={<CircleCheckBig />}
                disabled={isChangingReviewStatus}
                onClick={() =>
                  changeReviewStatus({ reviewId, status: "published" })
                }
              >
                Publish
              </Menus.Button>
            )}

            {status !== "rejected" && (
              <Menus.Button
                icon={<CircleSlash />}
                disabled={isChangingReviewStatus}
                onClick={() =>
                  changeReviewStatus({ reviewId, status: "rejected" })
                }
              >
                {status === "published" ? "Unpublish" : "Reject"}
              </Menus.Button>
            )}

            {status !== "pending" && (
              <Menus.Button
                icon={<Undo2 />}
                disabled={isChangingReviewStatus}
                onClick={() =>
                  changeReviewStatus({ reviewId, status: "pending" })
                }
              >
                Back to queue
              </Menus.Button>
            )}

            <Modal.Open opens="deleteReview">
              <Menus.Button icon={<Trash2 />}>Delete</Menus.Button>
            </Modal.Open>
          </Menus.List>
        </Menus.Menu>

        <Modal.Window name="deleteReview">
          <ConfirmDelete
            resourceName="review"
            disabled={isDeletingReview}
            onConfirm={() => removeReview(reviewId)}
          />
        </Modal.Window>
      </Modal>
    </Table.Row>
  );
}

export default ReviewRow;
