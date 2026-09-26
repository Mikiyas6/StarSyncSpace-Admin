/* ------------------------------------------------------------------
   The two clock times a desk booking is made of.

   The admin form used to ask for a start and then a length, chosen from
   a dropdown of 15-minute intervals. A desk does not work that way: the
   guest says "from now until six", and the person at the counter should
   not have to work out that half past two until six is three and a half
   hours — nor be stuck when the interval they want is not on the list.
   So the form asks for a start and an end, and the length becomes
   something this file works out.

   Both times live in <input type="datetime-local"> boxes, which speak
   local wall-clock strings with no timezone. That makes the string the
   form's state and these the functions that move it around. They are
   pure and they take the whole window at once, because the two ends are
   not independent: moving the start MOVES the booking rather than
   resizing it.
   ------------------------------------------------------------------ */

import { MINUTE_MS, roundUpToStep } from "../../utils/booking";
import { parseLocalInput, toLocalInputValue } from "../../utils/datetime";

/* The window the form opens with: starting at the next quarter hour, the
   same grid the public site's slot picker uses, and running for the
   default length. */
export function initialWindow(minutes, now = new Date()) {
  const start = roundUpToStep(now);
  return {
    start: toLocalInputValue(start),
    end: toLocalInputValue(new Date(start.getTime() + minutes * MINUTE_MS)),
  };
}

/* How long the window runs, in whole minutes, or 0 when it does not
   describe a length yet — either box empty, or an end that is not after
   its start. One number for "no length", so callers can ask `> 0`. */
export function windowMinutes(window) {
  const start = parseLocalInput(window?.start);
  const end = parseLocalInput(window?.end);
  if (!start || !end) return 0;
  const minutes = Math.floor((end.getTime() - start.getTime()) / MINUTE_MS);
  return minutes > 0 ? minutes : 0;
}

/* Moving the start moves the whole booking. A guest who says "actually,
   make it an hour later" means the same two hours an hour later, not two
   hours that now end when they used to — and re-typing the end every
   time the start slips is exactly the arithmetic this form exists to
   stop doing. With no length to preserve, the end is left alone for the
   admin to fill in. */
export function moveWindowStart(window, value) {
  const nextStart = parseLocalInput(value);
  const length = windowMinutes(window);
  if (!nextStart || length === 0) return { ...window, start: value };

  return {
    start: value,
    end: toLocalInputValue(new Date(nextStart.getTime() + length * MINUTE_MS)),
  };
}

export function setWindowEnd(window, value) {
  return { ...window, end: value };
}

/* What a quick-length button does. It is a shortcut for TYPING an end
   time, not a second way of stating the booking's length, so the end is
   the only thing it writes. */
export function endAfterLength(window, minutes) {
  const start = parseLocalInput(window?.start);
  if (!start) return window;
  return {
    ...window,
    end: toLocalInputValue(new Date(start.getTime() + minutes * MINUTE_MS)),
  };
}
