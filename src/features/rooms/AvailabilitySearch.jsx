import { useMemo } from "react";
import { addDays, startOfDay } from "date-fns";
import styled, { css } from "styled-components";
import {
  Armchair,
  CalendarClock,
  CalendarDays,
  Check,
  Clock,
  DoorOpen,
  Search,
  Sunrise,
  X,
  Zap,
} from "lucide-react";

import Button, { ButtonContent } from "../../ui/Button";
import DateTimePicker from "../../ui/DateTimePicker";
import SpinnerMini from "../../ui/SpinnerMini";
import { formatDuration } from "../../utils/booking";
import { toLocalInputValue } from "../../utils/datetime";
import { KINDS } from "./availability";
import {
  DEFAULT_SEARCH_MINUTES,
  useAvailabilitySearch,
} from "./useAvailabilitySearch";
import { useRoomsAvailability } from "./useRoomsAvailability";
import AvailabilityBoard from "./AvailabilityBoard";

/* ------------------------------------------------------------------
   "What is free at four?", asked once for the whole building.

   The rooms list described every room and said nothing about whether
   anybody could use one. Answering meant opening the booking form and
   trying rooms one at a time until one of them stopped complaining —
   with a guest standing at the counter watching it happen.

   This is the question moved to the top of the list. Type a window, and
   every room and every shared space answers at the same time: free,
   booked, how many desks are left, when it frees up, and — for the ones
   that can take it — a Book button that carries the window it was found
   with straight into the booking form, so nothing is typed twice.

   ON THE CLOSED STATE. The panel starts as one line, not as a form.
   Three quarters of the times this gets used the answer wanted is "right
   now" or "this afternoon", and those are one click each — a form asking
   for two datetimes before it will say anything would make the fast case
   the slow one. The full controls appear once a search is running.

   The search itself lives in the URL (see useAvailabilitySearch), which
   is what lets the rooms page swap the management table for the board,
   and what makes a reload or a shared link keep the question.
   ------------------------------------------------------------------ */

const Panel = styled.section`
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-sm);
  padding: 1.6rem 2.4rem;
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
  font-size: 1.4rem;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.6rem;
  flex-wrap: wrap;
`;

const Title = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;

  & svg {
    width: 2rem;
    height: 2rem;
    color: var(--color-grey-400);
    flex-shrink: 0;
  }

  & h3 {
    font-size: 1.6rem;
    font-weight: 600;
    color: var(--color-grey-700);
    font-family: "Space Grotesk";
  }

  & p {
    font-size: 1.3rem;
    color: var(--color-grey-500);
  }
`;

const Shortcuts = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
`;

/* One look for every small pressable thing in this panel: the shortcuts,
   the lengths, the type segments and the free-only toggle. They are the
   same kind of control doing the same kind of job, and four subtly
   different pills would read as four unrelated ideas. */
const chip = css`
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-family: inherit;
  font-size: 1.3rem;
  font-weight: 500;
  color: var(--color-grey-600);
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-300);
  border-radius: 100px;
  padding: 0.5rem 1.1rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  & svg {
    width: 1.4rem;
    height: 1.4rem;
    flex-shrink: 0;
  }

  &:hover:not(:disabled) {
    border-color: var(--color-brand-600);
    color: var(--color-grey-700);
  }
`;

const Chip = styled.button.attrs({ type: "button" })`
  ${chip}

  ${(props) =>
    props.$active &&
    css`
      background-color: var(--color-brand-600);
      border-color: var(--color-brand-600);
      color: var(--color-brand-50);

      &:hover {
        color: var(--color-brand-50);
      }
    `}
`;

const Controls = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 13rem;
  gap: 1.6rem;
  align-items: end;

  @media (max-width: 62em) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;

const Label = styled.label`
  font-size: 1.2rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--color-grey-500);
`;

const Stepper = styled.div`
  display: flex;
  align-items: center;
  border: 1px solid var(--color-grey-300);
  border-radius: var(--border-radius-sm);
  background-color: var(--color-grey-0);
  box-shadow: var(--shadow-sm);
  overflow: hidden;

  & input {
    width: 100%;
    min-width: 0;
    border: none;
    background: none;
    text-align: center;
    font-family: "Space Grotesk";
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-grey-700);
    padding: 0.9rem 0;

    &:focus {
      outline: none;
    }

    /* The spinners are redundant beside two buttons twice their size. */
    -moz-appearance: textfield;
    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
  }
`;

const Step = styled.button.attrs({ type: "button" })`
  border: none;
  background-color: var(--color-grey-50);
  color: var(--color-grey-600);
  font-size: 1.8rem;
  font-weight: 500;
  line-height: 1;
  padding: 0.8rem 1.2rem;
  cursor: pointer;

  &:hover:not(:disabled) {
    background-color: var(--color-grey-100);
  }
  &:disabled {
    color: var(--color-grey-300);
    cursor: not-allowed;
  }
`;

const Filters = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.6rem;
  flex-wrap: wrap;
  border-top: 1px solid var(--color-grey-100);
  padding-top: 1.6rem;
`;

const Group = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
`;

const GroupLabel = styled.span`
  font-size: 1.2rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--color-grey-400);
  margin-right: 0.2rem;
`;

/* The window in words, so the board is never read against a window the
   admin has since changed without noticing. */
const Reading = styled.p`
  font-size: 1.3rem;
  color: var(--color-grey-500);

  & b {
    color: var(--color-grey-700);
    font-weight: 600;
    font-family: "Space Grotesk";
  }
`;

/* The lengths worth one click. Deliberately the same set the booking
   form offers as quick lengths, plus a whole day, because a search that
   suggests a window the form cannot take is a dead end. */
const QUICK_LENGTHS = [30, 60, 120, 240, 480];

