import styled from "styled-components";
import DashboardBox from "./DashboardBox";
import Heading from "../../ui/Heading";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { eachDayOfInterval, format, isSameDay } from "date-fns";
import { formatRwf } from "../../utils/fx";
import { useFxRate } from "../fx/useFxRate";
import { bookingRevenueRwf } from "./revenue";

const StyledSalesChart = styled(DashboardBox)`
  grid-column: 1 / -1;
  grid-row: 3;

  /* Hack to change grid line colors */
  & .recharts-cartesian-grid-horizontal line,
  & .recharts-cartesian-grid-vertical line {
    stroke: var(--color-grey-300);
  }
`;

/* Four digits of francs on every tick is a wall of numbers where an
   axis should be, so the axis goes compact ("40K") and the tooltip — the
   place you look when you want the actual figure — carries it in full. */
const compactRwf = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function SalesChart({ bookings, startDate, endDate }) {
  /* In RWF, like the rest of the dashboard. The room is priced in USD;
     this converts with the same bookingRevenueRwf() the revenue section
     uses, so a day's bar and that day's share of the "Meeting rooms"
     card are the same money. */
  const { rate } = useFxRate();

  const allDates = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const data = allDates.map((date) => {
    return {
      label: format(date, "MMM dd"),
      totalSales: bookings
        ?.filter((booking) => isSameDay(date, new Date(booking.created_at)))
        .reduce((acc, cur) => acc + bookingRevenueRwf(cur, rate).rwf, 0),
    };
  });

  const colors = {
    totalSales: {
      stroke: "var(--color-brand-600)",
      fill: "var(--color-grey-200)",
    },
    text: "var(--color-grey-600)",
    background: "var(--color-grey-0)",
  };

  return (
    <StyledSalesChart>
      <Heading as="h2">
        Room sales from {format(allDates.at(0), "MMM dd yyyy")} &mdash;{" "}
        {format(allDates.at(-1), "MMM dd yyyy")}{" "}
      </Heading>

      <ResponsiveContainer height={300} width="100%">
        <AreaChart data={data}>
          <XAxis
            dataKey="label"
            tick={{ fill: colors.text }}
            tickLine={{ stroke: colors.text }}
            minTickGap={20}
          />
          <YAxis
            tick={{ fill: colors.text }}
            tickLine={{ stroke: colors.text }}
            tickFormatter={(value) => compactRwf.format(Number(value) || 0)}
            width={56}
          />
          <CartesianGrid strokeDasharray="4" />
          <Tooltip
            contentStyle={{ backgroundColor: colors.background }}
            formatter={(value) => formatRwf(value)}
          />
          <Area
            dataKey="totalSales"
            type="monotone"
            stroke={colors.totalSales.stroke}
            fill={colors.totalSales.fill}
            strokeWidth={2}
            name="Room sales"
          />
        </AreaChart>
      </ResponsiveContainer>
    </StyledSalesChart>
  );
}

export default SalesChart;
