import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays } from "date-fns";
import styled, { css } from "styled-components";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  AlertCircle,
  Armchair,
  ArrowRight,
  CalendarDays,
  CalendarRange,
  Check,
  Clock,
  Search,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";

import Button from "../../ui/Button";
import DateTimePicker from "../../ui/DateTimePicker";
import SpinnerMini from "../../ui/SpinnerMini";

import { useRooms } from "../rooms/useRooms";
import { useSettings } from "../settings/useSettings";
import { useCreateBooking } from "./useCreateBooking";
import { searchGuests, findOrCreateGuest } from "../../services/apiGuests";
import { getRoomBookingsAround } from "../../services/apiBookings";
import {
  FULL_DAY_MINUTES,
  durationBounds,
  formatDuration,
  priceForMinutes,
  rwfPerMinuteFromRoom,
  validateAdminBooking,
} from "../../utils/booking";
import {
  endAfterLength,
  initialWindow,
  moveWindowStart,
  setWindowEnd,
  windowMinutes,
} from "./bookingWindow";
import {
  parseLocalInput,
  toLocalDateValue,
  toLocalInputValue,
  toLocalTimeValue,
} from "../../utils/datetime";
import { formatCurrency, formatMenuPrice } from "../../utils/helpers";
import {
  DESK_STEP_MINUTES,
  MIN_DESK_MINUTES,
  PASS_TYPES,
  dayPassBeatsHourly,
  isSharedSpace,
  passWindow,
  passesFor,
  priceForPass,
  roundDeskMinutes,
  seatCapacity,
  seatsLeftAcrossRange,
  seatsTakenAcrossRange,
  validateSeatBooking,
} from "../../utils/spaces";
import { getRoomSeatBookings } from "../../services/apiBookings";
import { useFxRate } from "../fx/useFxRate";

/* ------------------------------------------------------------------
   Taking a booking for someone standing at the desk.

   The public site's form is built around a person browsing: a grid of
   start times an hour or more away, and a card payment before anything
   is written. Neither fits a walk-in. This asks the four questions the
   desk actually asks — which room, who, from when until when, and was
   it paid — defaults the start to "right now", and records that cash
   changed hands.

   On TIME: the length of a booking is a START and an END, typed as two
   clock times, because that is the sentence the guest says ("from now
   till six") and the one the desk has to read back to them. It used to
   be a dropdown of 15-minute intervals, which meant working out in your
   head that half past two until six is three and a half hours, and
   which could not express anything the list left out. The two times are
   now the input; the length is a number this form works out and shows
   back. Quick-length buttons remain, but they only move the end time —
   they are a shortcut for typing, not a separate way of saying it.

   On ERRORS: a disabled button is not an error message. It tells the
   admin that something is wrong and nothing about what, which is
   miserable when a guest is standing there waiting. So the submit
   button stays live; pressing it with something missing puts a numbered
   list of exactly what is wrong at the top of the sheet, marks each
   offending control, and jumps focus to the first one. After that first
   press the messages update live, so a field clears itself as it is
   filled in rather than waiting for another rejection.

   The rules that protect the ROOM are identical to the public site's
   (see utils/booking.js); only the rules that protect the CHECKOUT are
   dropped.
   ------------------------------------------------------------------ */

/* ------------------------------- shell ------------------------------ */

const Sheet = styled.form`
  width: min(96rem, 86vw);
  display: flex;
  flex-direction: column;
  gap: 2rem;
  font-size: 1.4rem;
`;

const Title = styled.div`
  & h2 {
    font-size: 2.2rem;
    font-weight: 600;
    line-height: 1.2;
  }
  & p {
    margin-top: 0.4rem;
    color: var(--color-grey-500);
    font-size: 1.3rem;
  }
`;

const Columns = styled.div`
  display: grid;
  gap: 2.4rem;
  grid-template-columns: 1.15fr 1fr;
  align-items: start;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
  min-width: 0;
`;

const Step = styled.section`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
`;

const StepHead = styled.h3`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-grey-500);

  & span[data-num] {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background-color: var(--color-grey-100);
    color: var(--color-grey-600);
    font-size: 1.1rem;
  }

  & small {
    margin-left: auto;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 500;
    color: var(--color-grey-400);
  }
`;

/* --------------------------- problem list --------------------------- */

const Problems = styled.div`
  border: 1px solid var(--color-red-700);
  background-color: var(--color-red-100);
  border-radius: var(--border-radius-md);
  padding: 1.4rem 1.8rem;

  & > p {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    font-weight: 600;
    color: var(--color-red-700);
    margin-bottom: 0.8rem;
  }

  & ol {
    margin: 0;
    padding-left: 2.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  & li {
    color: var(--color-red-700);
  }

  & li button {
    background: none;
    border: none;
    padding: 0;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
`;

const FieldError = styled.p`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1.25rem;
  font-weight: 500;
  color: var(--color-red-700);

  & svg {
    width: 1.5rem;
    height: 1.5rem;
    flex-shrink: 0;
  }
`;

const Hint = styled.p`
  font-size: 1.25rem;
  color: var(--color-grey-500);
`;

/* The two time boxes are the one place in this sheet where a placeholder
   cannot do the labelling for us: a datetime-local input shows a date
   mask, not a hint, so "Starts" and "Ends" have to be said out loud. */
const FieldLabel = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-grey-600);
`;

const QuickRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.8rem;

  & > span {
    font-size: 1.25rem;
    color: var(--color-grey-500);
  }
`;

/* ------------------------------ controls ---------------------------- */

const invalidRing = css`
  border-color: var(--color-red-700);
  box-shadow: 0 0 0 2px var(--color-red-100);
`;

const TextInput = styled.input`
  width: 100%;
  border: 1px solid var(--color-grey-300);
  background-color: var(--color-grey-0);
  border-radius: var(--border-radius-sm);
  box-shadow: var(--shadow-sm);
  padding: 0.9rem 1.2rem;
  font-size: 1.4rem;
  color: var(--color-grey-700);

  &:focus {
    outline: 2px solid var(--color-brand-600);
    outline-offset: -1px;
  }
  &:disabled {
    background-color: var(--color-grey-50);
    color: var(--color-grey-400);
  }
  ${(props) => props.$invalid && invalidRing}
`;

const NoteArea = styled.textarea`
  width: 100%;
  height: 7rem;
  resize: vertical;
  border: 1px solid var(--color-grey-300);
  background-color: var(--color-grey-0);
  border-radius: var(--border-radius-sm);
  box-shadow: var(--shadow-sm);
  padding: 0.9rem 1.2rem;
  font-size: 1.4rem;
  font-family: inherit;
  color: var(--color-grey-700);
`;

/* One dropdown for the rooms. They were cards in a grid, which reads
   nicely at eight rooms and turns into a wall at forty — and a wall is
   what the desk would have to scroll past to reach the guest and the
   times underneath it. Each room's facts (seats, rate) ride along in the
   option's own label, so the closed dropdown still shows them for the
   room that is chosen and nothing is lost by collapsing the grid. */
