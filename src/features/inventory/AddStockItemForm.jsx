import { useState } from "react";
import styled from "styled-components";
import { Link } from "react-router-dom";

import Button from "../../ui/Button";
import Heading from "../../ui/Heading";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Spinner from "../../ui/Spinner";
import ImageDropzone from "../menu/ImageDropzone";
import { useCreateMenuItem } from "../menu/useCreateMenuItem";
import { useMenuOverview } from "../menu/useMenuOverview";
import { useAddItemToRoom, useStockableItems } from "./useInventory";
import { formatMenuPrice } from "../../utils/helpers";

const Wrap = styled.div`
  width: 52rem;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;

  & label {
    font-weight: 500;
    font-size: 1.4rem;
  }
`;

const Pair = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.2rem;
`;

const Note = styled.p`
  font-size: 1.3rem;
  line-height: 1.6;
  color: var(--color-grey-500);
  background-color: var(--color-grey-50);
  border-radius: var(--border-radius-sm);
  padding: 1rem 1.2rem;
`;

const Margin = styled.p`
  font-size: 1.3rem;
  font-variant-numeric: tabular-nums;
  border-radius: var(--border-radius-sm);
  padding: 0.8rem 1.2rem;
  color: ${(props) =>
    props.$loss ? "var(--color-red-700)" : "var(--color-green-700)"};
  background-color: ${(props) =>
    props.$loss ? "var(--color-red-100)" : "var(--color-green-100)"};
`;

/* Two ways to answer one question, so they are two tabs rather than a
   dropdown with a magic "+ New…" entry at the bottom — the fields below
   change completely between them, and a picker that silently swaps half
   the form is a picker people press by accident. */
const Tabs = styled.div`
  display: flex;
  gap: 0.4rem;
  padding: 0.4rem;
  background-color: var(--color-grey-100);
  border-radius: var(--border-radius-sm);
