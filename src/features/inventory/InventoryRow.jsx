import { useState } from "react";
import styled, { css } from "styled-components";
import {
  ArrowRightLeft,
  Check,
  ImageOff,
  ImagePlus,
  ListX,
  PackagePlus,
  ShoppingCart,
  Trash2,
  Undo2,
  X,
} from "lucide-react";

import Table from "../../ui/Table";
import Tag from "../../ui/Tag";
import Menus from "../../ui/Menus";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import ButtonIcon from "../../ui/ButtonIcon";
import Input from "../../ui/Input";
import ConfirmDelete from "../../ui/ConfirmDelete";
import StockMovementForm from "./StockMovementForm";
import ItemPhotoForm from "./ItemPhotoForm";
import { useAdminRole } from "../authentication/useAdminRole";
import { useRemoveItemFromRoom, useSetParLevel } from "./useInventory";
import {
  STOCK_STATE_TAGS,
  marginPercent,
  stockState,
  unitProfit,
} from "../../utils/stock";
import { formatMenuPrice } from "../../utils/helpers";

const thumbBox = css`
  width: 4.8rem;
  height: 4.8rem;
  border-radius: var(--border-radius-sm);
  border: 1px solid var(--color-grey-200);
  background-color: var(--color-grey-100);
`;

const Img = styled.img`
  ${thumbBox}
  display: block;
  object-fit: cover;
`;

/* The empty slot is a button when the person may actually fill it.

   A row with no picture already draws the eye; making that the place you
   press is shorter than noticing it, opening the row menu and finding
   "Add a photo" — and it puts the action where the problem is. Staff,
   who may not edit the catalogue, get the plain placeholder. */
const NoImg = styled.div`
  ${thumbBox}
  display: grid;
  place-items: center;
  color: var(--color-grey-400);

  & svg {
    width: 1.8rem;
    height: 1.8rem;
  }
`;

const AddImg = styled.button`
  ${thumbBox}
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--color-grey-400);
  border-style: dashed;
  transition: all 0.2s;

  &:hover {
    color: var(--color-brand-600);
    border-color: var(--color-brand-600);
    background-color: var(--color-brand-50);
  }

  & svg {
    width: 1.8rem;
    height: 1.8rem;
  }
`;

const Item = styled.div`
  display: flex;
  align-items: center;
  gap: 1.2rem;
`;

const Named = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;

  & span:first-child {
    font-weight: 600;
    color: var(--color-grey-700);
  }

  & span:last-child {
    color: var(--color-grey-500);
    font-size: 1.2rem;
  }
`;

/* The count, sized so it can be read across a reception desk, coloured
   only when it needs attention. */
const Count = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  font-variant-numeric: tabular-nums;

  & strong {
    font-size: 2rem;
    color: ${(props) =>
      props.$state === "empty"
        ? "var(--color-red-700)"
        : props.$state === "low"
          ? "var(--color-yellow-700)"
          : "var(--color-grey-700)"};
  }

  & span {
    font-size: 1.3rem;
    color: var(--color-grey-500);
  }
`;

const ParEdit = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;

  & input {
    width: 7rem;
    padding: 0.4rem 0.8rem;
    font-size: 1.4rem;
  }
`;

/* The selling price with what it makes underneath.

   Together rather than in two columns, because neither number means much
   on its own: 5,000 RWF is only good news next to the 3,000 it cost. */
const Money = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-variant-numeric: tabular-nums;

  & small {
    font-size: 1.2rem;
    color: ${(props) =>
      props.$loss ? "var(--color-red-700)" : "var(--color-grey-500)"};
  }
`;

const QuickActions = styled.div`
  display: flex;
  gap: 0.6rem;
`;

