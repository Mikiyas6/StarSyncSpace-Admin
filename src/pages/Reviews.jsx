import Heading from "../ui/Heading";
import Row from "../ui/Row";
import ReviewTable from "../features/reviews/ReviewTable";
import ReviewTableOperations from "../features/reviews/ReviewTableOperations";

function Reviews() {
  return (
    <>
      <Row type="horizontal">
        <Heading as="h1">Guest reviews</Heading>
        <ReviewTableOperations />
      </Row>
      <ReviewTable />
    </>
  );
}

export default Reviews;
