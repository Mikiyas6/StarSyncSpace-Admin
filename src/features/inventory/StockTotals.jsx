import { useMemo } from "react";
import styled from "styled-components";

import Heading from "../../ui/Heading";
import Table from "../../ui/Table";
import Tag from "../../ui/Tag";
import { formatMenuPrice } from "../../utils/helpers";

const Panel = styled.section`
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-100);
  border-radius: var(--border-radius-md);
  padding: 2.4rem;
  margin-bottom: 3.2rem;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

const Head = styled.div`
  display: flex;
  align-items: baseline;
  gap: 1.2rem;
  flex-wrap: wrap;

  & h2 {
    font-size: 1.8rem;
    font-weight: 600;
  }
`;

const Note = styled.p`
  color: var(--color-grey-500);
  font-size: 1.4rem;
  max-width: 82ch;
`;

const Count = styled.strong`
  font-size: 1.8rem;
  font-variant-numeric: tabular-nums;
  color: ${(props) =>
    props.$none ? "var(--color-red-700)" : "var(--color-grey-700)"};
`;

const Where = styled.span`
  font-size: 1.3rem;
  color: var(--color-grey-500);
`;

const Money = styled.span`
  font-variant-numeric: tabular-nums;
  font-size: 1.4rem;
`;

/* ------------------------------------------------------------------
   How much of each thing exists, across the whole building.

   The rest of this screen is grouped by ROOM, because that is the unit
   you restock. This is the other question, and it has never had an
   answer here: somebody deciding whether to reorder Vitalo does not care
   that four are in Meeting Room 02 and one is in Meeting Room 01 — they
   care that there are five, and that five is not many.

   Derived from the rows already on the page rather than a second query.
   The totals and the per-room counts are then the same numbers by
   construction, which matters more here than anywhere: two places
   showing different stock levels is worse than one place showing none.
   ------------------------------------------------------------------ */
function StockTotals({ stock }) {
  const totals = useMemo(() => {
    const byItem = new Map();

    for (const row of stock) {
      if (!byItem.has(row.menuItemId)) {
        byItem.set(row.menuItemId, {
          menuItemId: row.menuItemId,
          name: row.name,
          price: row.price,
          cost: row.cost_rwf,
          currency: row.currency,
          total: 0,
          rooms: [],
        });
      }
      const entry = byItem.get(row.menuItemId);
      entry.total += row.quantity;
      if (row.quantity > 0) entry.rooms.push(`${row.roomName} ${row.quantity}`);
    }

    return [...byItem.values()].sort((a, b) => {
      /* Nothing left first: an item that has run out everywhere is off
         the public menu right now, which is the most actionable thing
         this table can say. */
      const gone = Number(a.total === 0) - Number(b.total === 0);
      if (gone !== 0) return -gone;
      return String(a.name).localeCompare(String(b.name));
    });
  }, [stock]);

  if (totals.length === 0) return null;

  const soldOut = totals.filter((row) => row.total === 0);

  /* What the stock on the shelves is worth. At COST, because that is what
     it tied up — valuing unsold stock at its selling price books a profit
     that has not happened. */
  const valueAtCost = totals.reduce(
    (sum, row) => sum + (row.cost == null ? 0 : row.cost * row.total),
    0,
  );
  const anyUnpriced = totals.some((row) => row.cost == null && row.total > 0);

  return (
    <Panel>
      <Head>
        <Heading as="h2">Across all rooms</Heading>
        {soldOut.length > 0 ? (
          <Tag type="red">
            {soldOut.length} sold out
          </Tag>
        ) : (
          <Tag type="green">All items in stock</Tag>
        )}
      </Head>

      <Note>
        Every stocked item and how many exist in the whole building. An item
        that reaches <strong>0 everywhere</strong> stops being offered on the
        public menu automatically — it does not wait for anyone to untick it.
      </Note>

      <Table columns="2.4fr 1fr 2.2fr 1.4fr">
        <Table.Header>
          <div>Item</div>
          <div>In total</div>
          <div>Where</div>
          <div>Value at cost</div>
        </Table.Header>

        <Table.Body
          data={totals}
          render={(row) => (
            <Table.Row key={row.menuItemId}>
              <div>{row.name}</div>

              <Count $none={row.total === 0}>{row.total}</Count>

              {row.total === 0 ? (
                <Tag type="red">Off the menu</Tag>
              ) : (
                <Where>{row.rooms.join(" · ")}</Where>
              )}

              <Money>
                {row.cost == null ? (
                  <span style={{ color: "var(--color-grey-500)" }}>
                    cost not set
                  </span>
                ) : (
                  formatMenuPrice(row.cost * row.total, row.currency)
                )}
              </Money>
            </Table.Row>
          )}
        />
      </Table>

      <Note>
        <strong>{formatMenuPrice(valueAtCost, "RWF")}</strong> of stock is
        sitting on the shelves, valued at what it cost to buy rather than what
        it will sell for — unsold stock has not earned anything yet.
        {anyUnpriced
          ? " Items with no buying price recorded are left out of that figure."
          : ""}
      </Note>
    </Panel>
  );
}

export default StockTotals;
