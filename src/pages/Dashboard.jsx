import Heading from "../ui/Heading";
import Row from "../ui/Row";
import DashboardLayout from "../features/dashboard/DashboardLayout";
import DashboardFilter from "../features/dashboard/DashboardFilter";
import { useReconcileStatuses } from "../features/bookings/useReconcileStatuses";

function Dashboard() {
  // The dashboard counts stays by status, so it has to see the same
  // clock-corrected statuses the bookings list does.
  useReconcileStatuses();

  return (
    <>
      <Row type="horizontal">
        <Heading as="h1">Dashboard</Heading>
        <DashboardFilter />
      </Row>
      <DashboardLayout />
    </>
  );
}

export default Dashboard;
