import styled from "styled-components";
import { formatCurrency, formatRwfPerMinute } from "../../utils/helpers";
import CreateRoomForm from "./CreateRoomForm";
import { useDeleteRoom } from "./useDeleteRoom";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { useCreateRoom } from "./useCreateRoom";
import ConfirmDelete from "../../ui/ConfirmDelete";
import Modal from "../../ui/Modal";
import Table from "../../ui/Table";
import Menus from "../../ui/Menus";
import Button from "../../ui/Button";

const Img = styled.img`
  display: block;
  width: 6.4rem;
  aspect-ratio: 3 / 2;
  object-fit: cover;
  object-position: center;
  transform: scale(1.5) translateX(-7px);
`;

const Room = styled.div`
  font-size: 1.6rem;
  font-weight: 600;
  color: var(--color-grey-600);
  font-family: "Space Grotesk";
`;

const Price = styled.div`
  font-family: "Space Grotesk";
  font-weight: 600;
`;

const PriceRwf = styled.div`
  font-family: "Space Grotesk";
  font-weight: 500;
  font-size: 1.2rem;
  color: var(--color-grey-500);
`;

const Discount = styled.div`
  font-family: "Space Grotesk";
  font-weight: 500;
  color: var(--color-green-700);
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
  } = room;
  const { deleteRoom, isDeleting } = useDeleteRoom();
  const { isCreating, createRoom } = useCreateRoom();
  function handleDuplicate() {
    createRoom({
      name: `Copy of ${name}`,
      maxCapacity,
      regularPrice,
      discount,
      image,
      description,
    });
  }
  return (
    <Table.Row>
      <img src={image} alt="" />
      <Room>{name}</Room>
      <div>Fits up to {maxCapacity} guests</div>
      <div>
        <Price>{formatCurrency(regularPrice / 60)}/min</Price>
        <PriceRwf>{formatRwfPerMinute(regularPrice / 60)}/min</PriceRwf>
      </div>
      {discount ? (
        <Discount>{formatCurrency(discount)}</Discount>
      ) : (
        <span>&mdash;</span>
      )}
      <div>
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
      </div>
    </Table.Row>
  );
}

export default RoomRow;
