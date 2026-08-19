import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GlobalStyles from "./styles/GlobalStyles";
import Dashboard from "./pages/Dashboard";
import Bookings from "./pages/Bookings";
import Rooms from "./pages/Rooms";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import Menu from "./pages/Menu";
import Account from "./pages/Account";
import Login from "./pages/Login";
import PageNotFound from "./pages/PageNotFound";
import AppLayout from "./ui/AppLayout";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "react-hot-toast";
import Booking from "./pages/Booking";
import Checkin from "./pages/Checkin";
import ProtectedRoute from "./ui/ProtectedRoute";

/*
- QueryClient is a data-management system for the entire application.
- It is responsible for:
  - Setting up the cache
  - Stores fetched data in the cache
  - Controls when to refetch the data by setting the staleTime property
- It is typically passed to a QueryClientProvider to be used throughout your React app.
  - We're basically creating a place where all the data will live like a global store for all the queries and then later, we're going to provide it to the entire application
 */
const queryClient = new QueryClient({
  // Allows you to configure the default behavior of queries in React Query.
  defaultOptions: {
    queries: {
      // staleTime: 60 * 1000,
      staleTime: 20000,
      refetchOnWindowFocus: false,
      retry: 1,
      /*
Purpose: The amount of time that the data in the cache will stay fresh or will stay valid until it is fetched again by React Query

Fresh Data: is the data that is currently in the cache and is still valid.

Stale Data: is the data that is not valid anymore.

After 60,000ms (1 minute), the data is considered stale, and if a component mounts that needs that data, or a query is triggered, it will refetch.

Example Behavior:
- If you fetch data and revisit the component within 1 minute, it won’t trigger a new request.
- After 1 minute, if the same query is used again, React Query will automatically refetch the data.

📌 When Does React Query Refetch Stale Data?
If you set staleTime: 1 minute, the data remains fresh for one minute. Once that minute passes, the data is marked as stale in the cache. Now, the question is:
👉 Will React Query automatically refetch when data becomes stale, or does it need a trigger?

🟢 React Query Will NOT Automatically Refetch When Data Becomes Stale
Even though React Query knows the data is stale (you can see it in DevTools), it won't refetch it automatically unless there’s a trigger.

🚀 React Query refetches data only in response to:
1️⃣ A Component Mounting:

If you navigate away and back to the component, React Query checks if the data is stale and will refetch it automatically (unless refetchOnMount: false).
2️⃣ Window Focus (Default Behavior):

If you switch tabs or minimize the app and return, React Query checks if the data is stale and automatically refetches it (unless refetchOnWindowFocus: false).
3️⃣ Calling refetch() Manually:

You can force a refetch anytime using queryClient.refetchQueries(["queryKey"]).
4️⃣ Query Becomes Invalidated (Like in onSuccess)

If we call queryClient.invalidateQueries(["queryKey"]), it forces a refetch, even if the data is still fresh.
📌 Example Scenarios
🔴 Case 1: No Trigger (Only Stale Data)
staleTime: 60 * 1000 (1 min)
You leave the component open without interacting.
No refetch happens automatically, even after 1 min.
Data is marked stale in DevTools, but React Query doesn’t fetch it.
🟢 Case 2: User Switches Tabs
After 1 minute, the data becomes stale.
User switches to another tab and comes back.
React Query automatically refetches the data.
🟢 Case 3: User Navigates Away & Returns
You go to another page and come back after 1 minute.
The component mounts again, and React Query fetches new data.
🟢 Case 4: User Calls refetch()
You manually trigger a refetch using:

const { refetch } = useQuery({
  queryKey: ["bookings"],
  queryFn: fetchBookings,
});

<button onClick={() => refetch()}>Refresh Data</button>;

This forces a fresh fetch from the API.

🟢 Case 5: Mutation Invalidates Queries
onSuccess calls queryClient.invalidateQueries(["bookings"]).
React Query immediately refetches fresh data after a mutation.


- Moral of the story is, Data will only be re-fetched if a the stale time is passed or a manual reload happens. Data will be fetched and stay the same that way for the amount of time we specified in the stale property even if the data is modified in the database. Since the cache is only updated after the time we specified has been passed or a reload happens, components who subscribed to the data will reflect the stale data till that time ends or the manual reload happens. No moving to another tab or component will help. But a reload does. But once the data is stale, moving to other tab and coming back, unmounting it and mounting it back will cause a refetch and a corresponding UI update will happen.
      */
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
        {import.meta.env.DEV && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
        <GlobalStyles />
        {/* BrowserRouter is a component that allows you to manage the routing of your application. It is a wrapper that allows you to manage the routing of your application. */}
        <HashRouter>
          <Routes>
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate replace to="/dashboard" />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="bookings" element={<Bookings />} />
              <Route path="bookings/:bookingId" element={<Booking />} />
              <Route path="checkin/:bookingId" element={<Checkin />} />
              <Route path="rooms" element={<Rooms />} />
              <Route path="users" element={<Users />} />
              <Route path="settings" element={<Settings />} />
              <Route path="menu" element={<Menu />} />
              <Route path="account" element={<Account />} />
            </Route>
            <Route path="login" element={<Login />} />
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </HashRouter>
        <Toaster
          position="top-center"
          gutter={12} // The space between multiple toasts
          containerStyle={{ margin: "8px" }}
          toastOptions={{
            // How long a success toast stays on the screen
            success: {
              duration: 3000,
            },
            // How long an Error toast stays on the screen
            error: {
              duration: 5000,
            },
            style: {
              fontSize: "16px",
              maxWidth: "500px",
              padding: "16px 24px",
              backgroundColor: "var(--color-grey-0)",
              color: "var(--color-grey-700)",
            },
          }}
        />
      </QueryClientProvider>
  );
}

export default App;
