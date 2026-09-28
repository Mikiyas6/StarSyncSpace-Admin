import styled from "styled-components";
import { formatDistanceFromNow, formatMenuPrice } from "../../utils/helpers";
import CreateMenuItemForm from "./CreateMenuItemForm";
import ExistingImagesManager from "./ExistingImagesManager";
import { useDeleteMenuItem } from "./useDeleteMenuItem";
import { useDuplicateMenuItem } from "./useDuplicateMenuItem";
import { useToggleMenuItemFlag } from "./useToggleMenuItemFlag";
import {
  Copy,
  Eye,
  EyeOff,
  ImageIcon,
  PackageCheck,
  Pencil,
  Trash2,
  Star,
} from "lucide-react";
import ConfirmDelete from "../../ui/ConfirmDelete";
import Modal from "../../ui/Modal";
import Table from "../../ui/Table";
import Menus from "../../ui/Menus";
import Tag from "../../ui/Tag";
import { useMenuOverview } from "./useMenuOverview";

const Thumb = styled.div`
  width: 5.6rem;
  aspect-ratio: 4 / 3;
  border-radius: var(--border-radius-sm);
  overflow: hidden;
  background-color: var(--color-grey-100);
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  svg {
    width: 2rem;
    height: 2rem;
    color: var(--color-grey-300);
  }
`;

const Name = styled.div`
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-grey-800);
  font-family: "Space Grotesk";
`;

const Meta = styled.div`
  font-size: 1.2rem;
  color: var(--color-grey-500);
  margin-top: 0.2rem;
`;

const Price = styled.div`
  font-family: "Space Grotesk";
  font-weight: 600;
`;

const Section = styled.div`
  font-size: 1.3rem;
  color: var(--color-grey-600);
`;

const Tags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
`;

const Updated = styled.div`
  font-size: 1.2rem;
  color: var(--color-grey-500);
`;

function MenuRow({ item, sectionName }) {
  const { images } = useMenuOverview().data ?? { images: [] };

  const itemImages = images.filter((img) => img.menu_item_id === item.id);
  const primaryImage = itemImages.find((img) => img.is_primary) ?? itemImages[0];

  const { deleteMenuItem, isDeleting } = useDeleteMenuItem();
  const { duplicateMenuItem, isDuplicating } = useDuplicateMenuItem();
  const { toggleFlag, isToggling } = useToggleMenuItemFlag();

  const itemWithImages = { ...item, images: itemImages };

  function handleDuplicate() {
    duplicateMenuItem(itemWithImages);
  }

  return (
    <Table.Row>
      <Thumb>
        {primaryImage ? (
          <img src={primaryImage.url} alt="" />
        ) : (
          <ImageIcon aria-hidden />
        )}
      </Thumb>

      <div>
        <Name>{item.name}</Name>
        <Meta>#{item.id}</Meta>
      </div>

      <Section>{sectionName}</Section>

      <Price>{formatMenuPrice(item.price, item.currency)}</Price>

      <Tags>
        {/* Hidden first and on its own: an item nobody can see is not
            also "Available", and showing both invites the reading that
            it is on the menu. */}
        {item.is_hidden ? (
          <Tag type="silver">Hidden</Tag>
        ) : (
          <Tag type={item.is_available ? "green" : "red"}>
            {item.is_available ? "Available" : "Sold out"}
          </Tag>
        )}
        {item.is_featured && <Tag type="brand">Featured</Tag>}
      </Tags>

      <Updated>
        {item.updated_at ? formatDistanceFromNow(item.updated_at) : "—"}
      </Updated>

      <div>
        <Modal>
          <Menus.Menu>
            <Menus.Toggle id={item.id} />
            <Menus.List id={item.id}>
              <Modal.Open opens="edit-item">
                <Menus.Button icon={<Pencil />} onClick={() => {}}>
                  Edit
                </Menus.Button>
              </Modal.Open>

              <Menus.Button
                icon={<Star />}
                onClick={() =>
                  toggleFlag({
                    id: item.id,
                    flag: "is_featured",
                    value: !item.is_featured,
                  })
                }
                disabled={isToggling}
              >
                {item.is_featured ? "Remove featured" : "Feature"}
              </Menus.Button>

              <Menus.Button
                icon={<PackageCheck />}
                onClick={() =>
                  toggleFlag({
                    id: item.id,
                    flag: "is_available",
                    value: !item.is_available,
                  })
                }
                disabled={isToggling}
              >
                {item.is_available ? "Mark sold out" : "Mark available"}
              </Menus.Button>

              {/* Next to "Mark sold out" because that is the one it
                  keeps being confused with, and the difference is worth
                  seeing side by side: sold out leaves the item on the
                  customer's menu, greyed. This takes it off. */}
              <Menus.Button
                icon={item.is_hidden ? <Eye /> : <EyeOff />}
                onClick={() =>
                  toggleFlag({
                    id: item.id,
                    flag: "is_hidden",
                    value: !item.is_hidden,
                  })
                }
                disabled={isToggling}
              >
                {item.is_hidden ? "Show on menu" : "Hide from menu"}
              </Menus.Button>

              <Menus.Button
                icon={<Copy />}
                onClick={handleDuplicate}
                disabled={isDuplicating}
              >
                Duplicate
              </Menus.Button>

              <Modal.Open opens="manage-images">
                <Menus.Button icon={<ImageIcon />} onClick={() => {}}>
                  Manage images
                </Menus.Button>
              </Modal.Open>

              <Modal.Open opens="delete-item">
                <Menus.Button icon={<Trash2 />}>Delete</Menus.Button>
              </Modal.Open>
            </Menus.List>
          </Menus.Menu>

          <Modal.Window name="edit-item">
            <CreateMenuItemForm itemToEdit={itemWithImages} />
          </Modal.Window>

          <Modal.Window name="manage-images">
            <ExistingImagesManager menuItemId={item.id} />
          </Modal.Window>

          <Modal.Window name="delete-item">
            {/* Not "permanently" — that is only true for an item that
                has never traded. One that has is archived instead, and a
                dialog that overstates what it does gets dismissed
                unread.

                It also names Hide, because this dialog is where people
                discover they wanted that instead. */}
            <ConfirmDelete
              resourceName={`"${item.name}"`}
              title={`Remove "${item.name}"`}
              description={`Take "${item.name}" off the menu for good and out of every room's stock list? Its sales history is kept either way. Any room that still holds stock of it has to be cleared first. To take it off the customer menu and keep everything as it is, close this and choose "Hide from menu".`}
              confirmLabel="Remove"
              disabled={isDeleting}
              onConfirm={() => deleteMenuItem(item.id)}
            />
          </Modal.Window>
        </Modal>
      </div>
    </Table.Row>
  );
}

export default MenuRow;