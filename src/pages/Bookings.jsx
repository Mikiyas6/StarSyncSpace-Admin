import Heading from "../ui/Heading";
import Row from "../ui/Row";
import BookingTable from "../features/bookings/BookingTable";
import BookingTableOperations from "../features/bookings/BookingTableOperations";
import AddBooking from "../features/bookings/AddBooking";
import { useReconcileStatuses } from "../features/bookings/useReconcileStatuses";

function Bookings() {
  // Bring statuses up to date with the clock before the table renders
  // them — see useReconcileStatuses for what is automatic and what stays
  // the desk's call.
  useReconcileStatuses();

  return (
    <>
      <Row type="horizontal">
        <Heading as="h1">All bookings</Heading>
        <BookingTableOperations />
      </Row>
      <Row type="horizontal">
        <span />
        <AddBooking />
      </Row>
      <BookingTable />
    </>
  );
}

export default Bookings;
