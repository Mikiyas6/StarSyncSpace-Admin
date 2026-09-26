import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import styled, { css } from "styled-components";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { parseLocalInput, toLocalInputValue } from "../utils/datetime";

/* ------------------------------------------------------------------
   A date and a time, picked in the admin's own clothes.

   This replaces <input type="datetime-local">. That input works, but
   the calendar it opens is the browser's: a grey popup the app has no
   say over, which matches nothing else on the screen and looks like a
   different piece of software. Everything here is ours.

   It is a DROP-IN for the input it replaces — same `value` and
   `onChange` contract, the "YYYY-MM-DDTHH:mm" string in utils/datetime
   — so the rules that move a booking's two ends never learn that the
   control changed.

   The panel FLOATS over the form rather than pushing it down. It needs
   about thirty-four rem to hold seven columns of days beside a column of
   times, and the control itself sits in a half-width form column with
   nowhere near that — inline, the calendar came out squeezed. It is
   absolutely positioned against the trigger, so it still scrolls with it
   inside the modal, and `align` decides which edge it hangs from: a
   panel in the right-hand column hangs right, or it would run off the
   side of the modal.

   TIME is a column of quarter-hour steps next to the grid, with an
   exact time box underneath it. The steps are the shortcut, since most
   bookings land on one; the box is there because the whole point of
   asking for a start and an end was that any minute should be sayable.
   ------------------------------------------------------------------ */

const Wrap = styled.div`
  position: relative;
  min-width: 0;
`;

const invalidRing = css`
  border-color: var(--color-red-700);
  box-shadow: 0 0 0 2px var(--color-red-100);
`;

const Trigger = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  text-align: left;
  line-height: 1.4;
  font-family: inherit;
  font-size: 1.4rem;
  font-weight: 500;
  color: var(--color-grey-700);
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-300);
  border-radius: var(--border-radius-sm);
  box-shadow: var(--shadow-sm);
  padding: 0.9rem 1.2rem;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--color-brand-600);
    outline-offset: -1px;
  }

  &:disabled {
    background-color: var(--color-grey-50);
    color: var(--color-grey-400);
    cursor: not-allowed;
  }

  & svg {
    width: 1.7rem;
    height: 1.7rem;
    flex-shrink: 0;
    color: var(--color-grey-400);
    margin-left: auto;
  }

  ${(props) => props.$invalid && invalidRing}
  ${(props) =>
    props.$open &&
    css`
      border-color: var(--color-brand-600);
    `}
`;

/* The value never wraps to a second line — that would make the control
   taller than the one beside it and leave the row looking broken. */
const Value = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Placeholder = styled(Value)`
  color: var(--color-grey-400);
`;

const Panel = styled.div`
  position: absolute;
  top: calc(100% + 0.6rem);
  ${(props) => (props.$align === "right" ? "right: 0;" : "left: 0;")}
  z-index: 20;
  min-width: 34rem;
  max-width: min(38rem, 86vw);
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1.6rem;
  padding: 1.4rem;
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-md);
  background-color: var(--color-grey-0);
  box-shadow: var(--shadow-md);

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`;

const MonthHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 0.8rem;

  & strong {
    font-family: "Space Grotesk";
    font-size: 1.45rem;
    font-weight: 600;
    color: var(--color-grey-700);
  }
`;

const Step = styled.button`
  display: grid;
  place-items: center;
  width: 2.8rem;
  height: 2.8rem;
  border: none;
  border-radius: var(--border-radius-sm);
  background-color: transparent;
  color: var(--color-grey-500);
  cursor: pointer;

  &:hover {
    background-color: var(--color-grey-100);
    color: var(--color-grey-700);
  }

  & svg {
    width: 1.7rem;
    height: 1.7rem;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.2rem;
`;

const WeekDay = styled.span`
  display: grid;
  place-items: center;
  height: 2.4rem;
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-grey-400);
`;

