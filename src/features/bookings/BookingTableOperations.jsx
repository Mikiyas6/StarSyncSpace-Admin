import SortBy from "../../ui/SortBy";
import Filter from "../../ui/Filter";
import TableOperations from "../../ui/TableOperations";

function BookingTableOperations() {
  return (
    <TableOperations>
      <Filter
        filterField="status"
        /* "pending" and "failed" were missing, so payment holds and
           failed payments were unreachable from this dashboard even
           though a pending hold BLOCKS the room — the only way to see
           why a room looked busy was to read the database. */
        options={[
          { value: "all", label: "All" },
          { value: "pending", label: "Pending payment" },
          { value: "booked", label: "Booked" },
          { value: "in-use", label: "In use" },
          { value: "completed", label: "Completed" },
          { value: "cancelled", label: "Cancelled" },
          { value: "no-show", label: "No-show" },
          { value: "failed", label: "Payment failed" },
        ]}
      />

      <SortBy
        options={[
          { value: "startTime-desc", label: "Sort by start (recent first)" },
          { value: "startTime-asc", label: "Sort by start (earlier first)" },
          {
            value: "totalPrice-desc",
            label: "Sort by amount (high first)",
          },
          { value: "totalPrice-asc", label: "Sort by amount (low first)" },
        ]}
      />
    </TableOperations>
  );
}

export default BookingTableOperations;
