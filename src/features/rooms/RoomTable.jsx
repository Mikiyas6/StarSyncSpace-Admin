import Spinner from "../../ui/Spinner";
import RoomRow from "./RoomRow";
import { useRooms } from "./useRooms";
import Table from "../../ui/Table";
import Menus from "../../ui/Menus";
import { useSearchParams } from "react-router-dom";
import Empty from "../../ui/Empty";

function RoomTable() {
  const { isLoading, rooms } = useRooms();
  const [searchParams] = useSearchParams();
  if (isLoading) return <Spinner />;
  if (!rooms.length) return <Empty resourceName="rooms" />;
  //1.Filter
  const filterValue = searchParams.get("discount") || "all";
  let filteredRooms;
  if (filterValue === "all") filteredRooms = rooms;
  else if (filterValue === "no-discount")
    filteredRooms = rooms.filter((room) => room.discount === 0);
  else if (filterValue === "with-discount")
    filteredRooms = rooms.filter((room) => room.discount > 0);
  //2.Sort
  const sortBy = searchParams.get("sortBy") || "name-asc";
  const [field, direction] = sortBy.split("-");
  const modifier = direction === "asc" ? 1 : -1;
  const sortedRooms = [...filteredRooms].sort((a, b) => {
    if (typeof a[field] === "string")
      return a[field].localeCompare(b[field]) * modifier;
    return (a[field] - b[field]) * modifier;
  });
  return (
    <Menus>
      {/* The photo column is a fixed width because it holds a fixed-size
          thumbnail; everything after it shares what is left. */}
      <Table columns="8.8rem 2.6fr 1.3fr 1.2fr 0.8fr 3.2rem">
        <Table.Header>
          <div>Photo</div>
          <div>Room</div>
          <div>Capacity</div>
          <div>Price</div>
          <div>Discount</div>
          <div></div>
        </Table.Header>
        <Table.Body
          data={sortedRooms}
          render={(room) => <RoomRow room={room} key={room.id} />}
        />
      </Table>
    </Menus>
  );
}

export default RoomTable;
