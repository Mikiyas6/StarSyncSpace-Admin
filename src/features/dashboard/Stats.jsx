import { Banknote, Briefcase, CalendarCheck2, Gauge } from "lucide-react";
import Stat from "./Stat";
import { formatRwf } from "../../utils/fx";
import { useFxRate } from "../fx/useFxRate";
import { bookingRevenueRwf } from "./revenue";

const BUSINESS_HOURS_PER_DAY = 10;

function Stats({ bookings, confirmedStays, numDays, roomCount }) {
  /* The dashboard speaks one currency, and it is RWF — what customers
     actually pay and what the business banks. Rooms are PRICED in USD,
     so this figure is a conversion; it uses the same bookingRevenueRwf()
     as the revenue section below, so the headline "Sales" and the
     "Meeting rooms" card can never quote two different numbers for the
     same booking. */
  const { rate } = useFxRate();

  // 1.
  const numBookings = bookings.length;

  // 2.
  const sales = bookings.reduce(
    (acc, cur) => acc + bookingRevenueRwf(cur, rate).rwf,
    0,
  );

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
        value={formatRwf(sales)}
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
