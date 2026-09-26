/* ------------------------------------------------------------------
   Local wall-clock times, as the strings a form holds them in.

   Every date-and-time control in the admin — the booking picker, and
   anything that follows it — carries its value as "YYYY-MM-DDTHH:mm":
   the shape <input type="datetime-local"> speaks, with no timezone on
   it. These two convert between that string and a Date, and they live
   here rather than next to any one control because the string is the
   shared contract, not the control's private business.
   ------------------------------------------------------------------ */

/* toISOString() would hand back UTC and silently shift the value by the
   timezone offset, which in Kigali is two hours of free room time. */
export function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/* The inverse. An empty or half-typed value is a normal state on the way
   to a filled-in one, not an error, so it comes back as null rather than
   as an Invalid Date that every caller then has to test for. */
export function parseLocalInput(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
