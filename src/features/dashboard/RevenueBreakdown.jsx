import styled from "styled-components";

import DashboardBox from "./DashboardBox";
import Heading from "../../ui/Heading";
import Tag from "../../ui/Tag";
import { STREAMS, STREAM_META, STREAM_ORDER } from "./revenue";
import { reasonLabel, reasonMeta } from "../../utils/stock";

const Grid = styled.div`
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(24rem, 1fr));
  gap: 2.4rem;
`;

const Card = styled(DashboardBox)`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

const Total = styled.p`
  font-size: 3rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-grey-700);
  line-height: 1.1;
`;

const Caption = styled.p`
  color: var(--color-grey-500);
  font-size: 1.3rem;
`;

/* A one-bar share meter under each figure. Not a chart — it carries no
   axis and no scale — but it answers "how much of the whole is this?"
   without making anyone divide two six-figure numbers in their head. */
const Meter = styled.div`
  height: 0.8rem;
  border-radius: 100px;
  background-color: var(--color-grey-100);
  overflow: hidden;

  & span {
    display: block;
    height: 100%;
    border-radius: 100px;
    background-color: ${(props) => props.$color};
    width: ${(props) => props.$percent}%;
  }
`;

const Profit = styled.p`
  font-size: 1.3rem;
  line-height: 1.6;
  border-radius: var(--border-radius-sm);
  padding: 0.8rem 1.2rem;
  color: ${(props) =>
    props.$loss ? "var(--color-red-700)" : "var(--color-green-700)"};
  background-color: ${(props) =>
    props.$loss ? "var(--color-red-100)" : "var(--color-green-100)"};

  & strong {
    font-variant-numeric: tabular-nums;
  }
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;

  & h3 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-grey-600);
  }
`;

const Swatch = styled.span`
  width: 1.2rem;
  height: 1.2rem;
  border-radius: 3px;
  flex-shrink: 0;
  background-color: ${(props) => props.$color};
`;

const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  font-size: 1.4rem;

  & li {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 1.2rem;
    align-items: baseline;
    color: var(--color-grey-600);
  }

  & strong {
    font-variant-numeric: tabular-nums;
    color: var(--color-grey-700);
  }

  & em {
    color: var(--color-grey-500);
    font-size: 1.2rem;
    font-style: normal;
  }
`;

/* ------------------------------------------------------------------
   A ranked row, for the two cards that list things rather than total
   them.

   These used to share `List`'s three columns — name, meta, figure, all
   on one line. That reads fine across the full width of "By room" and
   falls apart in a card a quarter of the dashboard wide, which is what
   these two are: the gap collapses and the line comes out as
   "2,000 RWF profit5,000 RWF", with the name of the item wrapping into
   its own unit count. So: the name and the money on the first line
   where the eye wants them, everything qualifying them underneath, and
   a bar carrying the comparison between rows that was otherwise being
   done by reading four-figure numbers off a list.
   ------------------------------------------------------------------ */
const Ranked = styled.ol`
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
  list-style: none;
  font-size: 1.4rem;
`;

const Row = styled.li`
  display: grid;
  grid-template-columns: 2.2rem 1fr auto;
  column-gap: 1.2rem;
  row-gap: 0.8rem;
  align-items: baseline;
`;

const LossRow = styled(Row)`
  grid-template-columns: 1fr auto;
  align-items: center;
`;

const Rank = styled.span`
  grid-column: 1;
  grid-row: 1;
  font-size: 1.2rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-grey-400);
`;

const Name = styled.span`
  grid-column: 2;
  grid-row: 1;
  font-weight: 500;
  color: var(--color-grey-700);
  /* Item names are whatever the fridge is stocked with, and
     "Vitalo Still Water 500ml" is not a short one. */
  overflow-wrap: anywhere;
`;

const Amount = styled.strong`
  grid-column: -2;
  grid-row: 1;
  font-variant-numeric: tabular-nums;
  color: var(--color-grey-700);
  white-space: nowrap;
`;

/* The same one-bar meter as the hero figures, thinner, and measured
   against the top row rather than against a total — the question here
   is "how far ahead is the best seller?", not "what share of everything
   is this?". */
const RowBar = styled(Meter)`
  grid-column: ${(props) => props.$from ?? 2} / -1;
  grid-row: 2;
  height: 0.6rem;
  /* Clear of the name above it: at 0.6rem tall and full row width, a bar
     any closer reads as an underline rather than a measurement. */
  margin-top: 0.2rem;
`;

const Meta = styled.span`
  grid-column: ${(props) => props.$from ?? 2} / -1;
  grid-row: 3;
  font-size: 1.2rem;
  line-height: 1.5;
  color: var(--color-grey-500);

  & b {
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    color: var(--color-grey-600);
  }
`;