const Day = styled.button`
  position: relative;
  display: grid;
  place-items: center;
  width: 3.4rem;
  height: 3rem;
  border: none;
  border-radius: var(--border-radius-sm);
  font-family: inherit;
  font-size: 1.3rem;
  font-weight: 500;
  cursor: pointer;
  background-color: transparent;
  color: ${(props) =>
    props.$outside ? "var(--color-grey-400)" : "var(--color-grey-700)"};

  &:hover:not(:disabled) {
    background-color: var(--color-grey-100);
  }

  &:disabled {
    color: var(--color-grey-300);
    cursor: not-allowed;
    text-decoration: line-through;
  }

  /* Today is marked with a dot rather than a ring, so it never competes
     with the selected day for the same visual language. */
  ${(props) =>
    props.$today &&
    !props.$selected &&
    css`
      font-weight: 700;
      color: var(--color-brand-600);

      &::after {
        content: "";
        position: absolute;
        transform: translateY(1.1rem);
        width: 0.4rem;
        height: 0.4rem;
        border-radius: 50%;
        background-color: var(--color-gold-600);
      }
    `}

  ${(props) =>
    props.$selected &&
    css`
      background-color: var(--color-brand-600);
      color: var(--color-brand-50);

      &:hover:not(:disabled) {
        background-color: var(--color-brand-600);
      }
    `}
`;

const Times = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  /* Wide enough for the native time input, which renders "02:15 PM" plus
     a stepper in locales that use a 12-hour clock. */
  min-width: 12rem;
`;

const TimeList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  max-height: 21rem;
  overflow-y: auto;
  padding-right: 0.4rem;

  @media (max-width: 520px) {
    max-height: 14rem;
  }
`;

const TimeOption = styled.button`
  border: none;
  border-radius: var(--border-radius-sm);
  padding: 0.5rem 1rem;
  font-family: "Space Grotesk";
  font-size: 1.3rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  background-color: transparent;
  color: var(--color-grey-700);

  &:hover:not(:disabled) {
    background-color: var(--color-grey-100);
  }

  &:disabled {
    color: var(--color-grey-300);
    cursor: not-allowed;
  }

  ${(props) =>
    props.$selected &&
    css`
      background-color: var(--color-brand-600);
      color: var(--color-brand-50);

      &:hover:not(:disabled) {
        background-color: var(--color-brand-600);
      }
    `}
`;

const ExactTime = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-grey-400);

  & input {
    border: 1px solid var(--color-grey-300);
    border-radius: var(--border-radius-sm);
    background-color: var(--color-grey-0);
    padding: 0.6rem 0.8rem;
    font-family: "Space Grotesk";
    font-size: 1.35rem;
    font-weight: 500;
    color: var(--color-grey-700);

    &:focus {
      outline: 2px solid var(--color-brand-600);
      outline-offset: -1px;
    }
  }
