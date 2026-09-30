import Heading from "../ui/Heading";
import Row from "../ui/Row";
import RoomTable from "../features/rooms/RoomTable";
import AddRoom from "../features/rooms/AddRoom";
import RoomTableOperations from "../features/rooms/RoomTableOperations";
import AvailabilitySearch from "../features/rooms/AvailabilitySearch";
import { useAvailabilitySearch } from "../features/rooms/useAvailabilitySearch";
import { Plus } from "lucide-react";
import { ButtonContent } from "../ui/Button";
import { useAdminRole } from "../features/authentication/useAdminRole";

/* The page answers two different questions, and only one of them at a
   time. Normally it is a list of rooms — to manage, for an admin, and
   simply to read for staff — sorted and filtered by the controls beside
   the heading. Once somebody asks what is free at four, none of those
   controls mean anything: the board is ordered by what can be sold, not
   by price, and a discount filter has nothing to say about availability.

   So the search takes the page over while it is running, and the "Close"
   button on the panel gives it back. Both states are driven by the same
   URL, so a reload lands on whichever one the admin was in. */
function Rooms() {
  const { isActive } = useAvailabilitySearch();
  const { can } = useAdminRole();

  return (
    <>
      <Row type="horizontal">
        <Heading as="h1">{isActive ? "Availability" : "All rooms"}</Heading>
        {isActive ? null : <RoomTableOperations />}
      </Row>

      <AvailabilitySearch />

      {isActive ? null : (
        <Row>
          <RoomTable />
          {/* Staff read this page to answer "what have we got, and what
              is free" — they do not add rooms. The list and the
              availability search above are the whole page for them. */}
          {can.manageRooms ? (
            <AddRoom>
              <ButtonContent>
                <Plus />
                Add room
              </ButtonContent>
            </AddRoom>
          ) : null}
        </Row>
      )}
    </>
  );
}

export default Rooms;