const DAY_FORMAT = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

function AvailabilitySearch() {
  const search = useAvailabilitySearch();
  const {
    start,
    end,
    minutes,
    isActive,
    kind,
    people,
    onlyFree,
    setStart,
    setEnd,
    setLength,
    setKind,
    setPeople,
    setOnlyFree,
    open,
    clear,
  } = search;

  /* The three questions worth a single click, built from the clock at
     render time rather than stored: "this afternoon" has to mean today
     whatever day the tab was left open on. */
  const shortcuts = useMemo(() => {
    const now = new Date();
    const at = (date, hour, length) => {
      const from = new Date(date);
      from.setHours(hour, 0, 0, 0);
      return {
        from: toLocalInputValue(from),
        to: toLocalInputValue(new Date(from.getTime() + length * 60_000)),
      };
    };

    return [
      { key: "now", label: "Right now", Icon: Zap, window: null },
      {
        key: "afternoon",
        label: "This afternoon",
        Icon: Clock,
        window: at(now, 14, 180),
      },
      {
        key: "tomorrow",
        label: "Tomorrow morning",
        Icon: Sunrise,
        window: at(addDays(startOfDay(now), 1), 9, 120),
      },
    ];
  }, []);

  const { bookings, range, isLoading, isFetching } = useRoomsAvailability(
    start,
    end,
  );

  if (!isActive)
    return (
      <Panel>
        <Head>
          <Title>
            <Search />
            <div>
              <h3>Check availability</h3>
              <p>
                One window, every room and desk — free, booked, or free from
                when.
              </p>
            </div>
          </Title>

          <Shortcuts>
            {shortcuts.map(({ key, label, Icon, window }) => (
              <Chip
                key={key}
                onClick={() =>
                  window ? search.setWindow(window) : open(new Date())
                }
              >
                <Icon /> {label}
              </Chip>
            ))}
            <Button size="small" onClick={() => open(new Date())}>
              <ButtonContent>
                <CalendarClock size={16} /> Pick a time
              </ButtonContent>
            </Button>
          </Shortcuts>
        </Head>
      </Panel>
    );

  return (
    <>
      <Panel>
        <Head>
          <Title>
            <Search />
            <div>
              <h3>Availability</h3>
              <Reading>
                <b>{DAY_FORMAT.format(start)}</b>, {TIME_FORMAT.format(start)} –{" "}
                {TIME_FORMAT.format(end)} · <b>{formatDuration(minutes)}</b>
                {people > 1 ? (
                  <>
                    {" "}
                    · for <b>{people}</b> people
                  </>
                ) : null}
              </Reading>
            </div>
          </Title>

          <Shortcuts>
            {isFetching && !isLoading ? <SpinnerMini /> : null}
            <Button size="small" variation="secondary" onClick={clear}>
              <ButtonContent>
                <X size={16} /> Close
              </ButtonContent>
            </Button>
          </Shortcuts>
        </Head>

        <Controls>
          <Field>
            <Label htmlFor="avail-from">From</Label>
            <DateTimePicker
              id="avail-from"
              value={search.from}
              onChange={setStart}
              ariaLabel="Start of the window to check"
            />
          </Field>

          <Field>
            <Label htmlFor="avail-to">Until</Label>
            <DateTimePicker
              id="avail-to"
              value={search.to}
              onChange={setEnd}
              min={search.from}
              align="right"
              ariaLabel="End of the window to check"
            />
          </Field>

          <Field>
            <Label htmlFor="avail-people">People</Label>
            <Stepper>
              <Step
                onClick={() => setPeople(people - 1)}
                disabled={people <= 1}
                aria-label="One fewer person"
              >
                &minus;
              </Step>
              <input
                id="avail-people"
                type="number"
                min="1"
                value={people}
                onChange={(e) => setPeople(Number(e.target.value) || 1)}
              />
              <Step
                onClick={() => setPeople(people + 1)}
                aria-label="One more person"
              >
                +
              </Step>
            </Stepper>
          </Field>
        </Controls>

        <Group>
          <GroupLabel>Length</GroupLabel>
          {QUICK_LENGTHS.map((length) => (
            <Chip
              key={length}
              $active={minutes === length}
              onClick={() => setLength(length)}
            >
              {formatDuration(length)}
            </Chip>
          ))}
          <Chip
            $active={minutes === 1440}
            onClick={() => setLength(1440)}
            title="A full 24 hours from the start time"
          >
            <CalendarDays /> 24 hrs
          </Chip>
          <Chip onClick={() => open(new Date())} title="Jump back to now">
            <Zap /> Now
          </Chip>
        </Group>

        <Filters>
          <Group>
            <GroupLabel>Show</GroupLabel>
            {[
              { value: KINDS.ALL, label: "Everything", Icon: Search },
              { value: KINDS.MEETING, label: "Meeting rooms", Icon: DoorOpen },
              { value: KINDS.SHARED, label: "Shared desks", Icon: Armchair },
            ].map(({ value, label, Icon }) => (
              <Chip
                key={value}
                $active={kind === value}
                onClick={() => setKind(value)}
              >
                <Icon /> {label}
              </Chip>
            ))}
          </Group>

          <Chip
            $active={onlyFree}
            onClick={() => setOnlyFree(!onlyFree)}
            title="Hide everything that cannot take this booking"
          >
            <Check /> Only what can take it
          </Chip>
        </Filters>
      </Panel>

      <AvailabilityBoard
        bookings={bookings}
        range={range}
        start={start}
        end={end}
        minutes={minutes}
        people={people}
        kind={kind}
        onlyFree={onlyFree}
        isLoading={isLoading}
        onMoveTo={search.moveTo}
      />
    </>
  );
}

export default AvailabilitySearch;
