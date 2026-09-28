import { useMemo } from "react";
import styled from "styled-components";
import { PackagePlus, TriangleAlert } from "lucide-react";

import Heading from "../../ui/Heading";
import Row from "../../ui/Row";
import Table from "../../ui/Table";
import Tag from "../../ui/Tag";
import Menus from "../../ui/Menus";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import Empty from "../../ui/Empty";
import Spinner from "../../ui/Spinner";
import InventoryRow from "./InventoryRow";
import AddStockItemForm from "./AddStockItemForm";
import StockTotals from "./StockTotals";
import { useInventory } from "./useInventory";
import { useAdminRole } from "../authentication/useAdminRole";
import { useRooms } from "../rooms/useRooms";
import { isLowStock } from "../../utils/stock";

const RoomBlock = styled.section`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  margin-bottom: 3.2rem;
`;

const RoomHead = styled.div`
  display: flex;
  align-items: center;
  gap: 1.2rem;
  flex-wrap: wrap;

  & h3 {
    font-size: 1.8rem;
    font-weight: 600;
  }
`;

const Spacer = styled.div`
  margin-left: auto;
`;

const LowBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 1.2rem;
  padding: 1.2rem 1.6rem;
  border-radius: var(--border-radius-md);
  background-color: var(--color-yellow-100);
  color: var(--color-yellow-700);
  font-size: 1.4rem;
  font-weight: 500;

  & svg {
    width: 2rem;
    height: 2rem;
    flex-shrink: 0;
  }
`;

const Note = styled.p`
  color: var(--color-grey-500);
  font-size: 1.4rem;
  max-width: 82ch;
`;

const EmptyRoom = styled.p`
  color: var(--color-grey-500);
  font-size: 1.4rem;
  padding: 1.6rem 2.4rem;
  background-color: var(--color-grey-0);
  border: 1px dashed var(--color-grey-200);
  border-radius: var(--border-radius-sm);
`;

/* ------------------------------------------------------------------
   What is in every fridge and on every shelf, room by room.

   Grouped by ROOM rather than by item, because the question this screen
   answers is the one somebody asks while standing in a doorway: what does
   this room need? An item-first list would answer "how many Cokes do we
   own", which nobody is ever about to act on.
   ------------------------------------------------------------------ */
function InventoryPage() {
  const { stock, isLoading, error } = useInventory();
  const { rooms, isLoading: isLoadingRooms } = useRooms();
  const { isAdmin, can } = useAdminRole();

  const byRoom = useMemo(() => {
    const groups = new Map();

    /* Seeded from the ROOM list, not from the stock rows, so a room that
       carries nothing yet still gets a heading and an invitation rather
       than silently not existing — which would leave an admin with no way
       to add the first item to it. */
    for (const room of rooms ?? []) {
      groups.set(room.id, { room, rows: [] });
    }

    for (const row of stock) {
      if (!groups.has(row.roomId)) {
        // A stock row for a room the room list does not have: archived,
        // most likely. Shown rather than dropped, because stock that
        // exists has to be visible to be dealt with.
        groups.set(row.roomId, {
          room: { id: row.roomId, name: row.roomName, room_type: row.roomType },
          rows: [],
        });
      }
      groups.get(row.roomId).rows.push(row);
    }

    return [...groups.values()].sort((a, b) =>
      String(a.room.name).localeCompare(String(b.room.name)),
    );
  }, [stock, rooms]);

  const lowRows = stock.filter(isLowStock);

  if (isLoading || isLoadingRooms) return <Spinner />;

  /* The likely failure is a specific, fixable one — the migration has not
     been run — and the service already phrases it as an instruction. */
  if (error)
    return (
      <>
        <Heading as="h1">Inventory</Heading>
        <Note>{error.message}</Note>
      </>
    );

  return (
    <>
      <Row type="horizontal">
        <Heading as="h1">Inventory</Heading>
        {lowRows.length > 0 ? (
          <Tag type="yellow">{lowRows.length} need restocking</Tag>
        ) : (
          <Tag type="green">Everything stocked</Tag>
        )}
      </Row>

      <Note>
        Every item here is a menu item that is kept as physical stock, counted
        per room.{" "}
        <strong>Selling</strong> an item reduces the count and adds to the
        day&apos;s takings; <strong>removing</strong> or{" "}
        <strong>writing off</strong> an item reduces the count and leaves sales
        completely alone. Both are recorded, so the two can never be confused
        after the fact.
        {!isAdmin ? (
          <>
            {" "}
            Restocking and stock targets are admin-only.
          </>
        ) : null}
      </Note>

      {lowRows.length > 0 ? (
        <LowBanner>
          <TriangleAlert />
          <span>
            {lowRows.length === 1
              ? "1 item is at or below its target"
              : `${lowRows.length} items are at or below their target`}
            :{" "}
            {lowRows
              .slice(0, 6)
              .map((row) => `${row.name} (${row.roomName}, ${row.quantity})`)
              .join(", ")}
            {lowRows.length > 6 ? `, and ${lowRows.length - 6} more` : ""}
          </span>
        </LowBanner>
      ) : null}

      {/* The building-wide view first, then room by room. "Do we need to
          buy more Vitalo" is answered by the total; "what does this room
          need" is answered below it. */}
      <StockTotals stock={stock} />

      {byRoom.map(({ room, rows }) => (
        <RoomBlock key={room.id}>
          <RoomHead>
            <Heading as="h3">{room.name}</Heading>
            <Tag type={room.room_type === "shared_space" ? "indigo" : "silver"}>
              {room.room_type === "shared_space" ? "Shared space" : "Meeting room"}
            </Tag>
            {rows.filter(isLowStock).length > 0 ? (
              <Tag type="yellow">
                {rows.filter(isLowStock).length} low
              </Tag>
            ) : null}

            {can.manageStock ? (
              <Spacer>
                <Modal>
                  <Modal.Open opens={`add-${room.id}`}>
                    <Button size="small" variation="secondary">
                      <PackagePlus
                        style={{ width: "1.6rem", height: "1.6rem" }}
                      />
                      Add an item
                    </Button>
                  </Modal.Open>
                  <Modal.Window name={`add-${room.id}`}>
                    <AddStockItemForm room={room} alreadyStocked={rows} />
                  </Modal.Window>
                </Modal>
              </Spacer>
            ) : null}
          </RoomHead>

          {rows.length === 0 ? (
            <EmptyRoom>
              Nothing is stocked in {room.name} yet.
              {can.manageStock
                ? " Use “Add an item” to say what it should carry."
                : " An admin can add items to it."}
            </EmptyRoom>
          ) : (
            <Menus>
              <Table columns="2.6fr 1fr 0.9fr 1fr 1.1fr 1.6fr">
                <Table.Header>
                  <div>Item</div>
                  <div>Price &amp; margin</div>
                  <div>In stock</div>
                  <div>State</div>
                  <div>Target</div>
                  <div></div>
                </Table.Header>

                <Table.Body
                  data={[...rows].sort((a, b) => {
                    /* What needs attention first. Sorting alphabetically
                       would bury the empty shelf below the full one. */
                    const urgency = Number(isLowStock(b)) - Number(isLowStock(a));
                    return urgency !== 0
                      ? urgency
                      : String(a.name).localeCompare(String(b.name));
                  })}
                  render={(row) => <InventoryRow key={row.id} row={row} />}
                />
              </Table>
            </Menus>
          )}
        </RoomBlock>
      ))}

      {byRoom.length === 0 ? <Empty resourceName="rooms" /> : null}
    </>
  );
}

export default InventoryPage;
