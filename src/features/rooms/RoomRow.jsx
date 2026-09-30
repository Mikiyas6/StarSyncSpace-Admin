import styled, { css } from "styled-components";
import { formatRwfAmount } from "../../utils/helpers";
import { isSharedSpace } from "../../utils/spaces";
import { rwfPerMinuteFromRoom } from "../../utils/booking";
import { useFxRate } from "../fx/useFxRate";
import CreateRoomForm from "./CreateRoomForm";
import { useDeleteRoom } from "./useDeleteRoom";
import { Copy, ImageOff, Pencil, Trash2, Users } from "lucide-react";
import { useCreateRoom } from "./useCreateRoom";
import ConfirmDelete from "../../ui/ConfirmDelete";
import Modal from "../../ui/Modal";
import Table from "../../ui/Table";
import Tag from "../../ui/Tag";
import Menus from "../../ui/Menus";
import Button from "../../ui/Button";
import { useAdminRole } from "../authentication/useAdminRole";

/* ------------------------------------------------------------------
   One room, as a row.

   The photo was rendered as a bare <img> with no size on it at all —
   the styled `Img` below it was written and then never used, so every
   row was as tall as whatever the camera happened to produce. It is a
   thumbnail now, in a box of a fixed size, with the same rounded-card
   treatment the rest of the admin uses.

   The row also shows what a room actually IS rather than only what it
   costs: the photo, its description, how many it seats and both prices.
   The description is the room's own selling copy, so the desk can tell
   001 from 002 at a glance instead of by number alone.
   ------------------------------------------------------------------ */

const thumbBox = css`
  width: 8.8rem;
  aspect-ratio: 3 / 2;
  border-radius: var(--border-radius-sm);
  border: 1px solid var(--color-grey-200);
  background-color: var(--color-grey-100);
`;

const Img = styled.img`
  ${thumbBox}
  display: block;
  object-fit: cover;
  object-position: center;
`;

/* A room with no photo yet still needs to occupy the same box, or the
   rows either side of it jump. */
const NoImg = styled.div`
  ${thumbBox}
  display: grid;
  place-items: center;
  color: var(--color-grey-400);

  & svg {
    width: 2rem;
    height: 2rem;
  }
`;

const Stacked = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
`;

const Room = styled.div`
  font-size: 1.6rem;
  font-weight: 600;
  color: var(--color-grey-600);
  font-family: "Space Grotesk";
`;

/* Two lines of the room's own copy. Clamped rather than truncated at a
   character count, so it always breaks on a word and never mid-syllable. */
const Description = styled.p`
  font-size: 1.2rem;
  line-height: 1.5;
  color: var(--color-grey-500);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const Capacity = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--color-grey-600);

  & svg {
    width: 1.6rem;
    height: 1.6rem;
    color: var(--color-grey-400);
    flex-shrink: 0;
  }
`;

const Price = styled.div`
  font-family: "Space Grotesk";
  font-weight: 600;
  font-size: 1.5rem;
  color: var(--color-grey-700);
`;

/* Rooms are edited as one hourly number but SOLD by the minute, so the
   row says both: the rate the admin types, and the two figures the
   customer is quoted underneath it. */
const PerMinute = styled.div`
  font-family: "Space Grotesk";
  font-weight: 500;
  font-size: 1.2rem;
  color: var(--color-grey-500);
`;

const Dash = styled.span`
  color: var(--color-grey-400);
`;
function RoomRow({ room }) {
  const {
    name,
    maxCapacity,
    regularPrice,
    discount,
    image,
    description,
    id: roomId,
    room_type,
    hour_rate_rwf,
    day_rate_rwf,
    month_rate_rwf,
  } = room;

  /* Only consulted for a room the RWF migration has not reached, whose
     price is still only on the retired USD column. */
  const { rate: rwfPerUsd } = useFxRate();
  const shared = isSharedSpace(room);
  const perMinuteRwf = rwfPerMinuteFromRoom(room, rwfPerUsd);
  const perHourRwf = Math.round(perMinuteRwf * 60);
  const { can } = useAdminRole();
  const { deleteRoom, isDeleting } = useDeleteRoom();
  const { isCreating, createRoom } = useCreateRoom();
  function handleDuplicate() {
    createRoom({
      name: `Copy of ${name}`,
      maxCapacity,
      /* Every rate, and the TYPE. A copy that dropped room_type turned a
         shared space into a meeting room, and a copy that dropped the
         franc rates produced a room priced at nothing — both of which
         only showed up once somebody tried to sell it. */
      room_type,
      hour_rate_rwf,
      day_rate_rwf,
      month_rate_rwf,
      regularPrice,
      discount,
      image,
      description,
    });
  }
  return (
    <Table.Row>
      {image ? (
        <Img src={image} alt="" />
      ) : (
        <NoImg title="No photo yet">
          <ImageOff />
        </NoImg>
      )}

      <Stacked>
        <Room>{name}</Room>
        {description ? <Description>{description}</Description> : null}
      </Stacked>

      <Capacity>
        <Users />
        <span>
          Up to {maxCapacity} {maxCapacity === 1 ? "guest" : "guests"}
        </span>
      </Capacity>

      {/* A desk and a room are not sold on the same axis, so they do not
          get the same price line. A shared space leads with the day pass
          — its entry price — because its hourly rate buys one seat and
          reads as absurdly cheap next to a whole room's. The old row
          showed "$0.00/hr" for every desk, which is what `regularPrice`
          actually held for them. */}
      <Stacked>
        {shared ? (
          <>
            <Price>{formatRwfAmount(day_rate_rwf ?? 0)}/desk/day</Price>
            <PerMinute>
              {hour_rate_rwf
                ? `${formatRwfAmount(hour_rate_rwf)}/desk/hr`
                : "not sold by the hour"}
            </PerMinute>
          </>
        ) : (
          <>
            <Price>{formatRwfAmount(perHourRwf)}/hr</Price>
            <PerMinute>{formatRwfAmount(perMinuteRwf)}/min</PerMinute>
          </>
        )}
      </Stacked>

      {discount ? (
        <Tag type="green">&minus;{formatRwfAmount(discount)}</Tag>
      ) : (
        <Dash>&mdash;</Dash>
      )}
      <div>
        {/* Duplicate, Edit and Delete are the whole menu, and all three
            are admin work — so for staff the cell is simply empty
            rather than a toggle that opens onto nothing. */}
        {can.manageRooms ? (
          <Modal>
            <Menus.Menu>
              <Menus.Toggle id={roomId} />
              <Menus.List id={roomId}>
                <Menus.Button icon={<Copy />} onClick={handleDuplicate}>
                  Duplicate
                </Menus.Button>

                <Modal.Open opens="edit-room">
                  <Menus.Button icon={<Pencil />} onClick={() => {}}>
                    Edit
                  </Menus.Button>
                </Modal.Open>

                <Modal.Open opens="delete-room">
                  <Menus.Button icon={<Trash2 />}>Delete</Menus.Button>
                </Modal.Open>
              </Menus.List>
            </Menus.Menu>

            <Modal.Window name="edit-room">
              <CreateRoomForm roomToEdit={room} />
            </Modal.Window>

            <Modal.Window name="delete-room">
              <ConfirmDelete
                resourceName="rooms"
                disabled={isDeleting}
                room={room}
                onConfirm={() => deleteRoom(roomId)}
              />
            </Modal.Window>
          </Modal>
        ) : null}
      </div>
    </Table.Row>
  );
}

export default RoomRow;
