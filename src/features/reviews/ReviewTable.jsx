import Table from "../../ui/Table";
import Menus from "../../ui/Menus";
import Empty from "../../ui/Empty";
import Spinner from "../../ui/Spinner";
import Pagination from "../../ui/Pagination";
import ReviewRow from "./ReviewRow";
import { useReviews } from "./useReviews";

function ReviewTable() {
  const { isLoading, reviews, error, count } = useReviews();

  if (isLoading) return <Spinner />;
  if (error) return <div>Error loading reviews</div>;
  if (!reviews?.length) return <Empty resourceName="reviews" />;

  return (
    <Menus>
      <Table columns="1fr 1.8fr 1fr 3fr 1fr 1fr 3.2rem">
        <Table.Header>
          <div>Room</div>
          <div>Guest</div>
          <div>Rating</div>
          <div>Review</div>
          <div>Written</div>
          <div>Status</div>
          <div></div>
        </Table.Header>

        <Table.Body
          data={reviews}
          render={(review) => <ReviewRow key={review.id} review={review} />}
        />

        <Table.Footer>
          <Pagination count={count} />
        </Table.Footer>
      </Table>
    </Menus>
  );
}

export default ReviewTable;