const NativeSelect = styled.select`
  width: 100%;
  border: 1px solid var(--color-grey-300);
  background-color: var(--color-grey-0);
  border-radius: var(--border-radius-sm);
  box-shadow: var(--shadow-sm);
  padding: 0.9rem 1.2rem;
  font-size: 1.4rem;
  font-weight: 500;
  font-family: inherit;
  color: var(--color-grey-700);
  ${(props) => props.$invalid && invalidRing}

  &:focus {
    outline: 2px solid var(--color-brand-600);
    outline-offset: -1px;
  }
  &:disabled {
    background-color: var(--color-grey-50);
    color: var(--color-grey-400);
  }
`;

/* GlobalStyles carries `button:has(svg) { line-height: 0 }` to tighten
   icon-only buttons. These buttons hold TEXT as well as an icon, and the
   rule fires the moment one is selected and grows a tick — collapsing
   the subtitle to zero height. So every text-bearing button below states
   its own line-height rather than inheriting that trap. */
const textButtonLineHeight = css`
  line-height: 1.4;

  & svg {
    line-height: 0;
  }
`;

const Segmented = styled.div`
  display: inline-flex;
  padding: 0.3rem;
  gap: 0.3rem;
  background-color: var(--color-grey-100);
  border-radius: var(--border-radius-sm);
`;

const Segment = styled.button`
  ${textButtonLineHeight}
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border: none;
  cursor: pointer;
  padding: 0.6rem 1.2rem;
  border-radius: calc(var(--border-radius-sm) - 0.2rem);
  font-size: 1.3rem;
  font-weight: 600;
  font-family: inherit;
  color: ${(props) =>
    props.$active ? "var(--color-grey-700)" : "var(--color-grey-500)"};
  background-color: ${(props) =>
    props.$active ? "var(--color-grey-0)" : "transparent"};
  box-shadow: ${(props) => (props.$active ? "var(--shadow-sm)" : "none")};

  & svg {
    width: 1.5rem;
    height: 1.5rem;
  }
`;

const Chip = styled.button`
  ${textButtonLineHeight}
  cursor: pointer;
  padding: 0.55rem 1.1rem;
  border-radius: 100px;
  font-size: 1.25rem;
  font-weight: 600;
  font-family: inherit;
  border: 1px solid
    ${(props) =>
      props.$active ? "var(--color-brand-600)" : "var(--color-grey-200)"};
  background-color: ${(props) =>
    props.$active ? "var(--color-brand-600)" : "var(--color-grey-0)"};
  color: ${(props) =>
    props.$active ? "var(--color-brand-50)" : "var(--color-grey-600)"};

  &:hover {
    border-color: var(--color-brand-600);
  }
`;

const GuestList = styled.ul`
  list-style: none;
  max-height: 16rem;
  overflow-y: auto;
  border: 1px solid
    ${(props) =>
      props.$invalid ? "var(--color-red-700)" : "var(--color-grey-200)"};
  border-radius: var(--border-radius-sm);
  ${(props) => props.$invalid && invalidRing}

  & li + li {
    border-top: 1px solid var(--color-grey-100);
  }
`;

const GuestButton = styled.button`
  ${textButtonLineHeight}
  width: 100%;
  display: flex;
  align-items: center;
  gap: 1rem;
  text-align: left;
  cursor: pointer;
  border: none;
  font-family: inherit;
  padding: 0.9rem 1.2rem;
  background-color: ${(props) =>
    props.$selected ? "var(--color-brand-50)" : "transparent"};

  &:hover {
    background-color: var(--color-grey-100);
  }

  & div {
    min-width: 0;
  }
  & strong {
    display: block;
    font-size: 1.35rem;
    font-weight: 600;
    color: var(--color-grey-700);
  }
  & span {
    display: block;
    font-size: 1.2rem;
    color: var(--color-grey-500);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  & svg {
    margin-left: auto;
    width: 1.7rem;
    height: 1.7rem;
    flex-shrink: 0;
    color: var(--color-brand-600);
  }
`;

const Pair = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.8rem;

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

const Toggle = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  cursor: pointer;
  padding: 0.9rem 1.2rem;
  border-radius: var(--border-radius-sm);
  border: 1px solid
    ${(props) =>
      props.$on ? "var(--color-brand-600)" : "var(--color-grey-200)"};
  background-color: ${(props) =>
    props.$on ? "var(--color-brand-50)" : "var(--color-grey-0)"};

  & input {
    margin-top: 0.2rem;
    width: 1.8rem;
    height: 1.8rem;
    accent-color: var(--color-brand-600);
    cursor: pointer;
  }
  & strong {
    display: block;
    font-weight: 600;
    color: var(--color-grey-700);
  }
  & span {
    display: block;
    font-size: 1.2rem;
    color: var(--color-grey-500);
  }
`;

/* ------------------------------ summary ----------------------------- */

const Summary = styled.div`
  border-radius: var(--border-radius-md);
  border: 1px solid var(--color-grey-200);
  background-color: var(--color-grey-50);
  padding: 1.4rem 1.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

const Line = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1.6rem;

  & dt {
    color: var(--color-grey-500);
    font-size: 1.3rem;
  }
  & dd {
    font-weight: 600;
    color: var(--color-grey-700);
    text-align: right;
  }
`;

const Total = styled(Line)`
  border-top: 1px solid var(--color-grey-200);
  padding-top: 0.8rem;

  & dd {
    font-family: "Space Grotesk";
    font-size: 1.9rem;
  }
  & dd small {
    display: block;
    font-family: inherit;
    font-size: 1.2rem;
    font-weight: 500;
    color: var(--color-grey-500);
  }
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1.2rem;
  border-top: 1px solid var(--color-grey-100);
  padding-top: 1.6rem;