`;

const Tab = styled.button`
  flex: 1;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 1.4rem;
  font-weight: 500;
  padding: 0.8rem 1.2rem;
  border-radius: var(--border-radius-sm);
  transition: all 0.2s;
  color: ${(props) =>
    props.$active ? "var(--color-grey-0)" : "var(--color-grey-600)"};
  background-color: ${(props) =>
    props.$active ? "var(--color-brand-600)" : "transparent"};

  &:hover:not(:disabled) {
    color: ${(props) =>
      props.$active ? "var(--color-grey-0)" : "var(--color-grey-700)"};
  }
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 1.2rem;
`;

/* ------------------------------------------------------------------
   Start carrying an item in a room.

   Adding an item creates its row with a count of ZERO and a target — it
   does not put stock in. That separation is deliberate: "we carry Cokes
   here, six of them normally" and "twenty-four Cokes arrived today" are
   different facts, and only the second is a movement with a date on it.

   The item itself can come from either direction. Picking one that
   already exists is the common case. Creating one is the case this form
   used to send people away for: a new snack meant leaving inventory,
   finding the Menu page, creating the item there with the right section
   and the "kept as stock" box ticked, then coming back — for something
   that is one name and two prices.
   ------------------------------------------------------------------ */
function AddStockItemForm({
  room,
  alreadyStocked = [],
  /* Which tab to open on. Left unset it decides for itself below, once
     it knows whether there is anything to pick — opening on an empty
     dropdown and making people find the other tab is the one case where
     the default is obviously wrong. */
  initialMode,
  onCloseModal,
}) {
  const { items, isLoading, error } = useStockableItems();
  const { data: overview, isLoading: isLoadingMenu } = useMenuOverview();
  const { addItem, isAdding } = useAddItemToRoom();
  const { createMenuItem, isCreating } = useCreateMenuItem();

  const [mode, setMode] = useState(initialMode ?? null);
  const [parLevel, setParLevel] = useState(6);

  /* How many are going in right now. Zero by default — adding an item to
     a room and putting stock in it really are separate decisions, and the
     form should not quietly assume the second. But having to leave, find
     Restock and come back for the commonest case (a new snack you are
     holding in your hand) was the long way round. */
  const [openingQty, setOpeningQty] = useState("");
  const [openingReason, setOpeningReason] = useState("restock");

  // Existing-item mode
  const [menuItemId, setMenuItemId] = useState("");

  // New-item mode
  const [name, setName] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [files, setFiles] = useState([]);

  const busy = isAdding || isCreating;

  if (isLoading || isLoadingMenu) return <Spinner />;

  if (error)
    return (
      <Wrap>
        <Heading as="h3">Add an item to {room.name}</Heading>
        <Note>{error.message}</Note>
      </Wrap>
    );

  /* An item already on this room's list must not be offered again — the
     unique constraint on (room_id, menu_item_id) would refuse it, and the
     right answer to "I want more Cokes here" is Restock, not Add. */
  const stockedIds = new Set(alreadyStocked.map((row) => row.menuItemId));
  const available = items.filter((item) => !stockedIds.has(item.menuItemId));

  /* Decided after the lists have loaded, not before: with nothing left to
     choose from, "Choose an existing item" is an empty dropdown and a
     dead end, so the form opens on the tab that can actually do
     something. An explicit `initialMode` always wins. */
  const activeMode = mode ?? (available.length > 0 ? "existing" : "new");
  /* Sections, labelled with their category, because "Water" and "Snacks"
     mean little on their own next to each other. */
  const sections = (overview?.sections ?? [])
    .filter((section) => section.is_active !== false)
    .map((section) => {
      const category = (overview?.categories ?? []).find(
        (c) => c.id === section.category_id,
      );
      return {
        value: String(section.id),
        label: category ? `${category.name} · ${section.name}` : section.name,
        sort: `${category?.sort_order ?? 99}-${section.sort_order ?? 99}`,
      };
    })
    .sort((a, b) => a.sort.localeCompare(b.sort));

  const priceNum = price === "" ? null : Number(price);
  const costNum = cost === "" ? null : Number(cost);
  const marginPerUnit =
    priceNum === null || costNum === null ? null : priceNum - costNum;
  const marginPct =
    marginPerUnit === null || !priceNum ? null : (marginPerUnit / priceNum) * 100;

  const newItemReady =
    name.trim().length > 0 &&
    sectionId !== "" &&
    priceNum !== null &&
    Number.isFinite(priceNum) &&
    priceNum >= 0;

  const par = Math.max(0, Math.floor(Number(parLevel) || 0));
  const opening = Math.max(0, Math.floor(Number(openingQty) || 0));

  function addExisting(event) {
    event.preventDefault();
    if (!menuItemId) return;
    addItem(
      {
        roomId: room.id,
        menuItemId: Number(menuItemId),
        parLevel: par,
        openingQty: opening,
        openingReason,
      },
      { onSuccess: () => onCloseModal?.() },
    );
  }

  function createAndAdd(event) {
    event.preventDefault();
    if (!newItemReady) return;

    createMenuItem(
      {
        input: {
          name: name.trim(),
          section_id: Number(sectionId),
          price: priceNum,
          cost_rwf: costNum,
          /* The whole point of creating it from here: an item that is
             not marked as stock has no count and would not appear on
             this screen at all. */
          is_stocked: true,
          is_available: true,
        },
        files,
      },
      {
        /* The room's row is a second step, and only after the item
           exists — it needs the id. A failure creating the item means no
           row either, which is right: a shelf entry for an item that
           does not exist is worse than neither. */
        onSuccess: ({ item }) =>
          addItem(
            {
              roomId: room.id,
              menuItemId: item.id,
              parLevel: par,
              openingQty: opening,
              openingReason,
              /* The cost was just typed in above, so the opening
                 delivery is stamped with it rather than re-read. */
              unitCostRwf: costNum,
            },
            { onSuccess: () => onCloseModal?.() },
          ),
      },
    );
  }

  const parField = (
    <>
      <Pair>
        <Field>
          <label htmlFor="opening">How many are going in now?</label>
          <Input
            id="opening"
            type="number"
            min="0"
            step="1"
            value={openingQty}
            disabled={busy}
            placeholder="0 — none yet"
            onChange={(event) => setOpeningQty(event.target.value)}
          />
        </Field>

        <Field>
          <label htmlFor="par">How many should it normally hold?</label>
          <Input
            id="par"
            type="number"
            min="0"
            step="1"
            value={parLevel}
            disabled={busy}
            onChange={(event) => setParLevel(event.target.value)}
          />
        </Field>
      </Pair>

      {/* Only once there IS an opening amount, because until then the
          question is meaningless. It is asked rather than assumed
          because the two answers differ in real money: a delivery is
          money out of the business and shows up in what the fridge cost;
          stock that was already on the shelf was paid for some other
          time and must not be counted again. */}
      {opening > 0 ? (
        <Field>
          <label htmlFor="openingReason">Where are they coming from?</label>
          <Select
            id="openingReason"
            value={openingReason}
            disabled={busy}
            options={[
              { value: "restock", label: "A delivery — we just bought them" },
              {
                value: "correction",
                label: "Already on the shelf — just starting to count them",
              },
            ]}
            onChange={(event) => setOpeningReason(event.target.value)}
          />
          <Note>
            {openingReason === "restock" ? (
              <>
                Recorded as a <strong>delivery</strong>, dated now, and
                counted in what the fridge has cost.
              </>
            ) : (
              <>
                Recorded as a <strong>recount</strong>: the count goes up and
                no money moves, because these were paid for some other time.
                Use this when the stock was already there and the system is
                only now being told about it.
              </>
            )}
          </Note>
        </Field>
      ) : null}
    </>
  );

  const tail = (
    <Note>
      This is the level below which {room.name} shows as running low, so it is
      per room: a fridge that holds six waters is low at six, a shelf of sixty
      is not. Set it to 0 to carry the item without being reminded about it.
      <br />
      <br />
      {opening > 0 ? (
        <>
          The {opening} going in now are recorded as a movement with
          today&apos;s date, the same as any other — so the count and the
          explanation for the count can never disagree.
        </>
      ) : (
        <>
          Leave the opening amount at 0 to carry the item without any stock
          yet, and use <strong>Restock</strong> when it arrives, so the
          ledger records when it did.
        </>
      )}
    </Note>
  );

  return (
    <Wrap
      as="form"
      onSubmit={activeMode === "existing" ? addExisting : createAndAdd}
    >
      <Heading as="h3">Add an item to {room.name}</Heading>

      <Tabs role="tablist">
        <Tab
          type="button"
          role="tab"
          aria-selected={activeMode === "existing"}
          $active={activeMode === "existing"}
          disabled={busy}
          onClick={() => setMode("existing")}
        >
          Choose an existing item
        </Tab>
        <Tab
          type="button"
          role="tab"
          aria-selected={activeMode === "new"}
          $active={activeMode === "new"}
          disabled={busy}
          onClick={() => setMode("new")}
        >
          Create a new item
        </Tab>
      </Tabs>

      {activeMode === "existing" ? (
        <>
          {available.length === 0 ? (
            <Note>
              {items.length === 0
                ? "No items are kept as stock yet."
                : `${room.name} already carries every stocked item.`}{" "}
              Use <strong>Create a new item</strong> above to add one, or{" "}
              <strong>Restock</strong> on a row to bring more of something in.
            </Note>
          ) : (
            <>
              <Field>
                <label htmlFor="item">Item</label>
                <Select
                  id="item"
                  value={menuItemId}
                  options={[
                    { value: "", label: "Choose an item…" },
                    ...available.map((item) => ({
                      value: String(item.menuItemId),
                      label: `${item.name} — ${formatMenuPrice(item.price, item.currency)}`,
                    })),
                  ]}
                  onChange={(event) => setMenuItemId(event.target.value)}
                />
              </Field>

              {parField}
              {tail}
            </>
          )}
        </>
      ) : (
        <>
          <Field>
            <label htmlFor="name">What is it called?</label>
            <Input
              id="name"
              type="text"
              value={name}
              disabled={busy}
              placeholder="e.g. Niks Caramel"
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <Field>
            <label htmlFor="section">Where does it belong on the menu?</label>
            <Select
              id="section"
              value={sectionId}
              disabled={busy}
              options={[
                { value: "", label: "Choose a section…" },
                ...sections,
              ]}
              onChange={(event) => setSectionId(event.target.value)}
            />
            {sections.length === 0 ? (
              <Note>
                There are no menu sections yet. Create one on the{" "}
                <Link to="/menu">Menu page</Link> first — an item has to live
                somewhere on the menu, because that is where its name, price
                and photo come from.
              </Note>
            ) : null}
          </Field>

          <Pair>
            <Field>
              <label htmlFor="price">What does one sell for?</label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                disabled={busy}
                onChange={(event) => setPrice(event.target.value)}
              />
            </Field>
            <Field>
              <label htmlFor="cost">What does one cost to buy?</label>
              <Input
                id="cost"
                type="number"
                min="0"
                step="0.01"
                value={cost}
                disabled={busy}
                placeholder="From the receipt"
                onChange={(event) => setCost(event.target.value)}
              />
            </Field>
          </Pair>

          {/* The margin as it is typed, same as on a restock. Better to
              see that a price makes nothing now than to find out from a
              report at the end of the month. */}
          {marginPerUnit !== null ? (
            <Margin $loss={marginPerUnit <= 0}>
              {marginPerUnit > 0 ? (
                <>
                  Makes {formatMenuPrice(marginPerUnit, "RWF")} on each one — a{" "}
                  {marginPct.toFixed(0)}% margin.
                </>
              ) : marginPerUnit === 0 ? (
                <>Sells for exactly what it costs — no margin at all.</>
              ) : (
                <>
                  Sells for <strong>less than it costs</strong>:{" "}
                  {formatMenuPrice(Math.abs(marginPerUnit), "RWF")} lost on
                  every one.
                </>
              )}
            </Margin>
          ) : (
            <Note>
              Without a buying price, every sale of this counts as pure
              profit — which overstates what the fridge makes rather than
              admitting it is not known. You can add it later from{" "}
              <strong>Restock</strong>.
            </Note>
          )}

          <Field>
            <label>Photo</label>
            <ImageDropzone id="newItemImages" files={files} setFiles={setFiles} />
          </Field>

          {parField}

          <Note>
            This creates the item on the menu <strong>and</strong> starts{" "}
            {room.name} carrying it
            {opening > 0 ? (
              <>
                , with <strong>{opening}</strong> in it
              </>
            ) : (
              <> with a count of <strong>0</strong></>
            )}
            . The first photo becomes the one shown on its inventory row and
            its menu card.
          </Note>
        </>
      )}

      <Actions>
        <Button
          type="button"
          variation="secondary"
          disabled={busy}
          onClick={onCloseModal}
        >
          Cancel
        </Button>
        <Button
          disabled={
            busy ||
            (activeMode === "existing"
              ? !menuItemId
              : !newItemReady || sections.length === 0)
          }
        >
          {activeMode === "existing" ? "Add to room" : "Create and add"}
        </Button>
      </Actions>
    </Wrap>
  );
}

export default AddStockItemForm;
