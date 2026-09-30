import { Plus } from "lucide-react";
import Filter from "../../ui/Filter";
import TableOperations from "../../ui/TableOperations";

import AddRoom from "./AddRoom";
import SortBy from "../../ui/SortBy";
import { ButtonContent } from "../../ui/Button";
function RoomTableOperations() {
  return (
    <TableOperations>
      <Filter
        filterField="discount"
        options={[
          { value: "all", label: "All" },
          { value: "no-discount", label: "No discount" },
          { value: "with-discount", label: "With discount" },
        ]}
      />
      <SortBy
        options={[
          { value: "name-asc", label: "Sort by name (A-Z)" },
          { value: "name-desc", label: "Sort by name (Z-A)" },
          /* hour_rate_rwf, not the retired "regularPrice" — which was
             0 on every shared space, so sorting by price used to put
             the desks together at one end regardless of what they
             cost. */
          { value: "hour_rate_rwf-asc", label: "Sort by price (low first) " },
          { value: "hour_rate_rwf-desc", label: "Sort by price (high first)" },
          { value: "maxCapacity-asc", label: "Sort by capacity (low first)" },
          { value: "maxCapacity-desc", label: "Sort by capacity (high first)" },
        ]}
      />

      <AddRoom>
        <ButtonContent>
          <Plus />
          Add room
        </ButtonContent>
      </AddRoom>
    </TableOperations>
  );
}

export default RoomTableOperations;
