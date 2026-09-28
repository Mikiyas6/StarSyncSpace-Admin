import { useState } from "react";
import styled from "styled-components";

import Button from "../../ui/Button";
import Heading from "../../ui/Heading";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Textarea from "../../ui/Textarea";
import { useAdminRole } from "../authentication/useAdminRole";
import { useRecordMovement, useRestock, useTransferStock } from "./useInventory";
import { useRooms } from "../rooms/useRooms";
import {
  STOCK_REASONS,
  deltaFor,
  reasonsFor,
  suggestedRestock,
} from "../../utils/stock";
import { formatMenuPrice } from "../../utils/helpers";

const Wrap = styled.div`
  width: 46rem;
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

/* The sentence under the reason picker. This is the single most useful
   thing on the form: it is what stops somebody recording a sale when they
   meant a removal, which is the mistake that quietly invents revenue. */
const Help = styled.p`
  font-size: 1.3rem;
  line-height: 1.5;
  color: ${(props) =>
    props.$money ? "var(--color-green-700)" : "var(--color-grey-500)"};
  background-color: ${(props) =>
    props.$money ? "var(--color-green-100)" : "var(--color-grey-50)"};
  border-radius: var(--border-radius-sm);
  padding: 1rem 1.2rem;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.2rem;
`;

const Summary = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1.2rem;
  border-top: 1px solid var(--color-grey-100);
  padding-top: 1.2rem;
  font-size: 1.4rem;

  & strong {
    font-size: 1.8rem;
  }
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 1.2rem;
`;

const Direction = styled.div`
  display: flex;
  gap: 0.8rem;
`;

/* The prices, boxed off from the count.

   Visually separate because they are a different kind of statement: how
   many arrived is a fact about today, what it costs is a standing
   figure that outlives this delivery and changes every sale from here
   on. Running them together as four equal inputs invites somebody to
   treat a price as a per-delivery detail. */
const PriceBox = styled.fieldset`
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-sm);
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;

  & legend {
    font-size: 1.3rem;
    font-weight: 600;
    color: var(--color-grey-600);
    padding: 0 0.6rem;
  }
`;

const Margin = styled.p`
  font-size: 1.3rem;
  font-variant-numeric: tabular-nums;
  color: ${(props) =>
    props.$loss ? "var(--color-red-700)" : "var(--color-green-700)"};
  background-color: ${(props) =>
    props.$loss ? "var(--color-red-100)" : "var(--color-green-100)"};
  border-radius: var(--border-radius-sm);
  padding: 0.8rem 1.2rem;
`;

/* ------------------------------------------------------------------
   Recording one movement.

   `defaultReason` lets the row's buttons open this pre-set — "Sell" opens
   on a sale, "Restock" on a restock — because the common case should be
   one number and a confirm, not a trip through a dropdown. The dropdown
   is still there, so a mis-click is one change away from right rather
   than a cancel and a restart.
   ------------------------------------------------------------------ */
