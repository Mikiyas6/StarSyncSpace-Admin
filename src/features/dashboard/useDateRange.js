import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  differenceInCalendarDays,
  endOfDay,
  endOfToday,
  parseISO,
  startOfDay,
  startOfToday,
  subDays,
} from "date-fns";

export function useDateRange() {
  const [searchParams] = useSearchParams();
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const preset = searchParams.get("last") || "7";

  return useMemo(() => {
    if (fromParam && toParam) {
      let start = startOfDay(parseISO(fromParam));
      let end = endOfDay(parseISO(toParam));

      if (start > end) {
        const swap = start;
        start = end;
        end = swap;
      }

      return {
        startDate: start,
        endDate: end,
        numDays: differenceInCalendarDays(end, start) + 1,
      };
    }

    const numDays = Number(preset) || 7;
    return {
      startDate: subDays(startOfToday(), numDays - 1),
      endDate: endOfToday(),
      numDays,
    };
  }, [fromParam, toParam, preset]);
}