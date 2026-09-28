import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { MINUTE_MS, roundUpToStep } from "../../utils/booking";
import { parseLocalInput, toLocalInputValue } from "../../utils/datetime";
import { KINDS } from "./availability";

/* ------------------------------------------------------------------
   The search itself lives in the URL.

   Not in component state, for three reasons that all turned up while
   this was being built:

     - the rooms page has to know whether a search is running, so it can
       show the board instead of the management table. State inside the
       panel would mean lifting it into the page and threading it back
       down through both.
     - a desk reloads. An admin who has just worked out that Room 4 is
       free from 16:15, then refreshes or comes back from the booking
       they took, should find the same question still asked.
     - it is the pattern every other filter on this page already uses
       (ui/Filter, ui/SortBy, ui/Pagination all read searchParams), so a
       shared link to "everything free at four tomorrow" works for free.

   Written with `replace` so that typing a time does not leave forty
   entries in the browser's history for the back button to walk through.
   ------------------------------------------------------------------ */

export const DEFAULT_SEARCH_MINUTES = 60;

/* The question the search opens with: from the next quarter hour, for an
   hour. The same grid and the same default the booking form uses, because
   the commonest thing that happens next is that this window is carried
   straight into it. */
export function defaultSearchWindow(now = new Date()) {
  const start = roundUpToStep(now);
  return {
    from: toLocalInputValue(start),
    to: toLocalInputValue(
      new Date(start.getTime() + DEFAULT_SEARCH_MINUTES * MINUTE_MS),
    ),
  };
}

export function useAvailabilitySearch() {
  const [searchParams, setSearchParams] = useSearchParams();

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const kind = searchParams.get("kind") ?? KINDS.ALL;
  const people = Math.max(1, Number(searchParams.get("people")) || 1);
  const onlyFree = searchParams.get("free") === "1";

  const start = useMemo(() => parseLocalInput(from), [from]);
  const end = useMemo(() => parseLocalInput(to), [to]);

  /* A search is RUNNING once both ends describe a real stretch of time.
     Half-typed is not an error — it is the state between two keystrokes —
     so it simply is not active yet. */
  const isActive = Boolean(start && end && end > start);
  const minutes = isActive ? Math.round((end - start) / MINUTE_MS) : 0;

  const patch = useCallback(
    (changes) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value === null || value === undefined || value === "")
              next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  /* Moving the start MOVES the window rather than resizing it — the same
     rule the booking form's two boxes follow (see bookingWindow.js), and
     for the same reason: "make it an hour later" means the same hour,
     later, not an hour that now ends where it used to. */
  const setStart = useCallback(
    (value) => {
      const nextStart = parseLocalInput(value);
      if (!nextStart || !minutes) return patch({ from: value });
      return patch({
        from: value,
        to: toLocalInputValue(new Date(nextStart.getTime() + minutes * MINUTE_MS)),
      });
    },
    [minutes, patch],
  );

  const setEnd = useCallback((value) => patch({ to: value }), [patch]);

  const setLength = useCallback(
    (lengthMinutes) => {
      if (!start) return;
      patch({
        to: toLocalInputValue(
          new Date(start.getTime() + lengthMinutes * MINUTE_MS),
        ),
      });
    },
    [start, patch],
  );

  /* Jumping to a suggested "free from". It keeps the LENGTH the admin
     asked for, because the whole point of the suggestion is the same
     booking at a time it will fit. */
  const moveTo = useCallback(
    (date) => {
      const length = minutes || DEFAULT_SEARCH_MINUTES;
      patch({
        from: toLocalInputValue(date),
        to: toLocalInputValue(new Date(date.getTime() + length * MINUTE_MS)),
      });
    },
    [minutes, patch],
  );

  /* A whole window at once, for the one-click shortcuts ("this
     afternoon"). Both ends are written together rather than through
     setStart/setEnd, which would move the second one twice. */
  const setWindow = useCallback(
    (window) => patch({ from: window.from, to: window.to }),
    [patch],
  );

  const open = useCallback(
    (now = new Date()) => patch(defaultSearchWindow(now)),
    [patch],
  );

  /* Back to the plain rooms list. Only the search's own keys are dropped,
     so the sort and the discount filter the admin set on the table are
     still there when the board closes. */
  const clear = useCallback(
    () => patch({ from: null, to: null, kind: null, people: null, free: null }),
    [patch],
  );

  return {
    from,
    to,
    kind,
    people,
    onlyFree,
    start,
    end,
    minutes,
    isActive,
    setStart,
    setEnd,
    setLength,
    setWindow,
    setKind: (value) => patch({ kind: value === KINDS.ALL ? null : value }),
    setPeople: (value) => patch({ people: value > 1 ? value : null }),
    setOnlyFree: (value) => patch({ free: value ? "1" : null }),
    moveTo,
    open,
    clear,
  };
}
