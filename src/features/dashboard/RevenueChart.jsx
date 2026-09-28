import styled from "styled-components";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DashboardBox from "./DashboardBox";
import Heading from "../../ui/Heading";
import { STREAM_META, STREAM_ORDER } from "./revenue";

const Styled = styled(DashboardBox)`
  grid-column: 1 / -1;

  & .recharts-cartesian-grid-horizontal line,
  & .recharts-cartesian-grid-vertical line {
    stroke: var(--color-grey-200);
  }
`;

const Head = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1.6rem;
  flex-wrap: wrap;
`;

const Sub = styled.p`
  color: var(--color-grey-500);
  font-size: 1.3rem;
`;

const TooltipCard = styled.div`
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-sm);
  box-shadow: var(--shadow-md);
  padding: 1.2rem 1.4rem;
  font-size: 1.3rem;
  min-width: 20rem;

  & h4 {
    font-weight: 600;
    margin-bottom: 0.8rem;
    color: var(--color-grey-700);
  }

  & dl {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.4rem 0.8rem;
  }

  & dt {
    display: contents;
  }

  & .total {
    border-top: 1px solid var(--color-grey-100);
    margin-top: 0.8rem;
    padding-top: 0.8rem;
    display: flex;
    justify-content: space-between;
    font-weight: 600;
    color: var(--color-grey-700);
  }
`;

const Swatch = styled.span`
  width: 1rem;
  height: 1rem;
  border-radius: 3px;
  background-color: ${(props) => props.$color};
`;

const Value = styled.span`
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--color-grey-700);
`;

const Label = styled.span`
  color: var(--color-grey-500);
`;

function rwf(value) {
  return `${Math.round(Number(value) || 0).toLocaleString("en-US")} RWF`;
}

/* Compact tick labels: an axis reading "1,200,000" three times over is
   mostly zeroes, and the tooltip carries the exact figure anyway. */
function compact(value) {
  const amount = Number(value) || 0;
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return String(amount);
}

/* Every stream on every row, in fixed order, with the total underneath.

   Recharts' default tooltip lists only the series with a value, which
   means the rows move about as you sweep across the chart and a stream
   that earned nothing silently disappears. This one always shows all
   three, in the same order, so the eye can compare one bar to the next
   without re-reading the labels. */
function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const row = payload[0].payload;

  return (
    <TooltipCard>
      <h4>{label}</h4>
      <dl>
        {STREAM_ORDER.map((stream) => (
          <dt key={stream}>
            <Swatch $color={STREAM_META[stream].color} />
            <Label>{STREAM_META[stream].label}</Label>
            <Value>{rwf(row[stream])}</Value>
          </dt>
        ))}
      </dl>
      <div className="total">
        <span>Total</span>
        <span>{rwf(row.total)}</span>
      </div>
    </TooltipCard>
  );
}

/* ------------------------------------------------------------------
   Takings over time, split three ways.

   STACKED rather than grouped, because the question is both "how much
   did we take" and "where did it come from" — a stacked bar answers
   both at once, and the total is the thing most people look at first.

   ONE y-axis, in RWF. Rooms are priced in USD and snacks in RWF, and the
   temptation is a second axis for the second currency; that is the
   classic way to draw two series that cannot be compared and imply that
   they can. Everything is converted to what was actually charged
   instead — see the note at the top of revenue.js.
   ------------------------------------------------------------------ */
function RevenueChart({ series, granularity, startDate, endDate }) {
  const perLabel = {
    day: "per day",
    week: "per week",
    month: "per month",
    year: "per year",
  }[granularity];

  const hasAnything = series.some((bucket) => bucket.total > 0);

  return (
    <Styled>
      <Head>
        <Heading as="h2">Where the money came from</Heading>
        <Sub>
          {perLabel} ·{" "}
          {startDate.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          })}{" "}
          –{" "}
          {endDate.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </Sub>
      </Head>

      {!hasAnything ? (
        <Sub style={{ padding: "6rem 0", textAlign: "center" }}>
          Nothing was taken in this period.
        </Sub>
      ) : (
        <ResponsiveContainer height={320} width="100%">
          <BarChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--color-grey-500)", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-grey-200)" }}
              minTickGap={16}
            />
            <YAxis
              tick={{ fill: "var(--color-grey-500)", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={compact}
              width={52}
            />
            <Tooltip
              content={<RevenueTooltip />}
              cursor={{ fill: "var(--color-grey-100)" }}
            />
            <Legend
              wrapperStyle={{ fontSize: "1.3rem", paddingTop: "0.8rem" }}
              iconType="square"
            />
            {STREAM_ORDER.map((stream, index) => (
              <Bar
                key={stream}
                dataKey={stream}
                stackId="revenue"
                name={STREAM_META[stream].label}
                fill={STREAM_META[stream].color}
                /* A 2px gap in the surface colour between segments, so
                   two stacked fills never touch — which is what keeps
                   the boundary readable for a colour-blind reader, and
                   is the secondary encoding the palette check asks for. */
                stroke="var(--color-grey-0)"
                strokeWidth={2}
                /* Rounded only on the top of the topmost segment: the
                   data-end, anchored to the baseline. */
                radius={index === STREAM_ORDER.length - 1 ? [4, 4, 0, 0] : 0}
                maxBarSize={56}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </Styled>
  );
}

export default RevenueChart;