function InventoryRow({ row }) {
  const { isAdmin, can } = useAdminRole();
  const { savePar, isSavingPar } = useSetParLevel();
  const { removeItem, isRemovingItem } = useRemoveItemFromRoom();

  const [editingPar, setEditingPar] = useState(false);
  const [parDraft, setParDraft] = useState(row.par_level);

  const state = stockState(row);
  const stateTag = STOCK_STATE_TAGS[state];
  const profit = unitProfit(row);
  const margin = marginPercent(row);

  function commitPar() {
    const next = Math.max(0, Math.floor(Number(parDraft) || 0));
    if (next === row.par_level) return setEditingPar(false);
    savePar(
      { roomId: row.roomId, menuItemId: row.menuItemId, parLevel: next },
      { onSuccess: () => setEditingPar(false) },
    );
  }

  return (
    <Table.Row>
      {/* One Modal for the whole row. It renders a context provider and
          no DOM node, and every Modal.Window portals out, so the grid
          columns are unaffected — which is what lets the thumbnail in
          the first cell open a window declared beside the last one. */}
      <Modal>
        <Item>
          {row.imageUrl ? (
            <Img src={row.imageUrl} alt={row.name} loading="lazy" />
          ) : can.manageMenu ? (
            <Modal.Open opens="photos">
              <AddImg type="button" title={`Add a photo of ${row.name}`}>
                <ImagePlus />
              </AddImg>
            </Modal.Open>
          ) : (
            <NoImg title="No photo yet">
              <ImageOff />
            </NoImg>
          )}
          <Named>
            <span>{row.name}</span>
            <span>
              {[row.categoryName, row.sectionName].filter(Boolean).join(" · ") ||
                "Uncategorised"}
            </span>
          </Named>
        </Item>

        <Money $loss={profit !== null && profit < 0}>
          <span>{formatMenuPrice(row.price, row.currency)}</span>
          {/* "Cost not set" rather than a 100% margin. An item with no
              buying price on file makes every sale of it look like pure
              profit, and saying so is the only way that gets fixed. */}
          {profit === null ? (
            <small>Cost not set</small>
          ) : profit < 0 ? (
            <small>
              costs {formatMenuPrice(row.cost_rwf, row.currency)} — sold at a loss
            </small>
          ) : (
            <small>
              +{formatMenuPrice(profit, row.currency)}
              {/* marginPercent() is null for a free item — a percentage of
                  a zero price is not a number, and .toFixed() on it would
                  take the whole page down. */}
              {margin === null ? null : ` · ${margin.toFixed(0)}%`}
            </small>
          )}
        </Money>

        <Count $state={state}>
          <strong>{row.quantity}</strong>
          {row.par_level > 0 ? <span>of {row.par_level}</span> : null}
        </Count>

        {/* An item removed from the menu that a room still holds. The
            stock state is the less important fact about this row: the
            business has stock of something it no longer sells, and the
            way out is to record what became of it. getInventory() drops
            these rows once they reach zero. */}
        {row.isArchived ? (
          <Tag type="red" title="Removed from the menu — record what became of this stock">
            Removed
          </Tag>
        ) : (
          <Tag type={stateTag.tag}>{stateTag.label}</Tag>
        )}

        {/* The stock target is the one field on this row that is a decision
            rather than a movement, so it is edited in place instead of
            through a modal — and only by an admin, because how much of
            something the business carries is a purchasing decision. */}
        {isAdmin ? (
          editingPar ? (
            <ParEdit>
              <Input
                type="number"
                min="0"
                step="1"
                value={parDraft}
                autoFocus
                disabled={isSavingPar}
                onChange={(event) => setParDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitPar();
                  if (event.key === "Escape") {
                    setParDraft(row.par_level);
                    setEditingPar(false);
                  }
                }}
              />
              <ButtonIcon onClick={commitPar} disabled={isSavingPar} title="Save">
                <Check />
              </ButtonIcon>
              <ButtonIcon
                onClick={() => {
                  setParDraft(row.par_level);
                  setEditingPar(false);
                }}
                title="Cancel"
              >
                <X />
              </ButtonIcon>
            </ParEdit>
          ) : (
            <Button
              size="small"
              variation="secondary"
              onClick={() => setEditingPar(true)}
            >
              {row.par_level > 0 ? `Target ${row.par_level}` : "Set target"}
            </Button>
          )
        ) : (
          <span style={{ color: "var(--color-grey-500)", fontSize: "1.3rem" }}>
            {row.par_level > 0 ? `Target ${row.par_level}` : "—"}
          </span>
        )}

        <QuickActions>
          {/* The two things that happen dozens of times a day get their
              own buttons rather than hiding in a menu — and they sit side
              by side, differently coloured and differently worded,
              because pressing the wrong one is the mistake that invents
              or loses a line of revenue. */}
          <Modal.Open opens="sell">
            <Button size="small" disabled={row.quantity <= 0}>
              Sell
            </Button>
          </Modal.Open>

          {can.manageStock ? (
            <Modal.Open opens="restock">
              <Button size="small" variation="secondary">
                Restock
              </Button>
            </Modal.Open>
          ) : null}

          <Menus.Menu>
            <Menus.Toggle id={row.id} />
            <Menus.List id={row.id}>
              <Modal.Open opens="sell">
                <Menus.Button icon={<ShoppingCart />}>Sell</Menus.Button>
              </Modal.Open>

              <Modal.Open opens="remove">
                <Menus.Button icon={<Undo2 />}>
                  Remove (not a sale)
                </Menus.Button>
              </Modal.Open>

              <Modal.Open opens="waste">
                <Menus.Button icon={<Trash2 />}>Write off</Menus.Button>
              </Modal.Open>

              <Modal.Open opens="transfer">
                <Menus.Button icon={<ArrowRightLeft />}>
                  Send to another room
                </Menus.Button>
              </Modal.Open>

              {/* Photos belong to the ITEM, so this is gated on the menu
                  capability rather than the stock one: a person who may
                  restock a shelf is not necessarily one who may change
                  what the public menu shows. */}
              {can.manageMenu ? (
                <Modal.Open opens="photos">
                  <Menus.Button icon={<ImagePlus />}>
                    {row.imageUrl ? "Photos" : "Add a photo"}
                  </Menus.Button>
                </Modal.Open>
              ) : null}

              {can.manageStock ? (
                <>
                  <Modal.Open opens="restock">
                    <Menus.Button icon={<PackagePlus />}>Restock</Menus.Button>
                  </Modal.Open>
                  <Modal.Open opens="correction">
                    <Menus.Button icon={<Check />}>
                      Correct the count
                    </Menus.Button>
                  </Modal.Open>
                  <Modal.Open opens="delist">
                    <Menus.Button icon={<ListX />}>
                      Take off this room&apos;s list
                    </Menus.Button>
                  </Modal.Open>
                </>
              ) : null}
            </Menus.List>
          </Menus.Menu>
        </QuickActions>

        {/* One form, opened pre-set to each reason. The reason can still
            be changed inside it, so a mis-click is one dropdown away from
            right rather than a cancel and a restart. */}
        <Modal.Window name="sell">
          <StockMovementForm row={row} defaultReason="sale" />
        </Modal.Window>
        <Modal.Window name="remove">
          <StockMovementForm row={row} defaultReason="removal" />
        </Modal.Window>
        <Modal.Window name="waste">
          <StockMovementForm row={row} defaultReason="waste" />
        </Modal.Window>
        <Modal.Window name="transfer">
          <StockMovementForm row={row} defaultReason="transfer_out" />
        </Modal.Window>
        <Modal.Window name="restock">
          <StockMovementForm row={row} defaultReason="restock" />
        </Modal.Window>
        <Modal.Window name="correction">
          <StockMovementForm row={row} defaultReason="correction" />
        </Modal.Window>

        <Modal.Window name="photos">
          <ItemPhotoForm row={row} />
        </Modal.Window>

        <Modal.Window name="delist">
          <ConfirmDelete
            title={`Take ${row.name} off ${row.roomName}'s list?`}
            description={
              row.quantity > 0
                ? `There are still ${row.quantity} in this room. Record them as sold, removed or written off first — otherwise stock that is physically there would disappear from the records with nothing to explain where it went.`
                : "This room stops carrying this item. Every movement it has ever had stays in the ledger, and it can be added back at any time."
            }
            confirmLabel="Take off list"
            disabled={isRemovingItem || row.quantity > 0}
            onConfirm={() =>
              removeItem({
                roomId: row.roomId,
                menuItemId: row.menuItemId,
                quantity: row.quantity,
              })
            }
          />
        </Modal.Window>
      </Modal>
    </Table.Row>
  );
}

export default InventoryRow;
