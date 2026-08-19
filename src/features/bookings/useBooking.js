import { useQuery } from "@tanstack/react-query";
import { getBooking } from "../../services/apiBookings";
import { useParams } from "react-router-dom";

export function useBooking() {
  /*
useQuery is a React hook used inside components that acts as a bridge between our components and the QueryClient, offering:
✅ The actual data fetching using queryFn.
    - queryFn is the function that's actually responsible for querying(Fetching) the data from the server. The function needs to be asynchronous or need to return a promise.
    - useQuery just calls the function when needed and returns the data to the component.
✅ Gets query data from the cache (if available).
    - useQuery checks if the data is already cached. If it is, it returns the cached data to the component.
    - If the data is not cached, it fetches the data from the server and tells QueryClient to store it in the cache.

How It Works
- useQuery always asks QueryClient to see if data is already cached.
- If cached and fresh, it doesn’t fetch (returns cached data instantly).
- If stale or data is not there, it fetches new data using the provided function.
  */
  const { bookingId } = useParams();
  const {
    isLoading,
    data: booking,
    error,
  } = useQuery({
    /* 
- uniquely Identifies the data that we're going to query
- "bookings" indicates that this query fetches booking data.
- React Query uses it to cache and manage data associated with this key.
- If a query with the same queryKey exists in the cache and is still valid (not stale), React Query will use the cached data instead of refetching.
- If the data is stale or doesn’t exist in the cache, React Query triggers queryFn to fetch fresh data.
*/
    queryKey: ["booking", bookingId],
    queryFn: () => getBooking(bookingId), // This is the function that's actually responsible for querying(Fetching) the data from the API. The function needs to be asynchronous or need to return a promise
    retry: false, // If set to false, the query will not automatically retry on error.
  });
  /*
The `useQuery` hook returns several values, but the most important ones are:

1️⃣ `data` – The fetched data ✅  
- If the query is successful, `data` contains the fetched response.  
- If the query is still loading, `data` is `undefined`.

2️⃣ `isLoading` – True while fetching the data 🔄  
- Returns `true` when the request is in progress.  
- Returns `false` once data is fetched (or if an error occurs).

3️⃣ `error` – Contains error details (if any) ❌  
- If the request fails, `error` contains an Error object with details.  
- If the request succeeds, `error` is `null`.

4️⃣ `isError` – True if an error occurred ⚠️  
- Boolean flag that is `true` if the query failed.  

5️⃣ `isFetching` – True whenever a request is being made 🔄  
- Unlike `isLoading`, it also returns `true` during refetching (e.g., after cache invalidation).  

6️⃣ `refetch` – Manually trigger a refetch 🔄  
- If you want to fetch fresh data on demand, call `refetch()`.  

*/

  return { isLoading, booking, error };
}
