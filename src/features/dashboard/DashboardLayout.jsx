import styled from "styled-components";
import { useRecentBookings } from "./useRecentBookings";
import Spinner from "../../ui/Spinner";
import { useRecentStays } from "./useRecentStays";
import Stats from "./Stats";
import { useRooms } from "../rooms/useRooms";
import { lazy, Suspense } from "react";
import TodayActivity from "../check-in-out/TodayActivity";
import EndingSoon from "../check-in-out/EndingSoon";

const SalesChart = lazy(() => import("./SalesChart"));
const DurationChart = lazy(() => import("./DurationChart"));

const StyledDashboardLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  grid-template-rows: auto 34rem auto auto;
  gap: 2.4rem;
`;

const ChartFallback = styled.div`
  grid-column: 1 / -1;
  height: 30rem;
  border-radius: var(--border-radius-md);
  background: linear-gradient(
    90deg,
    var(--color-grey-100) 25%,
    var(--color-grey-50) 37%,
    var(--color-grey-100) 63%
  );
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;

  @keyframes shimmer {
    0% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0 50%;
    }
  }
`;

function DashboardLayout() {
  const { bookings, isLoading } = useRecentBookings();
  const { stays, confirmedStays, isLoading2, numDays, startDate, endDate } =
    useRecentStays();
  const { rooms, isLoading: isLoading3 } = useRooms();
  if (isLoading || isLoading2 || isLoading3) return <Spinner />;

  return (
    <StyledDashboardLayout>
      <Stats
        bookings={bookings}
        confirmedStays={confirmedStays}
        numDays={numDays}
        roomCount={rooms.length}
      />
      <TodayActivity />
      <EndingSoon />
      <Suspense fallback={<ChartFallback />}>
        <DurationChart confirmedStays={confirmedStays} />
        <SalesChart
          bookings={stays}
          startDate={startDate}
          endDate={endDate}
        />
      </Suspense>
    </StyledDashboardLayout>
  );
}

export default DashboardLayout;