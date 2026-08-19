import {
  Banknote,
  Briefcase,
  CalendarCheck2,
  Gauge,
} from "lucide-react";
import Stat from "./Stat";
import { formatCurrency } from "../../utils/helpers";

const BUSINESS_HOURS_PER_DAY = 10;

function Stats({ bookings, confirmedStays, numDays, roomCount }) {
  // 1.
  const numBookings = bookings.length;

  // 2.
  const sales = bookings.reduce((acc, cur) => acc + cur.totalPrice, 0);

  // 3.
  const checkedIns = confirmedStays?.length || 0;

  // 4.
  const occupation =
    confirmedStays?.reduce((acc, cur) => acc + cur.numHours, 0) /
    (numDays * roomCount * BUSINESS_HOURS_PER_DAY);
  // sum of booked hours / all available hours (num days * num rooms * opening hours)

  return (
    <>
      <Stat
        title="Bookings"
        color="indigo"
        icon={<Briefcase />}
        value={numBookings}
      />
      <Stat
        title="Sales"
        color="green"
        icon={<Banknote />}
        value={formatCurrency(sales)}
      />
      <Stat
        title="Bookings in use"
        color="coral"
        icon={<CalendarCheck2 />}
        value={checkedIns}
      />
      <Stat
        title="Occupancy rate"
        color="yellow"
        icon={<Gauge />}
        value={Math.round(occupation * 100) + "%"}
      />
    </>
  );
}

export default Stats;