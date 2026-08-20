import styled from "styled-components";
import Heading from "../../ui/Heading";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const ChartBox = styled.div`
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-100);
  border-radius: var(--border-radius-md);

  padding: 2.4rem 3.2rem;
  grid-column: 1 / -1;
  grid-row: 4;

  & > *:first-child {
    margin-bottom: 1.6rem;
  }

  & .recharts-pie-label-text {
    font-weight: 600;
  }
`;

const startData = [
  {
    duration: "1 hr",
    value: 0,
    color: "#10b981",
  },
  {
    duration: "2 hrs",
    value: 0,
    color: "#059669",
  },
  {
    duration: "3 hrs",
    value: 0,
    color: "#f59e0b",
  },
  {
    duration: "4 hrs",
    value: 0,
    color: "#d97706",
  },
  {
    duration: "5-6 hrs",
    value: 0,
    color: "#f96f5c",
  },
  {
    duration: "7-8 hrs",
    value: 0,
    color: "#64748b",
  },
  {
    duration: "8+ hrs",
    value: 0,
    color: "#64748b",
  },
];

const tooltipStyle = {
  backgroundColor: "var(--color-grey-0)",
  color: "var(--color-grey-700)",
  border: "1px solid var(--color-grey-100)",
  borderRadius: "var(--border-radius-sm)",
  fontSize: "1.3rem",
};

const legendStyle = {
  color: "var(--color-grey-600)",
  fontSize: "1.3rem",
};

function prepareData(startData, stays) {
  function incArrayValue(arr, field) {
    return arr?.map((obj) =>
      obj.duration === field ? { ...obj, value: obj.value + 1 } : obj
    );
  }

  const data = stays
    ?.reduce((arr, cur) => {
      const num = cur.numHours;
      if (num === 1) return incArrayValue(arr, "1 hr");
      if (num === 2) return incArrayValue(arr, "2 hrs");
      if (num === 3) return incArrayValue(arr, "3 hrs");
      if (num === 4) return incArrayValue(arr, "4 hrs");
      if (num >= 5 && num <= 6) return incArrayValue(arr, "5-6 hrs");
      if (num >= 7 && num <= 8) return incArrayValue(arr, "7-8 hrs");
      if (num > 8) return incArrayValue(arr, "8+ hrs");
      return arr;
    }, startData)
    .filter((obj) => obj.value > 0);

  return data;
}

function DurationChart({ confirmedStays }) {
  const data = prepareData(startData, confirmedStays);

  return (
    <ChartBox>
      <Heading as="h2">Booking length summary</Heading>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            nameKey="duration"
            dataKey="value"
            innerRadius={85}
            outerRadius={110}
            cx="40%"
            cy="50%"
            paddingAngle={3}
          >
            {data?.map((entry) => (
              <Cell
                fill={entry.color}
                stroke={entry.color}
                key={entry.duration}
              />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend
            verticalAlign="middle"
            align="right"
            width="30%"
            layout="vertical"
            iconSize={15}
            iconType="circle"
            wrapperStyle={legendStyle}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

export default DurationChart;