`;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const QUARTER_HOURS = Array.from({ length: 96 }, (_, i) => i * 15);

const TRIGGER_FORMAT = "EEE d MMM, HH:mm";

function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function DateTimePicker(
  {
    id,
    value,
    onChange,
    disabled = false,
    invalid = false,
    min,
    ariaLabel,
    align = "left",
  },
  ref,
) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const selectedTimeRef = useRef(null);

  const selected = parseLocalInput(value);
  const minDate = parseLocalInput(min);

  const [viewMonth, setViewMonth] = useState(
    () => startOfMonth(parseLocalInput(value) ?? new Date()),
  );

  /* Reopening on a month the admin has since scrolled away from is
     disorienting, so every opening starts on the selected date's month. */
  useEffect(() => {
    if (open) setViewMonth(startOfMonth(selected ?? new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* A panel that stays open when the admin has moved on is a panel in
     the way, so it closes on Escape and on a click anywhere outside.
     Not the shared useOutsideClick hook: that one captures on the way
     DOWN, which swallows the first click on anything behind it. */
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  /* 14:15 is ninety-odd rows down a list that starts at midnight, so a
     panel that opens at the top opens showing a time nobody asked about.
     Scroll the list itself — not scrollIntoView, which would drag the
     whole form up to meet it. */
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const option = selectedTimeRef.current;
    if (!list || !option) return;
    list.scrollTop =
      option.offsetTop - list.clientHeight / 2 + option.clientHeight / 2;
  }, [open]);

  const days = useMemo(() => {
    const first = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
    const last = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: first, end: last });
  }, [viewMonth]);

  // The clock the times are measured against: the floor only bites on the
  // day it falls in, so later days offer the whole 24 hours.
  const minMinutes =
    minDate && selected && isSameDay(minDate, selected)
      ? minutesOfDay(minDate)
      : null;

  function emit(next) {
    onChange?.(toLocalInputValue(next));
  }

  /* Picking a DAY keeps the time, picking a TIME keeps the day. Each
     control changes only the half it is about — choosing a date should
     never quietly reset a time the admin already agreed with a guest. */
  function pickDay(day) {
    const base = selected ?? new Date();
    const next = new Date(day);
    next.setHours(base.getHours(), base.getMinutes(), 0, 0);
    emit(next);
  }

  function pickMinutes(minutes) {
    const next = new Date(selected ?? viewMonth);
    next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    emit(next);
  }

  function pickExactTime(hhmm) {
    const [hours, minutes] = String(hhmm).split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return;
    pickMinutes(hours * 60 + minutes);
  }

  const selectedMinutes = selected ? minutesOfDay(selected) : null;

  return (
    <Wrap ref={wrapRef}>
      <Trigger
        id={id}
        type="button"
        ref={ref}
        disabled={disabled}
        $invalid={invalid}
        $open={open}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((c) => !c)}
      >
        {selected ? (
          <Value>{format(selected, TRIGGER_FORMAT)}</Value>
        ) : (
          <Placeholder>Pick a date and time</Placeholder>
        )}
        <CalendarDays />
      </Trigger>

      {open && !disabled ? (
        <Panel
          role="dialog"
          $align={align}
          aria-label={ariaLabel ?? "Choose a date and time"}
        >
          <div>
            <MonthHead>
              <Step
                type="button"
                onClick={() => setViewMonth((m) => subMonths(m, 1))}
                aria-label="Previous month"
              >
                <ChevronLeft />
              </Step>
              <strong>{format(viewMonth, "MMMM yyyy")}</strong>
              <Step
                type="button"
                onClick={() => setViewMonth((m) => addMonths(m, 1))}
                aria-label="Next month"
              >
                <ChevronRight />
              </Step>
            </MonthHead>

            <Grid role="grid">
              {WEEKDAYS.map((day) => (
                <WeekDay key={day}>{day.slice(0, 2)}</WeekDay>
              ))}

              {days.map((day) => {
                const tooEarly = minDate
                  ? startOfDay(day) < startOfDay(minDate)
                  : false;
                return (
                  <Day
                    key={day.toISOString()}
                    type="button"
                    disabled={tooEarly}
                    $outside={!isSameMonth(day, viewMonth)}
                    $today={isToday(day)}
                    $selected={Boolean(selected && isSameDay(day, selected))}
                    aria-pressed={Boolean(selected && isSameDay(day, selected))}
                    aria-label={format(day, "EEEE d MMMM yyyy")}
                    onClick={() => pickDay(day)}
                  >
                    {format(day, "d")}
                  </Day>
                );
              })}
            </Grid>
          </div>

          <Times>
            <TimeList ref={listRef}>
              {QUARTER_HOURS.map((minutes) => {
                const label = `${String(Math.floor(minutes / 60)).padStart(
                  2,
                  "0",
                )}:${String(minutes % 60).padStart(2, "0")}`;
                const isSelected = minutes === selectedMinutes;
                return (
                  <TimeOption
                    key={minutes}
                    type="button"
                    ref={isSelected ? selectedTimeRef : undefined}
                    disabled={minMinutes !== null && minutes < minMinutes}
                    $selected={isSelected}
                    aria-pressed={isSelected}
                    onClick={() => pickMinutes(minutes)}
                  >
                    {label}
                  </TimeOption>
                );
              })}
            </TimeList>

            <ExactTime>
              Exact
              <input
                type="time"
                value={selected ? format(selected, "HH:mm") : ""}
                onChange={(e) => pickExactTime(e.target.value)}
              />
            </ExactTime>
          </Times>
        </Panel>
      ) : null}
    </Wrap>
  );
}

export default forwardRef(DateTimePicker);