/* Two cards side by side, and one under the other once there is no room
   for two — same auto-fit idiom as the stream cards, so the breakpoint
   is the content's rather than a number picked here. */
const Pair = styled.div`
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(32rem, 1fr));
  gap: 2.4rem;
`;

const Figure = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.8rem;
  flex-wrap: wrap;
`;

function rwf(value) {
  return `${Math.round(Number(value) || 0).toLocaleString("en-US")} RWF`;
}

function share(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

/* The first sentence of a reason's help text: what "Sent out" actually
   means, without the "does NOT affect sales" half that the card's own
   caption has already said once. */
function whatItMeans(reason) {
  const help = reasonMeta(reason)?.help;
  if (!help) return null;
  const [first] = help.split(". ");
  return first.endsWith(".") ? first : `${first}.`;
}

/* ------------------------------------------------------------------
   The headline figures, and what is behind them.

   A hero number per stream rather than a pie chart. A pie of three
   slices is the classic way to make three numbers harder to read than
   the three numbers would have been — and these three want comparing
   against their own history, not against each other's angles.
   ------------------------------------------------------------------ */
function RevenueBreakdown({
  totals,
  byRoom,
  topItems,
  shrinkage,
  isEstimated,
}) {
  /* Measured against the best seller rather than against the snack
     total, so the second-best row is visibly second-best instead of
     being a sliver next to a bar that is mostly the other seven items. */
  const topTakings = topItems[0]?.rwf ?? 0;

  const bestByProfit = topItems.reduce(
    (best, item) =>
      best === null || item.profitRwf > best.profitRwf ? item : best,
    null,
  );

  const lostUnits = shrinkage.reduce((sum, row) => sum + row.units, 0);

  return (
    <>
      <Grid>
        {STREAM_ORDER.map((stream) => (
          <Card key={stream}>
            <Head>
              <Swatch $color={STREAM_META[stream].color} />
              <Heading as="h3">{STREAM_META[stream].label}</Heading>
            </Head>
            <Total>{rwf(totals[stream])}</Total>
            <Meter
              $color={STREAM_META[stream].color}
              $percent={share(totals[stream], totals.total)}
            >
              <span />
            </Meter>
            <Caption>
              {share(totals[stream], totals.total)}% of {rwf(totals.total)}{" "}
              taken in this period
            </Caption>

            {/* Only the fridge has a cost of goods — an hour in a
                meeting room has no unit cost — so only the fridge can
                report a margin, and it says so here rather than leaving
                a blank line under the other two. */}
            {stream === STREAMS.SNACKS ? (
              <Profit $loss={totals.snacksProfitRwf < 0}>
                <strong>{rwf(totals.snacksProfitRwf)}</strong> profit after{" "}
                {rwf(totals.snacksCostRwf)} of stock sold
                {totals.snacksSpendRwf > 0 ? (
                  <>
                    <br />
                    {rwf(totals.snacksSpendRwf)} spent restocking in this period
                  </>
                ) : null}
                {/* The caveat that keeps the figure honest. Sales with no
                    buying price on file count as pure profit, because
                    there is nothing else to do with them — so the number
                    has to admit how much of it is unverified. */}
                {totals.unpricedUnits > 0 ? (
                  <>
                    <br />
                    {totals.unpricedUnits} unit
                    {totals.unpricedUnits === 1 ? "" : "s"} sold with no buying
                    price recorded, counted as all profit.
                  </>
                ) : null}
              </Profit>
            ) : null}
          </Card>
        ))}
      </Grid>

      {/* Only shown when it is true, and specific about HOW MUCH is an
          estimate rather than vaguely disclaiming the whole figure. */}
      {isEstimated && totals.estimatedRwf > 0 ? (
        <Caption style={{ gridColumn: "1 / -1" }}>
          {rwf(totals.estimatedRwf)} of this was converted from USD at
          today&apos;s rate rather than read off the booking.{" "}
          {totals.restatedCount > 0 ? (
            <>
              {/* Only worth naming the amount again when it is not simply
                  all of the figure in the sentence before this one. */}
              {totals.restatedRwf < totals.estimatedRwf
                ? `${rwf(totals.restatedRwf)} of that is `
                : "That is "}
              {totals.restatedCount} booking
              {totals.restatedCount === 1 ? "" : "s"} whose stored RWF total
              cannot be true of its own USD price — frozen against a length the
              booking is no longer for — so the USD price was used instead.
              Worth correcting on the booking rather than caveating here
              forever.{" "}
            </>
          ) : (
            <>
              Those bookings predate the column that records what was actually
              charged.{" "}
            </>
          )}
          Everything else is the amount taken at the time.
        </Caption>
      ) : null}

      <Card style={{ gridColumn: "1 / -1" }}>
        <Heading as="h2">By room</Heading>
        <Caption>
          What each room earned from bookings, and separately from the snacks
          and drinks sold in it.
        </Caption>

        {byRoom.length === 0 ? (
          <Caption>No rooms to report on.</Caption>
        ) : (
          <List>
            {byRoom.map((room) => (
              <li key={room.roomId}>
                <span>
                  {room.roomName}{" "}
                  <Tag
                    type={
                      room.roomType === "shared_space" ? "indigo" : "silver"
                    }
                  >
                    {room.roomType === "shared_space" ? "Desks" : "Room"}
                  </Tag>
                </span>
                <em>
                  {rwf(room.bookingsRwf)} bookings · {rwf(room.snacksRwf)}{" "}
                  snacks
                  {room.snacksRwf > 0
                    ? ` (${rwf(room.snacksProfitRwf)} profit)`
                    : ""}
                </em>
                <strong>{rwf(room.totalRwf)}</strong>
              </li>
            ))}
          </List>
        )}
      </Card>

      <Pair>
        <Card>
          <Heading as="h2">Best sellers</Heading>
          <Caption>
            What the fridges shifted, ranked by takings. The bar compares each
            item with the one at the top.
          </Caption>

          {topItems.length === 0 ? (
            <Caption>Nothing was sold from the fridges in this period.</Caption>
          ) : (
            <>
              <Ranked>
                {topItems.map((item, index) => (
                  <Row key={item.menuItemId}>
                    <Rank>{index + 1}</Rank>
                    <Name>{item.name}</Name>
                    <Amount>{rwf(item.rwf)}</Amount>
                    <RowBar
                      $color={STREAM_META[STREAMS.SNACKS].color}
                      $percent={share(item.rwf, topTakings)}
                    >
                      <span />
                    </RowBar>
                    {/* Units and profit, not units alone. The best seller by
                        takings and the best seller by profit are often not
                        the same item, and stocking decisions follow the
                        second one — so the margin is on the row rather than
                        left to be worked out from two figures. */}
                    <Meta>
                      <b>{item.units}</b> sold · <b>{rwf(item.profitRwf)}</b>{" "}
                      profit
                      {item.rwf > 0
                        ? ` · ${share(item.profitRwf, item.rwf)}% margin`
                        : ""}
                    </Meta>
                  </Row>
                ))}
              </Ranked>

              {/* Said out loud when the two rankings disagree, because that
                  is exactly the case where the list alone misleads. */}
              {bestByProfit &&
              bestByProfit.menuItemId !== topItems[0].menuItemId ? (
                <Caption>
                  {topItems[0].name} takes the most money, but{" "}
                  {bestByProfit.name} makes the most profit —{" "}
                  {rwf(bestByProfit.profitRwf)} of it.
                </Caption>
              ) : null}
            </>
          )}
        </Card>

        <Card>
          <Heading as="h2">Left without being sold</Heading>
          <Caption>
            Stock that went out of a room for any reason other than a sale. None
            of this touches the takings — that is the point of recording it
            separately — but a room losing a dozen waters a week to write-offs
            is worth knowing about.
          </Caption>

          {shrinkage.length === 0 ? (
            <Caption>
              Nothing was removed or written off in this period.
            </Caption>
          ) : (
            <>
              {/* One number first. A list of three reasons does not answer
                  "how much walked out of the fridges?" until somebody adds
                  it up, and that is the question the card exists for. */}
              <Figure>
                <Total>{lostUnits.toLocaleString("en-US")}</Total>
                <Caption>
                  unit{lostUnits === 1 ? "" : "s"} left the fridges without
                  being sold
                </Caption>
              </Figure>

              <Ranked>
                {shrinkage.map((row) => {
                  const tag = reasonMeta(row.reason)?.tag ?? "silver";
                  return (
                    <LossRow key={row.reason}>
                      {/* The same coloured tag the movement carries
                          everywhere else in the admin, so "Wasted" reads as
                          the same thing here as it does in the ledger. */}
                      <Tag type={tag}>{reasonLabel(row.reason)}</Tag>
                      <Amount>{row.units}</Amount>
                      <RowBar
                        $from={1}
                        $color={`var(--color-${tag}-700)`}
                        $percent={share(row.units, lostUnits)}
                      >
                        <span />
                      </RowBar>
                      <Meta $from={1}>
                        <b>{share(row.units, lostUnits)}%</b> of what was lost ·{" "}
                        {whatItMeans(row.reason)}
                      </Meta>
                    </LossRow>
                  );
                })}
              </Ranked>
            </>
          )}
        </Card>
      </Pair>
    </>
  );
}

export default RevenueBreakdown;
