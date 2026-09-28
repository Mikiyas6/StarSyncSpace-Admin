import styled from "styled-components";
import { Link } from "react-router-dom";

import Heading from "../../ui/Heading";
import Button from "../../ui/Button";
import ExistingImagesManager from "../menu/ExistingImagesManager";

const Wrap = styled.div`
  width: 52rem;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
`;

const Note = styled.p`
  font-size: 1.3rem;
  line-height: 1.6;
  color: var(--color-grey-500);
  background-color: var(--color-grey-50);
  border-radius: var(--border-radius-sm);
  padding: 1rem 1.2rem;
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
`;

/* ------------------------------------------------------------------
   Photos for one stocked item, from the room it is stocked in.

   The gallery itself is the menu's ExistingImagesManager, unchanged and
   not copied: a photo belongs to the ITEM, not to the room's shelf, so
   the same Vitalo bottle shown on the public menu is the one shown on
   this row. Two managers would be two chances for them to disagree.

   What this adds is the way in. Inventory is where somebody is standing
   when they notice a row has no picture, and sending them to the Menu
   page to find the same item by name was the long way round to a
   two-click job.
   ------------------------------------------------------------------ */
function ItemPhotoForm({ row, onCloseModal }) {
  return (
    <Wrap>
      <Heading as="h3">Photos · {row.name}</Heading>

      <Note>
        This is the item&apos;s own photo, so it is the same one the public
        menu shows — changing it here changes it everywhere. The{" "}
        <strong>primary</strong> photo is the one that appears on this
        inventory row and on the menu card. Everything else about the item
        is edited on the <Link to="/menu">Menu page</Link>.
      </Note>

      <ExistingImagesManager menuItemId={row.menuItemId} />

      <Actions>
        <Button variation="secondary" onClick={onCloseModal}>
          Done
        </Button>
      </Actions>
    </Wrap>
  );
}

export default ItemPhotoForm;