function StockMovementForm({ row, defaultReason = "sale", onCloseModal }) {
  const { isAdmin } = useAdminRole();
  const { record, isRecording } = useRecordMovement();
  const { restock, isRestocking } = useRestock();
  const { transfer, isTransferring } = useTransferStock();
  const { rooms, isLoading: isLoadingRooms } = useRooms();

  const available = reasonsFor({ isAdmin });
  /* A staff member who somehow arrived with a restock preset gets the
     first reason they are actually allowed, rather than a form that can
     only fail. */
  const initialReason = available.includes(defaultReason)
    ? defaultReason
    : available[0];

  const [reason, setReason] = useState(initialReason);
  const [quantity, setQuantity] = useState(
    initialReason === "restock" ? suggestedRestock(row) : 1,
  );
  const [increase, setIncrease] = useState(false);
  const [note, setNote] = useState("");

  /* Pre-filled with what the item costs and sells for now, so the common
     delivery — same supplier, same price — is a confirm rather than two
     numbers to look up. Held as strings, because an empty box has to stay
     empty while somebody retypes a figure; Number("") is 0, and a cost
     that silently became 0 would report as a 100% margin. */
  /* Where the stock is going. Empty until chosen on purpose — there is
     no sensible default for "which room", and pre-selecting one would
     make the commonest possible mistake a single unnoticed click. */
  const [toRoomId, setToRoomId] = useState("");

  const [costDraft, setCostDraft] = useState(
    row.cost_rwf == null ? "" : String(row.cost_rwf),
  );
  const [priceDraft, setPriceDraft] = useState(
    row.price ? String(row.price) : "",
  );

  const meta = STOCK_REASONS[reason];
  const delta = deltaFor(reason, quantity, { increase });
  const isRecount = meta?.direction === 0;
  const isRestock = reason === "restock";
  const isTransfer = reason === "transfer_out";
  const busy = isRecording || isRestocking || isTransferring;

  /* Every other room this could go to. The current one is excluded —
     sending stock to the room it is already in is a no-op the database
     refuses, and offering it invites the attempt. Archived rooms are
     left out for the same reason they are left out everywhere else. */
  const destinations = (rooms ?? [])
    .filter((room) => room.id !== row.roomId && !room.is_archived)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const destination = destinations.find(
    (room) => String(room.id) === String(toRoomId),
  );
  const needsDestination = isTransfer && !destination;

  /* The two figures as typed. Empty means "leave it as it is" all the
     way down to the database, which coalesces rather than clearing. */
  const costNow = costDraft === "" ? null : Number(costDraft);
  const priceNow = priceDraft === "" ? null : Number(priceDraft);

  const costValid = costNow === null || (Number.isFinite(costNow) && costNow >= 0);
  const priceValid =
    priceNow === null || (Number.isFinite(priceNow) && priceNow >= 0);

  /* What this delivery costs, and what each unit will make once it
     sells. Shown live, because the moment to notice that a supplier's
     price rise has wiped out the margin is while typing it in — not in
     a report at the end of the month. */
  const units = Math.abs(Math.floor(Number(quantity) || 0));
  const spend = costNow === null ? null : units * costNow;
  const marginPerUnit =
    costNow === null || priceNow === null ? null : priceNow - costNow;
  const marginPct =
    marginPerUnit === null || !priceNow ? null : (marginPerUnit / priceNow) * 100;

  /* What the count will be afterwards, shown before anything is
     recorded. The database refuses to take stock below zero, and finding
     that out from an error after pressing the button is a worse way to
     learn it than seeing the number go red. */
  const after = row.quantity + delta;
  const wouldGoNegative = after < 0;

  const unitPrice = row.price;
  const revenue = meta?.isSale ? Math.abs(delta) * unitPrice : 0;
  const missingPrice = meta?.isSale && !(unitPrice > 0);

  /* What this sale MAKES, as opposed to what it takes. null rather than
     zero when the item has no buying price on file, so the line can say
     "cost not known" instead of quietly claiming the whole sale as
     profit. */
  const saleProfit =
    meta?.isSale && row.cost_rwf != null
      ? Math.abs(delta) * (unitPrice - Number(row.cost_rwf))
      : null;

  function handleSubmit(event) {
    event.preventDefault();
    if (!delta || wouldGoNegative || missingPrice) return;

    /* A transfer is one action across two rooms, so it goes through the
       RPC that writes both legs in one transaction. Recording only the
       out-leg — which is all this form used to do — took the stock out
       of one room and put it in none. */
    if (isTransfer) {
      if (!destination) return;
      transfer(
        {
          fromRoomId: row.roomId,
          toRoomId: destination.id,
          toRoomName: destination.name,
          menuItemId: row.menuItemId,
          quantity: units,
          note,
        },
        { onSuccess: () => onCloseModal?.() },
      );
      return;
    }

    /* A delivery goes through its own path, because it does two things:
       records the movement AND re-prices the item. Both inside one
       transaction — a crate booked at the new cost against an item still
       carrying the old one reports a margin that was never real. */
    if (isRestock) {
      if (!costValid || !priceValid) return;
      restock(
        {
          roomId: row.roomId,
          menuItemId: row.menuItemId,
          quantity: units,
          unitCostRwf: costNow,
          unitPriceRwf: priceNow,
          note,
        },
        { onSuccess: () => onCloseModal?.() },
      );
      return;
    }

    record(
      {
        roomId: row.roomId,
        menuItemId: row.menuItemId,
        delta,
        reason,
        /* Captured now, not looked up when a report runs — prices change,
           and what a customer paid does not. Sent only for a sale; the
           database refuses a price on anything else being counted as
           revenue anyway, since revenue_rwf is generated. */
        unitPriceRwf: meta?.isSale ? unitPrice : null,
        note,
      },
      { onSuccess: () => onCloseModal?.() },
    );
  }

  return (
    <Wrap as="form" onSubmit={handleSubmit}>
      <Heading as="h3">
        {row.name} · {row.roomName}
      </Heading>

      <Field>
        <label htmlFor="reason">What happened?</label>
        <Select
          id="reason"
          value={reason}
          options={available.map((value) => ({
            value,
            label: STOCK_REASONS[value].verb,
          }))}
          onChange={(event) => {
            const next = event.target.value;
            setReason(next);
            if (next === "restock") setQuantity(suggestedRestock(row));
          }}
        />
        <Help $money={meta?.isSale}>{meta?.help}</Help>
      </Field>

      {/* The question the old form never asked. Without it "Send to
          another room" recorded stock leaving and nothing arriving. */}
      {isTransfer ? (
        <Field>
          <label htmlFor="toRoom">Send to which room?</label>
          <Select
            id="toRoom"
            value={toRoomId}
            disabled={busy || isLoadingRooms}
            options={[
              {
                value: "",
                label: isLoadingRooms ? "Loading rooms…" : "Choose a room…",
              },
              ...destinations.map((room) => ({
                value: String(room.id),
                label: room.name,
              })),
            ]}
            onChange={(event) => setToRoomId(event.target.value)}
          />
          {destinations.length === 0 && !isLoadingRooms ? (
            <Help>
              There is no other room to send this to. Add one on the Rooms
              page first.
            </Help>
          ) : null}
        </Field>
      ) : null}

      <Row>
        <Field>
          <label htmlFor="quantity">How many?</label>
          <Input
            id="quantity"
            type="number"
            min="1"
            step="1"
            value={quantity}
            disabled={busy}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </Field>

        {/* A recount is the one reason that can go either way, so it is
            the one that has to ask. */}
        {isRecount ? (
          <Field>
            <label>In which direction?</label>
            <Direction>
              <Button
                type="button"
                size="small"
                variation={increase ? "primary" : "secondary"}
                onClick={() => setIncrease(true)}
              >
                More than recorded
              </Button>
              <Button
                type="button"
                size="small"
                variation={increase ? "secondary" : "primary"}
                onClick={() => setIncrease(false)}
              >
                Fewer
              </Button>
            </Direction>
          </Field>
        ) : null}
      </Row>

      {/* Only on a delivery. A sale must never offer to change a price —
          the figure a customer paid is settled at the till, and a screen
          that invites editing it beside the quantity is a screen that
          will eventually have it edited. */}
      {isRestock ? (
        <PriceBox>
          <legend>Prices</legend>

          <Row>
            <Field>
              <label htmlFor="cost">What does one cost to buy?</label>
              <Input
                id="cost"
                type="number"
                min="0"
                step="0.01"
                value={costDraft}
                disabled={busy}
                placeholder="From the receipt"
                onChange={(event) => setCostDraft(event.target.value)}
              />
            </Field>

            <Field>
              <label htmlFor="price">What does one sell for?</label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={priceDraft}
                disabled={busy}
                onChange={(event) => setPriceDraft(event.target.value)}
              />
            </Field>
          </Row>

          {/* The margin as it is typed. The moment to notice that a
              supplier's price rise has eaten the margin is now, with the
              receipt still in hand — not in a report next month. */}
          {marginPerUnit !== null ? (
            <Margin $loss={marginPerUnit <= 0}>
              {marginPerUnit > 0 ? (
                <>
                  Makes <strong>{formatMenuPrice(marginPerUnit, row.currency)}</strong>{" "}
                  on each one — a {marginPct.toFixed(0)}% margin.
                  {spend !== null && units > 0 ? (
                    <>
                      {" "}
                      This delivery costs{" "}
                      {formatMenuPrice(spend, row.currency)} and will bring in{" "}
                      {formatMenuPrice(units * priceNow, row.currency)}.
                    </>
                  ) : null}
                </>
              ) : marginPerUnit === 0 ? (
                <>Sells for exactly what it costs — no margin at all.</>
              ) : (
                <>
                  Sells for <strong>less than it costs</strong>:{" "}
                  {formatMenuPrice(Math.abs(marginPerUnit), row.currency)} lost on
                  every one. The more of these you sell, the better the takings
                  look and the worse the month gets.
                </>
              )}
            </Margin>
          ) : (
            <Help>
              Leave a box empty to keep the price as it is. Without a buying
              price, every sale of {row.name} counts as pure profit — which
              overstates what the fridge makes rather than admitting it is not
              known.
            </Help>
          )}
        </PriceBox>
      ) : null}

      <Field>
        <label htmlFor="note">Note (optional)</label>
        <Textarea
          id="note"
          rows="2"
          value={note}
          disabled={busy}
          placeholder={
            meta?.isSale
              ? "e.g. room 01, paid cash"
              : "e.g. past its date, swapped for the new brand"
          }
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>

      <Summary>
        <span>
          In stock: {row.quantity} →{" "}
          <strong
            style={{
              color: wouldGoNegative
                ? "var(--color-red-700)"
                : "var(--color-grey-700)",
            }}
          >
            {after}
          </strong>
        </span>

        {/* The takings line appears only for a sale, and says so in words
            for everything else. Silence here would be ambiguous; an
            explicit "does not affect sales" is the whole reassurance. */}
        <span>
          {meta?.isSale ? (
            <>
              Takings: <strong>{formatMenuPrice(revenue, "RWF")}</strong>
              {/* The profit beside the takings, because they are
                  different numbers and only one of them is the reason
                  the fridge is worth stocking. */}
              {saleProfit !== null ? (
                <em
                  style={{
                    display: "block",
                    color:
                      saleProfit >= 0
                        ? "var(--color-green-700)"
                        : "var(--color-red-700)",
                    fontStyle: "normal",
                    fontSize: "1.3rem",
                  }}
                >
                  {formatMenuPrice(saleProfit, "RWF")} profit
                </em>
              ) : (
                <em
                  style={{
                    display: "block",
                    color: "var(--color-grey-500)",
                    fontStyle: "normal",
                    fontSize: "1.3rem",
                  }}
                >
                  cost not known
                </em>
              )}
            </>
          ) : isTransfer ? (
            <em style={{ color: "var(--color-grey-500)", fontStyle: "normal" }}>
              {destination ? (
                <>
                  {units} to <strong>{destination.name}</strong> · sales
                  unaffected
                </>
              ) : (
                "Pick a room to send to"
              )}
            </em>
          ) : (
            <em style={{ color: "var(--color-grey-500)" }}>
              Sales unaffected
            </em>
          )}
        </span>
      </Summary>

      {wouldGoNegative ? (
        <Help>
          There are only {row.quantity} in this room. Reduce the quantity, or
          record a recount if the shelf says otherwise.
        </Help>
      ) : null}

      {missingPrice ? (
        <Help>
          {row.name} has no price set, so it cannot be sold. Set one on the
          Menu page first.
        </Help>
      ) : null}

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
            !delta ||
            wouldGoNegative ||
            missingPrice ||
            needsDestination ||
            (isRestock && (!costValid || !priceValid))
          }
        >
          {meta?.verb ?? "Record"}
        </Button>
      </Actions>
    </Wrap>
  );
}

export default StockMovementForm;