`;

/* ------------------------------ helpers ----------------------------- */

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

const DEFAULT_MINUTES = 60;

/* Shortcuts that move the END time. Not a way of setting the booking's
   length — the two clock times are the only thing that does that. */
const QUICK_LENGTHS = [30, 60, 120, 240, 480, FULL_DAY_MINUTES];

const WHEN_FORMAT = {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
};

const TIME_FORMAT = { hour: "2-digit", minute: "2-digit" };

/* ------------------------------------------------------------------
   Step 3, when the space is sold by the desk.

   Replaces the From/to control entirely rather than sitting beside it.
   What the desk asks for a coworking seat is a different sentence — "two
   desks, a week from Monday" — and none of the clock machinery (quick
   lengths, "starts now", the turnaround gap) has a meaning here.

   Everything shown is computed by utils/spaces.js, the same module the
   public site and the seat trigger use. This component does no
   arithmetic of its own, so what the guest is quoted at the counter and
   what the database will accept cannot drift apart.
   ------------------------------------------------------------------ */
/* Dates without a time, for a pass that is measured in whole days. */
const DATE_ONLY = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/* For an hourly desk, which is the one pass measured in clock time. */
const TIME_ONLY = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

function SeatStep({
  room,
  passType,
  setPassType,
  passUnits,
  setPassUnits,
  passMinutes,
  setPassMinutes,
  passTime,
  setPassTime,
  seats,
  setSeats,
  passStart,
  setPassStart,
  passRange,
  seatsFree,
  price,
  dayNudge,
  isRateIndicative,
  /* True when "they are going in now" has taken the start over. The two
     boxes still SHOW the moment being written, so the sheet never
     disagrees with what it is about to save — they are just no longer
     anybody's to type in. */
  startPinnedToNow,
  busy,
  errorFor,
  registerField,
}) {
  const capacity = seatCapacity(room) ?? 0;
  const isMonthly = passType === PASS_TYPES.MONTH;
  const isHourly = passType === PASS_TYPES.HOURLY;
  /* Only the ways this particular space is actually sold. A space with no
     hourly rate must not offer an hourly button the database will refuse. */
  const passes = passesFor(room);

  /* The last day the guest actually gets. The window is half-open, so it
     ENDS at midnight on the day AFTER — printing that date would name a
     day they have not bought and invite an argument at the counter. */
  const lastDay = passRange
    ? isHourly
      ? passRange.end
      : addDays(passRange.end, -1)
    : null;

  return (
    <Step>
      <StepHead>
        <span data-num>3</span> Desks
        <small>
          {capacity} in {room?.name ?? "this space"}
        </small>
      </StepHead>

      {/* Day or month. Two options, so a segmented control rather than a
          dropdown — and the choice changes what "how many" means below
          it, which is easier to follow when both are visible at once. */}
      <Segmented>
        {passes.map((value) => {
          const meta = {
            [PASS_TYPES.HOURLY]: { label: "By the hour", Icon: Clock },
            [PASS_TYPES.DAY]: { label: "Day pass", Icon: CalendarDays },
            [PASS_TYPES.MONTH]: { label: "Monthly", Icon: CalendarRange },
          }[value];

          return (
            <Segment
              key={value}
              type="button"
              $active={passType === value}
              disabled={busy}
              onClick={() => {
                setPassType(value);
                setPassUnits(1);
                setPassMinutes(MIN_DESK_MINUTES);
              }}
            >
              <meta.Icon /> {meta.label}
            </Segment>
          );
        })}
      </Segmented>

      <Pair>
        <div>
          <FieldLabel htmlFor="passStart">Starting</FieldLabel>
          <TextInput
            id="passStart"
            type="date"
            value={passStart}
            disabled={busy || startPinnedToNow}
            ref={registerField("passStart")}
            $invalid={Boolean(errorFor("passStart"))}
            onChange={(e) => setPassStart(e.target.value)}
          />
          {/* No minimum on this input, unlike the public site's. A desk
              can be sold for today — that is the whole point of a form
              for somebody standing here — and backdating is occasionally
              how a pass that was taken this morning gets recorded this
              afternoon. */}
          {startPinnedToNow ? (
            <Hint>
              Held at today, because they are going in now. Untick that to
              sell a desk for a later date.
            </Hint>
          ) : null}
        </div>

        {isHourly ? (
          <div>
            <FieldLabel htmlFor="passTime">From</FieldLabel>
            <TextInput
              id="passTime"
              type="time"
              step={DESK_STEP_MINUTES * 60}
              value={passTime}
              disabled={busy || startPinnedToNow}
              onChange={(e) => setPassTime(e.target.value)}
            />
            {startPinnedToNow ? (
              <Hint>Following the clock — this desk starts the moment it is sold.</Hint>
            ) : null}
          </div>
        ) : (
          <div>
            <FieldLabel htmlFor="passUnits">
              {isMonthly ? "How many months?" : "How many days?"}
            </FieldLabel>
            <TextInput
              id="passUnits"
              type="number"
              min={1}
              max={isMonthly ? 12 : 60}
              value={passUnits}
              disabled={busy}
              onChange={(e) => setPassUnits(e.target.value)}
            />
          </div>
        )}
      </Pair>

      {isHourly ? (
        <Pair>
          <div>
            <FieldLabel htmlFor="passMinutes">For how long?</FieldLabel>
            <NativeSelect
              id="passMinutes"
              value={passMinutes}
              disabled={busy}
              onChange={(e) => setPassMinutes(Number(e.target.value))}
            >
              {/* One hour to twelve, in quarter-hour steps. A desk sold
                  for longer than that is a day pass, and the nudge below
                  says so. */}
              {Array.from(
                { length: (12 * 60 - MIN_DESK_MINUTES) / DESK_STEP_MINUTES + 1 },
                (_, i) => MIN_DESK_MINUTES + i * DESK_STEP_MINUTES,
              ).map((minutes) => (
                <option key={minutes} value={minutes}>
                  {formatDuration(minutes)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div />
        </Pair>
      ) : null}

      {/* Past the crossover, hourly costs MORE for LESS. The desk should
          know before it quotes the guest, not after. */}
      {dayNudge ? (
        <Hint
          style={{
            color: "var(--color-yellow-700)",
            backgroundColor: "var(--color-yellow-100)",
            borderRadius: "var(--border-radius-sm)",
            padding: "1rem 1.2rem",
          }}
        >
          <AlertCircle
            size={14}
            style={{ display: "inline", verticalAlign: "-2px" }}
          />{" "}
          A day pass is {formatMenuPrice(dayNudge.dayRwf, "RWF")} —{" "}
          {dayNudge.savedRwf > 0
            ? `${formatMenuPrice(dayNudge.savedRwf, "RWF")} less than this`
            : "the same price"}
          , and they keep the desk all day. Offer them the day pass.
        </Hint>
      ) : null}

      <Pair>
        <div>
          <FieldLabel htmlFor="seats">How many desks?</FieldLabel>
          <TextInput
            id="seats"
            type="number"
            min={1}
            max={Math.max(1, seatsFree ?? capacity)}
            value={seats}
            disabled={busy}
            ref={registerField("seats")}
            $invalid={Boolean(errorFor("seats"))}
            onChange={(e) => setSeats(e.target.value)}
          />
        </div>

        <div>
          <FieldLabel as="span">Free for those dates</FieldLabel>
          {/* The fullest day in the range, not the emptiest and not an
              average: a five-day pass needs its desk free on all five
              days, so this is the number that decides the sale. */}
          <Hint
            style={{
              fontSize: "1.8rem",
              fontWeight: 600,
              color:
                seatsFree === 0
                  ? "var(--color-red-700)"
                  : seatsFree !== null && seatsFree <= Math.ceil(capacity * 0.25)
                    ? "var(--color-yellow-700)"
                    : "var(--color-grey-700)",
            }}
          >
            <Armchair
              size={16}
              style={{ display: "inline", verticalAlign: "-2px" }}
            />{" "}
            {seatsFree === null ? "—" : `${seatsFree} of ${capacity}`}
          </Hint>
        </div>
      </Pair>

      {errorFor("seats") ? (
        <FieldError>
          <AlertCircle /> {errorFor("seats")}
        </FieldError>
      ) : null}
      {errorFor("passStart") ? (
        <FieldError>
          <AlertCircle /> {errorFor("passStart")}
        </FieldError>
      ) : null}
      {errorFor("passType") ? (
        <FieldError>
          <AlertCircle /> {errorFor("passType")}
        </FieldError>
      ) : null}

      {passRange && lastDay ? (
        <Hint>
          <Clock
            size={12}
            style={{ display: "inline", verticalAlign: "-1px" }}
          />{" "}
          {seats} desk{Number(seats) === 1 ? "" : "s"},{" "}
          {isHourly ? (
            <>
              {DATE_ONLY.format(passRange.start)}{" "}
              {TIME_ONLY.format(passRange.start)}
              {"–"}
              {TIME_ONLY.format(passRange.end)}
            </>
          ) : (
            <>
              {DATE_ONLY.format(passRange.start)}
              {" to "}
              {DATE_ONLY.format(lastDay)}
            </>
          )}
          {price ? (
            <>
              {" — "}
              <strong>{formatMenuPrice(price.rwf, "RWF")}</strong>
              {/* Every rate is quoted in francs since migration 21, so
                  the dollar figure is always the approximation. The
                  branch that said otherwise existed for the monthly
                  desk, which used to be priced in dollars. */}
              {` (≈ ${formatCurrency(price.usd)}${
                isRateIndicative ? ", indicative rate" : ""
              })`}
            </>
          ) : null}
        </Hint>
      ) : null}
    </Step>
  );
}

/* ------------------------------------------------------------------
   Opened already knowing the answer.

   The availability board on the rooms page works out which spaces can
   take a window and then opens this form on one of them. Re-typing the
   room and both times into a second form is exactly the work that screen
   exists to remove — and re-typing them is where a window that WAS free
   becomes one that is not, because a digit got fumbled.

   So every piece of state that has a sensible default gets an optional
   seed instead. The shape a caller passes:

     roomId     which room or space
     start, end the window, as Dates
     minutes    the length, for a desk sold by the hour
     seats      how many desks
     numGuests  how many people are coming
     passType   how a desk is being sold. The caller decides this, because
                only it knows whether the space HAS an hourly rate — an
                hourly pass on a space with no hour_rate_rwf is a sale the
                database will refuse.

   Absent, everything behaves exactly as it did: a blank room, a window
   starting at the next quarter hour, and "starts now" ticked.
   ------------------------------------------------------------------ */
function seededWindow(prefill) {
  if (!prefill?.start || !prefill?.end) return initialWindow(DEFAULT_MINUTES);
  return {
    start: toLocalInputValue(prefill.start),
    end: toLocalInputValue(prefill.end),
  };
}

function CreateBookingForm({ onCloseModal, prefill = null }) {
  const { rooms, isLoading: isLoadingRooms } = useRooms();
  const { settings, isLoading: isLoadingSettings } = useSettings();
  const { createBooking, isCreating } = useCreateBooking();

  const [roomId, setRoomId] = useState(() =>
    prefill?.roomId ? String(prefill.roomId) : "",
  );
  /* A seeded window means somebody has already decided when this booking
     runs, so "starts now" must not be ticked — it pins the start to the
     clock every thirty seconds and would quietly overwrite the time the
     search was run for. */
  const [startsNow, setStartsNow] = useState(() => !prefill?.start);
  /* Both ends of the booking in one piece of state, because they are not
     independent: moving the start drags the end along with it. */
  const [when, setWhen] = useState(() => seededWindow(prefill));
  const [observations, setObservations] = useState("");
  const [numGuests, setNumGuests] = useState(() =>
    Math.max(1, Math.floor(Number(prefill?.numGuests) || 1)),
  );
  const [isPaid, setIsPaid] = useState(true);
  const [startInUse, setStartInUse] = useState(false);

  /* ---------------------------- desks ----------------------------
     A shared space is sold on a different axis: a start DATE, a day or a
     month, and how many desks. None of the time state above applies, so
     it gets its own rather than the two being made to share one shape
     that fits neither. Which set is live is decided by the room, below. */
  const [passType, setPassType] = useState(
    () => prefill?.passType ?? PASS_TYPES.DAY,
  );
  const [passUnits, setPassUnits] = useState(1);
  const [seats, setSeats] = useState(() =>
    Math.max(1, Math.floor(Number(prefill?.seats) || 1)),
  );
  const [passStart, setPassStart] = useState(() =>
    // Local date, not toISOString(): that is UTC and lands on the wrong
    // day either side of midnight.
    toLocalDateValue(prefill?.start ?? new Date()),
  );
  /* Hourly desks only: the time of day it starts, and how long it runs.
     A day or month pass has neither — it is anchored to midnight and
     measured in whole days. */
  const [passTime, setPassTime] = useState(() => {
    if (prefill?.start) return toLocalTimeValue(prefill.start);
    const now = new Date();
    const next =
      Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / DESK_STEP_MINUTES) *
      DESK_STEP_MINUTES;
    const clamped = Math.min(next, 23 * 60 + 45);
    return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
  });
  /* Snapped to the desk grid, because the search window is free to be any
     length and a desk is not: roundDeskMinutes() rounds UP, so a 20-minute
     window seeds the hour a desk is actually sold in rather than silently
     shortening it. */
  const [passMinutes, setPassMinutes] = useState(() =>
    prefill?.minutes ? roundDeskMinutes(prefill.minutes) : MIN_DESK_MINUTES,
  );

  const [guestMode, setGuestMode] = useState("existing");
  const [guestSearch, setGuestSearch] = useState("");
  const [selectedGuestId, setSelectedGuestId] = useState(null);
  const [newGuest, setNewGuest] = useState({ fullName: "", email: "" });

  // Problems are only SHOWN once the admin has tried to submit. Before
  // that the sheet stays quiet — nobody wants a form scolding them about
  // fields they have not reached yet. Afterwards they update live.
  const [showProblems, setShowProblems] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fieldRefs = useRef({});
  const registerField = (name) => (el) => {
    fieldRefs.current[name] = el;
  };

  const { data: guests = [], isLoading: isSearchingGuests } = useQuery({
    queryKey: ["guest-search", guestSearch],
    queryFn: () => searchGuests(guestSearch),
    keepPreviousData: true,
  });

  const room = rooms?.find((entry) => String(entry.id) === String(roomId));

  /* Which of the two products is being sold. Read from the room, never
     guessed from its name.

     Declared HERE, immediately after `room`, rather than beside the rest
     of the desk state further down: the availability query below reads it
     in its `enabled`, and a const referenced above its declaration is a
     temporal-dead-zone crash at runtime that no build catches. */
  const isDeskSale = isSharedSpace(room);

  /* getRooms() asks for no ordering, so the rows arrive in whatever order
     Postgres felt like. Eight cards in a grid survived that; a dropdown
     of forty would be unusable, so the names are sorted here — numerically,
     so room 9 comes before room 10 rather than after it. */
  const roomOptions = useMemo(
    () =>
      [...(rooms ?? [])].sort((a, b) =>
        String(a.name).localeCompare(String(b.name), undefined, {
          numeric: true,
        }),
      ),
    [rooms],
  );

  /* The rules for how the two boxes move are in bookingWindow.js, pure
     and tested; these only hand them the current state. */
  const setStart = useCallback((value) => {
    setWhen((current) => moveWindowStart(current, value));
  }, []);

  const setEnd = useCallback((value) => {
    setWhen((current) => setWindowEnd(current, value));
  }, []);

  const setLength = useCallback((minutes) => {
    setWhen((current) => endAfterLength(current, minutes));
  }, []);

  /* "They are going in now" is a statement about the clock, not only
     about the status column.

     Ticking it used to set the status to "in-use" and leave whatever
     time was picked above alone, so a booking taken at 12:39 for a 12:45
     start was marked in use six minutes before it began — the room read
     as occupied while it was still empty, and every seat count that
     asked "who is in there now" believed it. Whoever is walking in is
     walking in NOW, so now is the start time, and the two can no longer
     disagree. */
  const startPinnedToNow = startsNow || startInUse;

  // It has to keep meaning NOW while the form is open — a desk form can
  // sit on screen for several minutes while the guest finds their email
  // address, and writing a start time from when the modal opened would
  // book the room in the past. The end moves with it, so the length the
  // desk agreed on survives the wait.
  useEffect(() => {
    if (!startPinnedToNow) return;
    const tick = () => setStart(toLocalInputValue(new Date()));
    tick();
    const id = setInterval(tick, 30 * 1000);
    return () => clearInterval(id);
  }, [startPinnedToNow, setStart]);

  /* The same pinning for a desk, which carries its start in two boxes
     rather than one. A day or month pass is anchored to midnight by
     passWindow() whatever time of day is written here, so for those this
     only ever moves the DATE to today — which is still the right answer
     for somebody standing at the counter. */
  useEffect(() => {
    if (!startInUse) return;
    const tick = () => {
      const now = new Date();
      setPassStart(toLocalDateValue(now));
      setPassTime(toLocalTimeValue(now));
    };
    tick();
    const id = setInterval(tick, 30 * 1000);
    return () => clearInterval(id);
  }, [startInUse]);

  const start = useMemo(() => parseLocalInput(when.start), [when.start]);
  const end = useMemo(() => parseLocalInput(when.end), [when.end]);

  /* The length is no longer something anyone picks — it is the distance
     between the two times, and every price and summary reads it here. */
  const durationMinutes = useMemo(() => windowMinutes(when), [when]);
  const hasValidWindow = durationMinutes > 0;

  const { data: existingBookings = [] } = useQuery({
    queryKey: ["room-bookings", roomId, start?.toISOString(), end?.toISOString()],
    queryFn: () => getRoomBookingsAround(roomId, start, end),
    // A shared space has no overlap rule to check — overlapping is the
    // product. Its seat query is the one above.
    enabled: Boolean(roomId && start && end && !isDeskSale),
  });

  const bounds = useMemo(() => durationBounds(settings), [settings]);
  const quickLengths = useMemo(
    () => QUICK_LENGTHS.filter((m) => m >= bounds.min && m <= bounds.max),
    [bounds],
  );

  /* The live exchange rate, because a monthly desk is priced in USD and
     what the guest pays in RWF is today's conversion of it. */
  const { rate: rwfPerUsd, isIndicative: isRateIndicative } = useFxRate();

  /* Every booking that could compete for a seat in this space.
     Deliberately not windowed: a monthly pass bought five weeks ago is
     still holding its desk today, so a window measured in days would miss
     exactly the bookings that matter. */
  const { data: seatBookings = [] } = useQuery({
    queryKey: ["room-seat-bookings", roomId],
    queryFn: () => getRoomSeatBookings(roomId),
    enabled: Boolean(roomId && isDeskSale),
  });

  const isHourlyDesk = passType === PASS_TYPES.HOURLY;

  /* One moment for the validator: a date for a day or month pass, a date
     AND a time for an hourly one. Built as a local Date rather than an
     ISO string, so "14:00" means two in the afternoon in Kigali rather
     than in UTC. */
  const passStartAt = useMemo(() => {
    if (!isHourlyDesk) return passStart;
    const [y, m, d] = passStart.split("-").map(Number);
    const [hh, mm] = (passTime || "00:00").split(":").map(Number);
    if (!y || !m || !d) return passStart;
    return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
  }, [isHourlyDesk, passStart, passTime]);

  const passRange = useMemo(
    () =>
      passWindow({
        startDate: passStartAt,
        passType,
        units: passUnits,
        minutes: passMinutes,
      }),
    [passStartAt, passType, passUnits, passMinutes],
  );

  /* Free desks across the WHOLE range — its worst day, which is the
     number that decides whether the sale can happen at all. */
  const seatsFree = useMemo(() => {
    if (!isDeskSale || !passRange) return null;
    return seatsLeftAcrossRange(
      room,
      seatBookings,
      passRange.start,
      passRange.end,
    );
  }, [isDeskSale, room, seatBookings, passRange]);

  const deskCheck = useMemo(() => {
    if (!isDeskSale || !room) return {};
    const seatsTaken = passRange
      ? seatsTakenAcrossRange(room, seatBookings, passRange.start, passRange.end)
      : 0;

    return validateSeatBooking({
      room,
      seats,
      passType,
      startDate: passStartAt,
      units: passUnits,
      minutes: passMinutes,
      seatsTaken,
      rate: rwfPerUsd,
      /* The desk's one liberty over the public site: a walk-in at two in
         the afternoon wants a desk for the rest of today. */
      allowToday: true,
    });
  }, [
    isDeskSale,
    room,
    seatBookings,
    passRange,
    seats,
    passType,
    passStartAt,
    passUnits,
    passMinutes,
    rwfPerUsd,
  ]);

  const deskPrice = useMemo(() => {
    if (!isDeskSale) return null;
    return priceForPass({
      room,
      passType,
      seats,
      units: passUnits,
      minutes: passMinutes,
      rate: rwfPerUsd,
    });
  }, [isDeskSale, room, passType, seats, passUnits, passMinutes, rwfPerUsd]);

  /* Past the crossover an hourly desk costs more than a day pass for
     less time. The desk should be told before it quotes the guest. */
  const deskDayNudge = useMemo(() => {
    if (!isDeskSale || !isHourlyDesk) return null;
    return dayPassBeatsHourly({
      room,
      minutes: passMinutes,
      seats,
      rate: rwfPerUsd,
    });
  }, [isDeskSale, isHourlyDesk, room, passMinutes, seats, rwfPerUsd]);

  const check = useMemo(() => {
    if (isDeskSale) return {};
    if (!room || !start || !end) return {};
    return validateAdminBooking({
      start,
      end,
      room,
      settings: settings ?? {},
      existingBookings,
    });
  }, [isDeskSale, room, start, end, settings, existingBookings]);

  /* Everything wrong with the sheet right now, in the order the fields
     appear, each tied to the control it belongs to so the list can focus
     it and the control can repeat the message underneath itself. */
  const problems = useMemo(() => {
    const list = [];
    const add = (field, message) => list.push({ field, message });

    if (!roomId) add("room", "Choose which room this booking is for");

    if (guestMode === "existing" && !selectedGuestId)
      add("guest", "Choose a guest from the list, or add a new walk-in");

    if (guestMode === "new") {
      if (!newGuest.fullName.trim())
        add("guestName", "Enter the walk-in guest's full name");
      if (!newGuest.email.trim())
        add("guestEmail", "Enter the walk-in guest's email address");
      else if (!looksLikeEmail(newGuest.email))
        add("guestEmail", `"${newGuest.email.trim()}" is not a valid email address`);
    }

    /* A desk sale has no start time, no end time and no length, so none
       of the clock complaints below belong to it. Its own rules come out
       of validateSeatBooking, which reports against the seat fields. */
    if (isDeskSale) {
      if (!passRange) add("passStart", "Pick the date the pass starts");
      if (Number(seats) < 1) add("seats", "Sell at least one desk");
      if (deskCheck.error)
        add(
          deskCheck.field === "startDate"
            ? "passStart"
            : deskCheck.field === "passType"
              ? "passType"
              : "seats",
          deskCheck.error,
        );
    } else {
      if (!start) add("start", "Pick the date and time this booking starts");
      if (!end) add("end", "Pick the date and time this booking ends");
      else if (start && end <= start)
        add("end", "The end time has to be after the start time");

      if (room && Number(numGuests) > room.maxCapacity)
        add(
          "people",
          `Room ${room.name} seats ${room.maxCapacity} — reduce the number of people, or pick a bigger room`,
        );
      if (Number(numGuests) < 1)
        add("people", "A booking needs at least one person");

      // Whatever the shared rules reject (clash, opening hours, length),
      // reported against the field it belongs to.
      if (check.error) add(check.field ?? "start", check.error);
    }

    /* The validator and the checks above can reach the same conclusion —
       an end before its start is both an obvious typo and a rule breach —
       and saying it twice makes the list look like two separate faults. */
    const seen = new Set();
    return list.filter((problem) => {
      const key = `${problem.field}:${problem.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [
    roomId,
    guestMode,
    selectedGuestId,
    newGuest,
    start,
    end,
    room,
    numGuests,
    check,
    isDeskSale,
    passRange,
    seats,
    deskCheck,
  ]);

  const errorFor = (field) =>
    showProblems ? problems.find((p) => p.field === field)?.message : undefined;

  // A clash or an out-of-hours slot is news about the world, not a
  // telling-off about an empty box, so it shows the moment it is true.
  // For a desk that news is "those dates are full", which is the same
  // kind of fact and shows the same way.
  const availabilityError = isDeskSale ? deskCheck.error : check.error;

  /* One `price` for the summary panel to read, whichever product this is.
     The shapes are deliberately the same two fields (usd, rwf), so the
     summary does not have to branch. */
  const price = isDeskSale
    ? deskPrice
    : room && hasValidWindow
      ? priceForMinutes(
          durationMinutes,
          rwfPerMinuteFromRoom(room, rwfPerUsd),
          rwfPerUsd,
        )
      : null;

  function focusField(field) {
    const el = fieldRefs.current[field];
    if (!el) return;
    el.focus({ preventScroll: false });
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (isSubmitting || isCreating) return;

    if (problems.length > 0) {
      setShowProblems(true);
      focusField(problems[0].field);
      return;
    }

    setIsSubmitting(true);
    try {
      const guestId =
        guestMode === "existing"
          ? selectedGuestId
          : (await findOrCreateGuest(newGuest)).id;

      /* Two payloads, one mutation. useCreateBooking dispatches on
         passType, so everything after the write — the toast, the cache
         invalidation, pushing the public site's cache over — is identical
         for a room and for a desk. */
      createBooking(
        isDeskSale
          ? {
              roomId: Number(roomId),
              guestId,
              room,
              startDate: passStartAt,
              passType,
              units: Number(passUnits) || 1,
              minutes: passMinutes,
              seats: Number(seats) || 1,
              rwfPerUsd,
              observations,
              isPaid,
              status: startInUse ? "in-use" : "booked",
            }
          : {
              roomId: Number(roomId),
              guestId,
              room,
              settings: settings ?? {},
              start,
              end,
              /* The same rate the summary panel just priced with, so what
                 the desk was shown and what the booking freezes are one
                 number. */
              rwfPerUsd,
              observations,
              numGuests: Number(numGuests) || 1,
              isPaid,
              status: startInUse ? "in-use" : "booked",
            },
        { onSuccess: () => onCloseModal?.() },
      );
    } catch (err) {
      toast.error(err.message || "The guest could not be saved");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingRooms || isLoadingSettings)
    return (
      <Sheet as="div" style={{ placeItems: "center", minHeight: "20rem" }}>
        <SpinnerMini />
      </Sheet>
    );

  const busy = isCreating || isSubmitting;
  const selectedGuest = guests.find((g) => g.id === selectedGuestId);

  return (
    <Sheet onSubmit={handleSubmit} noValidate>
      <Title>
        <h2>{isDeskSale ? "Sell a desk" : "New booking"}</h2>
        <p>
          {isDeskSale
            ? "For someone at the counter — a desk can start today. Say how many, from when, and for how long; the price follows."
            : "For someone at the desk — no hour of notice needed, and it can start this minute. Say when it starts and when it ends; the length and the price follow."}
        </p>
      </Title>

      {showProblems && problems.length > 0 ? (
        <Problems role="alert" aria-live="assertive">
          <p>
            <AlertCircle size={18} />
            {problems.length === 1
              ? "One thing to fix before this booking can be created"
              : `${problems.length} things to fix before this booking can be created`}
          </p>
          <ol>
            {problems.map((problem) => (
              <li key={`${problem.field}-${problem.message}`}>
                <button type="button" onClick={() => focusField(problem.field)}>
                  {problem.message}
                </button>
              </li>
            ))}
          </ol>
        </Problems>
      ) : null}

      <Columns>
        <Stack>
          {/* ------------------------------ room ---------------------- */}
          <Step>
            <StepHead>
              <span data-num>1</span> Room or space
              <small>
                {roomOptions.length === 1
                  ? "1 space"
                  : `${roomOptions.length} spaces`}
              </small>
            </StepHead>
            <NativeSelect
              id="booking-room"
              value={roomId}
              disabled={busy}
              ref={registerField("room")}
              $invalid={Boolean(errorFor("room"))}
              onChange={(e) => setRoomId(e.target.value)}
            >
              <option value="">Choose a room or space…</option>
              {roomOptions.map((entry) => (
                /* A desk and a room are not sold on the same axis, so
                   each option names the price it is actually sold at: the
                   day pass for a desk, the hour for a room. Both in
                   francs, which is what they are priced in. */
                <option key={entry.id} value={entry.id}>
                  {isSharedSpace(entry)
                    ? `${entry.name} — ${entry.maxCapacity} desks · ${formatMenuPrice(
                        entry.day_rate_rwf ?? 0,
                        "RWF",
                      )}/desk/day`
                    : `${entry.name} — ${entry.maxCapacity} seats · ${formatMenuPrice(
                        Math.round(rwfPerMinuteFromRoom(entry, rwfPerUsd) * 60),
                        "RWF",
                      )}/hr`}
                </option>
              ))}
            </NativeSelect>
            {errorFor("room") ? (
              <FieldError>
                <AlertCircle /> {errorFor("room")}
              </FieldError>
            ) : null}
          </Step>

          {/* ----------------------------- guest ---------------------- */}
          <Step>
            <StepHead>
              <span data-num>2</span> Guest
            </StepHead>

            <Segmented>
              <Segment
                type="button"
                $active={guestMode === "existing"}
                onClick={() => setGuestMode("existing")}
              >
                <Search /> Existing
              </Segment>
              <Segment
                type="button"
                $active={guestMode === "new"}
                onClick={() => setGuestMode("new")}
              >
                <UserPlus /> New walk-in
              </Segment>
            </Segmented>

            {guestMode === "existing" ? (
              <>
                <TextInput
                  type="search"
                  placeholder="Search by name or email"
                  value={guestSearch}
                  disabled={busy}
                  ref={registerField("guest")}
                  $invalid={Boolean(errorFor("guest"))}
                  onChange={(e) => setGuestSearch(e.target.value)}
                />
                {isSearchingGuests && guests.length === 0 ? (
                  <SpinnerMini />
                ) : guests.length > 0 ? (
                  <GuestList $invalid={Boolean(errorFor("guest"))}>
                    {guests.map((guest) => {
                      const selected = selectedGuestId === guest.id;
                      return (
                        <li key={guest.id}>
                          <GuestButton
                            type="button"
                            $selected={selected}
                            aria-pressed={selected}
                            onClick={() => setSelectedGuestId(guest.id)}
                          >
                            <div>
                              <strong>{guest.fullName}</strong>
                              <span>{guest.email}</span>
                            </div>
                            {selected ? <Check /> : null}
                          </GuestButton>
                        </li>
                      );
                    })}
                  </GuestList>
                ) : (
                  <Hint>
                    No guest matches “{guestSearch}”. Use{" "}
                    <strong>New walk-in</strong> to add them.
                  </Hint>
                )}
                {errorFor("guest") ? (
                  <FieldError>
                    <AlertCircle /> {errorFor("guest")}
                  </FieldError>
                ) : null}
              </>
            ) : (
              <>
                <Pair>
                  <div>
                    <TextInput
                      placeholder="Full name"
                      value={newGuest.fullName}
                      disabled={busy}
                      ref={registerField("guestName")}
                      $invalid={Boolean(errorFor("guestName"))}
                      onChange={(e) =>
                        setNewGuest((c) => ({ ...c, fullName: e.target.value }))
                      }
                    />
                    {errorFor("guestName") ? (
                      <FieldError style={{ marginTop: "0.6rem" }}>
                        <AlertCircle /> {errorFor("guestName")}
                      </FieldError>
                    ) : null}
                  </div>
                  <div>
                    <TextInput
                      type="email"
                      placeholder="Email address"
                      value={newGuest.email}
                      disabled={busy}
                      ref={registerField("guestEmail")}
                      $invalid={Boolean(errorFor("guestEmail"))}
                      onChange={(e) =>
                        setNewGuest((c) => ({ ...c, email: e.target.value }))
                      }
                    />
                    {errorFor("guestEmail") ? (
                      <FieldError style={{ marginTop: "0.6rem" }}>
                        <AlertCircle /> {errorFor("guestEmail")}
                      </FieldError>
                    ) : null}
                  </div>
                </Pair>
                <Hint>
                  If this email already belongs to a guest, the booking is
                  attached to that account instead of creating a second one.
                </Hint>
              </>
            )}
          </Step>
        </Stack>

        <Stack>
          {/* ------------------------- when, or how long -------------
              A room is sold as a start and an end; a desk is sold as a
              start date, a number of days or months, and a number of
              desks. They are different questions, so this is a swap
              rather than a form that tries to ask both. */}
          {isDeskSale ? (
            <SeatStep
              room={room}
              passType={passType}
              setPassType={setPassType}
              passUnits={passUnits}
              setPassUnits={setPassUnits}
              passMinutes={passMinutes}
              setPassMinutes={setPassMinutes}
              passTime={passTime}
              setPassTime={setPassTime}
              dayNudge={deskDayNudge}
              seats={seats}
              setSeats={setSeats}
              passStart={passStart}
              setPassStart={setPassStart}
              passRange={passRange}
              seatsFree={seatsFree}
              price={deskPrice}
              isRateIndicative={isRateIndicative}
              startPinnedToNow={startInUse}
              busy={busy}
              errorFor={errorFor}
              registerField={registerField}
            />
          ) : (
            <>
            <Step>
              <StepHead>
                <span data-num>3</span> From / to
                <small>
                  {formatDuration(bounds.min)}–{formatDuration(bounds.max)}
                </small>
              </StepHead>

              <Toggle $on={startPinnedToNow}>
                <input
                  type="checkbox"
                  checked={startPinnedToNow}
                  /* Already pinned by "they are going in now" further
                     down, and unticking it there is the way to unpin it —
                     so this reads as on and cannot be fought with. */
                  disabled={busy || startInUse}
                  onChange={() => setStartsNow((c) => !c)}
                />
                <div>
                  <strong>
                    <Zap
                      size={14}
                      style={{ display: "inline", verticalAlign: "-2px" }}
                    />{" "}
                    Start right now
                  </strong>
                  <span>
                    {startInUse
                      ? "Held on, because they are going in now"
                      : "Keeps up with the clock while this form is open, and carries the end time along with it"}
                  </span>
                </div>
              </Toggle>

              <Pair>
                <div>
                  <FieldLabel as="span">Starts</FieldLabel>
                  <DateTimePicker
                    id="booking-start"
                    value={when.start}
                    disabled={busy || startPinnedToNow}
                    ref={registerField("start")}
                    invalid={Boolean(errorFor("start"))}
                    onChange={setStart}
                    ariaLabel="Booking start"
                  />
                </div>
                <div>
                  <FieldLabel as="span">Ends</FieldLabel>
                  {/* The end can never be before the start, so the days
                      before it are struck out rather than left to be picked
                      and then complained about. */}
                  <DateTimePicker
                    id="booking-end"
                    value={when.end}
                    min={when.start}
                    disabled={busy}
                    ref={registerField("end")}
                    invalid={Boolean(errorFor("end"))}
                    onChange={setEnd}
                    ariaLabel="Booking end"
                    align="right"
                  />
                </div>
              </Pair>

              {/* The end box carries its own date, so an overnight session is
                  just a later date — nothing to explain and nothing to guess.
                  The readout says the length back, which is the number the
                  dropdown used to make the desk work out by hand. */}
              <QuickRow>
                <span>Or end it after</span>
                {quickLengths.map((minutes) => (
                  <Chip
                    key={minutes}
                    type="button"
                    $active={minutes === durationMinutes}
                    aria-pressed={minutes === durationMinutes}
                    disabled={busy || !start}
                    onClick={() => setLength(minutes)}
                  >
                    {formatDuration(minutes)}
                  </Chip>
                ))}
              </QuickRow>

              {errorFor("start") ? (
                <FieldError>
                  <AlertCircle /> {errorFor("start")}
                </FieldError>
              ) : null}
              {errorFor("end") ? (
                <FieldError>
                  <AlertCircle /> {errorFor("end")}
                </FieldError>
              ) : null}
              {!showProblems && availabilityError ? (
                <FieldError>
                  <AlertCircle /> {availabilityError}
                </FieldError>
              ) : hasValidWindow && end ? (
                <Hint>
                  <Clock
                    size={12}
                    style={{ display: "inline", verticalAlign: "-1px" }}
                  />{" "}
                  Runs for {formatDuration(durationMinutes)}, until{" "}
                  {end.toLocaleTimeString(undefined, TIME_FORMAT)}
                </Hint>
              ) : null}
            </Step>
            </>
          )}

          {/* --------------------------- at the desk ------------------ */}
          <Step>
            <StepHead>
              <span data-num>4</span> At the desk
            </StepHead>

            {/* Not asked for a desk sale: the number of desks in step 3
                IS the number of people, and two controls for one number
                is how they come to disagree. createSeatBookingApi writes
                numGuests from the seat count. */}
            {isDeskSale ? null : (
              <>
                <Pair>
                  <div>
                    <TextInput
                      type="number"
                      min={1}
                      max={room?.maxCapacity ?? 50}
                      value={numGuests}
                      disabled={busy}
                      ref={registerField("people")}
                      $invalid={Boolean(errorFor("people"))}
                      onChange={(e) => setNumGuests(e.target.value)}
                      aria-label="Number of people"
                    />
                    <Hint style={{ marginTop: "0.4rem" }}>
                      <Users
                        size={12}
                        style={{ display: "inline", verticalAlign: "-1px" }}
                      />{" "}
                      People{room ? ` · room seats ${room.maxCapacity}` : ""}
                    </Hint>
                  </div>
                </Pair>
                {errorFor("people") ? (
                  <FieldError>
                    <AlertCircle /> {errorFor("people")}
                  </FieldError>
                ) : null}
              </>
            )}

            <NoteArea
              value={observations}
              disabled={busy}
              maxLength={1000}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Notes — setup, invoicing, who to call"
            />

            <Toggle $on={isPaid}>
              <input
                type="checkbox"
                checked={isPaid}
                disabled={busy}
                onChange={() => setIsPaid((c) => !c)}
              />
              <div>
                <strong>Payment taken</strong>
                <span>Untick to record this as still owing</span>
              </div>
            </Toggle>

            <Toggle $on={startInUse}>
              <input
                type="checkbox"
                checked={startInUse}
                disabled={busy}
                onChange={() => setStartInUse((c) => !c)}
              />
              <div>
                <strong>They are going in now</strong>
                <span>
                  Starts it at this moment, whatever time is picked above, and
                  marks it in use. Leave it off and it becomes “in use” on its
                  own at the start time.
                </span>
              </div>
            </Toggle>
          </Step>
        </Stack>
      </Columns>

      {/* ------------------------------ summary ---------------------- */}
      <Summary as="dl">
        <Line>
          <dt>{isDeskSale ? "Space" : "Room"}</dt>
          <dd>{room ? room.name : <em>Not chosen yet</em>}</dd>
        </Line>
        <Line>
          <dt>Guest</dt>
          <dd>
            {guestMode === "new"
              ? newGuest.fullName.trim() || <em>Not entered yet</em>
              : (selectedGuest?.fullName ?? <em>Not chosen yet</em>)}
          </dd>
        </Line>
        {/* A desk pass is measured in whole days, so it reads as two
            DATES rather than two clock times — and the second one is the
            last day the guest gets, not the half-open end, which would
            name a day they have not bought. */}
        {isDeskSale ? (
          <>
            <Line>
              <dt>
                <Armchair
                  size={13}
                  style={{ display: "inline", verticalAlign: "-2px" }}
                />{" "}
                Desks
              </dt>
              <dd>
                {seats}
                {seatsFree !== null ? (
                  <small>{seatsFree} free for those dates</small>
                ) : null}
              </dd>
            </Line>
            <Line>
              <dt>
                <CalendarDays
                  size={13}
                  style={{ display: "inline", verticalAlign: "-2px" }}
                />{" "}
                {isHourlyDesk ? "When" : "Dates"}
              </dt>
              <dd>
                {passRange ? (
                  isHourlyDesk ? (
                    /* An hourly window ends at a real moment, so it is
                       printed as it is. A day or month window is
                       half-open and ends at midnight AFTER the last day
                       the guest gets, so that one shows the last day
                       included instead. */
                    <>
                      {DATE_ONLY.format(passRange.start)}{" "}
                      {TIME_ONLY.format(passRange.start)}
                      <ArrowRight
                        size={13}
                        style={{
                          display: "inline",
                          verticalAlign: "-2px",
                          margin: "0 0.4rem",
                        }}
                      />
                      {TIME_ONLY.format(passRange.end)}
                    </>
                  ) : (
                    <>
                      {DATE_ONLY.format(passRange.start)}
                      <ArrowRight
                        size={13}
                        style={{
                          display: "inline",
                          verticalAlign: "-2px",
                          margin: "0 0.4rem",
                        }}
                      />
                      {DATE_ONLY.format(addDays(passRange.end, -1))}
                    </>
                  )
                ) : (
                  <em>Not set yet</em>
                )}
              </dd>
            </Line>
          </>
        ) : (
          <Line>
            <dt>
              <Clock
                size={13}
                style={{ display: "inline", verticalAlign: "-2px" }}
              />{" "}
              When
            </dt>
            <dd>
              {start && end && hasValidWindow ? (
                <>
                  {start.toLocaleString(undefined, WHEN_FORMAT)}
                  <ArrowRight
                    size={13}
                    style={{ display: "inline", verticalAlign: "-2px", margin: "0 0.4rem" }}
                  />
                  {end.toLocaleString(undefined, WHEN_FORMAT)}
                </>
              ) : (
                <em>Not set yet</em>
              )}
            </dd>
          </Line>
        )}
        <Total>
          <dt>
            {isDeskSale
              ? passRange
                ? isHourlyDesk
                  ? `${formatDuration(passMinutes)} × ${seats} desk${
                      Number(seats) === 1 ? "" : "s"
                    }`
                  : `${passUnits} ${
                      passType === PASS_TYPES.MONTH ? "month" : "day"
                    }${Number(passUnits) === 1 ? "" : "s"} × ${seats} desk${
                      Number(seats) === 1 ? "" : "s"
                    }`
                : "Pass not set"
              : hasValidWindow
                ? formatDuration(durationMinutes)
                : "Length not set"}
          </dt>
          <dd>
            {/* Francs lead for both products now: it is the price on
                the wall, what the guest hands over, and what the room is
                priced at. A meeting room used to lead with dollars,
                because that was the column its rate was set in. */}
            {price ? (
              <>
                {formatMenuPrice(price.rwf, "RWF")}
                <small>≈ {formatCurrency(price.usd)}</small>
              </>
            ) : (
              "—"
            )}
          </dd>
        </Total>
      </Summary>

      <Footer>
        <Button
          type="button"
          variation="secondary"
          disabled={busy}
          onClick={() => onCloseModal?.()}
        >
          Cancel
        </Button>
        {/* Deliberately NOT disabled when the sheet is incomplete. A dead
            button says "no" without saying why; pressing this one lists
            exactly what is missing and jumps to the first of it. */}
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create booking"}
        </Button>
      </Footer>
    </Sheet>
  );
}

export default CreateBookingForm;
