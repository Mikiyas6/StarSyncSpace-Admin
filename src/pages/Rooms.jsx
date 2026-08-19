import Heading from "../ui/Heading";
import Row from "../ui/Row";
import RoomTable from "../features/rooms/RoomTable";
import AddRoom from "../features/rooms/AddRoom";
import RoomTableOperations from "../features/rooms/RoomTableOperations";
import { Plus } from "lucide-react";
import { ButtonContent } from "../ui/Button";

function Rooms() {
  return (
    <>
      <Row type="horizontal">
        <Heading as="h1">All rooms</Heading>
        <RoomTableOperations />
      </Row>
      <Row>
        <RoomTable />
        <AddRoom>
          <ButtonContent>
            <Plus />
            Add room
          </ButtonContent>
        </AddRoom>
      </Row>
    </>
  );
}

export default Rooms;
