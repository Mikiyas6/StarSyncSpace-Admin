import { useEffect, useMemo, useRef, useState } from "react";
import styled, { css } from "styled-components";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock,
  Search,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";

import Button from "../../ui/Button";
import SpinnerMini from "../../ui/SpinnerMini";

import { useRooms } from "../rooms/useRooms";
import { useSettings } from "../settings/useSettings";
import { useCreateBooking } from "./useCreateBooking";
import { searchGuests, findOrCreateGuest } from "../../services/apiGuests";
import { getRoomBookingsAround } from "../../services/apiBookings";
import {
  FULL_DAY_MINUTES,
  MINUTE_MS,
  durationOptions,
  formatDuration,
  priceForMinutes,
  roundUpToStep,
  usdPerMinuteFromRoom,
  validateAdminBooking,
} from "../../utils/booking";
import { formatCurrency } from "../../utils/helpers";

/* ------------------------------------------------------------------
   Taking a booking for someone standing at the desk.

   The public site's form is built around a person browsing: a grid of
   start times an hour or more away, and a card payment before anything
   is written. Neither fits a walk-in. This asks the four questions the
   desk actually asks — who, which room, from when, for how long —
   defaults the start to "right now", and records that cash changed
   hands.

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

const NativeSelect = styled.select`
  width: 100%;
  border: 1px solid var(--color-grey-300);
  background-color: var(--color-grey-0);
  border-radius: var(--border-radius-sm);
  box-shadow: var(--shadow-sm);
  padding: 0.9rem 1.2rem;
  font-size: 1.4rem;
  font-weight: 500;
  color: var(--color-grey-700);
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

/* Rooms are few and each has facts worth seeing (seats, rate), so they
   are cards rather than a dropdown you have to open to compare. */
const RoomGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 0.8rem;
  ${(props) =>
    props.$invalid &&
    css`
      padding: 0.6rem;
      margin: -0.6rem;
      border-radius: var(--border-radius-sm);
      ${invalidRing}
      border: 1px solid var(--color-red-700);
    `}
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

const Card = styled.button`
  ${textButtonLineHeight}
  text-align: left;
  cursor: pointer;
  padding: 1rem 1.2rem;
  border-radius: var(--border-radius-sm);
  border: 1px solid
    ${(props) =>
      props.$selected ? "var(--color-brand-600)" : "var(--color-grey-200)"};
  background-color: ${(props) =>
    props.$selected ? "var(--color-brand-50)" : "var(--color-grey-0)"};
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 0.2rem;

  &:hover {
    border-color: var(--color-brand-600);
  }

  & strong {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-grey-700);
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  & span {
    font-size: 1.2rem;
    color: var(--color-grey-500);
  }
  & svg {
    width: 1.6rem;
    height: 1.6rem;
    color: var(--color-brand-600);
    margin-left: auto;
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

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
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

// <input type="datetime-local"> wants local wall-clock time with no zone.
// toISOString() would hand it UTC and silently shift the booking by the
// timezone offset, which in Kigali is two hours of free room time.
function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

const DURATION_PRESETS = [30, 60, 120, 240, 480, FULL_DAY_MINUTES];

const WHEN_FORMAT = {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
};

function CreateBookingForm({ onCloseModal }) {
  const { rooms, isLoading: isLoadingRooms } = useRooms();
  const { settings, isLoading: isLoadingSettings } = useSettings();
  const { createBooking, isCreating } = useCreateBooking();

  const [roomId, setRoomId] = useState("");
  const [startsNow, setStartsNow] = useState(true);
  const [startValue, setStartValue] = useState(() =>
    toLocalInputValue(roundUpToStep(new Date())),
  );
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [observations, setObservations] = useState("");
  const [numGuests, setNumGuests] = useState(1);
  const [isPaid, setIsPaid] = useState(true);
  const [startInUse, setStartInUse] = useState(false);

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

  // "Starts now" has to keep meaning NOW while the form is open — a desk
  // form can sit on screen for several minutes while the guest finds
  // their email address, and writing a start time from when the modal
  // opened would book the room in the past.
  useEffect(() => {
    if (!startsNow) return;
    const tick = () => setStartValue(toLocalInputValue(new Date()));
    tick();
    const id = setInterval(tick, 30 * 1000);
    return () => clearInterval(id);
  }, [startsNow]);

  const start = useMemo(
    () => (startValue ? new Date(startValue) : null),
    [startValue],
  );
  const end = useMemo(
    () =>
      start && !Number.isNaN(start.getTime())
        ? new Date(start.getTime() + durationMinutes * MINUTE_MS)
        : null,
    [start, durationMinutes],
  );

  const { data: existingBookings = [] } = useQuery({
    queryKey: ["room-bookings", roomId, start?.toISOString(), end?.toISOString()],
    queryFn: () => getRoomBookingsAround(roomId, start, end),
    enabled: Boolean(roomId && start && end),
  });

  const durations = useMemo(() => durationOptions(settings), [settings]);
  const presets = useMemo(
    () => DURATION_PRESETS.filter((m) => durations.includes(m)),
    [durations],
  );

  const check = useMemo(() => {
    if (!room || !start) return {};
    return validateAdminBooking({
      start,
      durationMinutes,
      room,
      settings: settings ?? {},
      existingBookings,
    });
  }, [room, start, durationMinutes, settings, existingBookings]);

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

    if (!startValue || !start || Number.isNaN(start.getTime()))
      add("start", "Pick the date and time this booking starts");

    if (room && Number(numGuests) > room.maxCapacity)
      add(
        "people",
        `Room ${room.name} seats ${room.maxCapacity} — reduce the number of people, or pick a bigger room`,
      );
    if (Number(numGuests) < 1) add("people", "A booking needs at least one person");

    // Whatever the shared rules reject (clash, opening hours, length),
    // reported against the field it belongs to.
    if (check.error) add(check.field ?? "start", check.error);

    return list;
  }, [
    roomId,
    guestMode,
    selectedGuestId,
    newGuest,
    startValue,
    start,
    room,
    numGuests,
    check,
  ]);

  const errorFor = (field) =>
    showProblems ? problems.find((p) => p.field === field)?.message : undefined;

  // A clash or an out-of-hours slot is news about the world, not a
  // telling-off about an empty box, so it shows the moment it is true.
  const availabilityError = check.error;

  const price = room
    ? priceForMinutes(durationMinutes, usdPerMinuteFromRoom(room))
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

      createBooking(
        {
          roomId: Number(roomId),
          guestId,
          room,
          settings: settings ?? {},
          start,
          durationMinutes,
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
        <h2>New booking</h2>
        <p>
          For someone at the desk — no one hour of notice needed, and it can
          start this minute.
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
              <span data-num>1</span> Room
            </StepHead>
            <RoomGrid $invalid={Boolean(errorFor("room"))}>
              {(rooms ?? []).map((entry, index) => {
                const selected = String(entry.id) === String(roomId);
                return (
                  <Card
                    key={entry.id}
                    type="button"
                    $selected={selected}
                    disabled={busy}
                    ref={index === 0 ? registerField("room") : undefined}
                    onClick={() => setRoomId(String(entry.id))}
                    aria-pressed={selected}
                  >
                    <strong>
                      {entry.name}
                      {selected ? <Check /> : null}
                    </strong>
                    <span>
                      {entry.maxCapacity} seats ·{" "}
                      {formatCurrency(entry.regularPrice)}/hr
                    </span>
                  </Card>
                );
              })}
            </RoomGrid>
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
          {/* ------------------------------ when ---------------------- */}
          <Step>
            <StepHead>
              <span data-num>3</span> When
            </StepHead>

            <Toggle $on={startsNow}>
              <input
                type="checkbox"
                checked={startsNow}
                disabled={busy}
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
                <span>Keeps up with the clock while this form is open</span>
              </div>
            </Toggle>

            <TextInput
              type="datetime-local"
              value={startValue}
              disabled={busy || startsNow}
              ref={registerField("start")}
              $invalid={Boolean(errorFor("start"))}
              onChange={(e) => setStartValue(e.target.value)}
            />
            {errorFor("start") ? (
              <FieldError>
                <AlertCircle /> {errorFor("start")}
              </FieldError>
            ) : !showProblems && availabilityError ? (
              <FieldError>
                <AlertCircle /> {availabilityError}
              </FieldError>
            ) : null}
          </Step>

          {/* ---------------------------- how long -------------------- */}
          <Step>
            <StepHead>
              <span data-num>4</span> How long
              <small>15-minute steps</small>
            </StepHead>

            <Chips>
              {presets.map((minutes) => (
                <Chip
                  key={minutes}
                  type="button"
                  $active={minutes === durationMinutes}
                  aria-pressed={minutes === durationMinutes}
                  disabled={busy}
                  onClick={() => setDurationMinutes(minutes)}
                >
                  {formatDuration(minutes)}
                </Chip>
              ))}
            </Chips>

            <NativeSelect
              value={durationMinutes}
              disabled={busy}
              ref={registerField("duration")}
              $invalid={Boolean(errorFor("duration"))}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
            >
              {durations.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {formatDuration(minutes)}
                </option>
              ))}
            </NativeSelect>
            {errorFor("duration") ? (
              <FieldError>
                <AlertCircle /> {errorFor("duration")}
              </FieldError>
            ) : null}
          </Step>

          {/* --------------------------- at the desk ------------------ */}
          <Step>
            <StepHead>
              <span data-num>5</span> At the desk
            </StepHead>

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
                  Otherwise it becomes “in use” on its own at the start time
                </span>
              </div>
            </Toggle>
          </Step>
        </Stack>
      </Columns>

      {/* ------------------------------ summary ---------------------- */}
      <Summary as="dl">
        <Line>
          <dt>Room</dt>
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
        <Line>
          <dt>
            <Clock
              size={13}
              style={{ display: "inline", verticalAlign: "-2px" }}
            />{" "}
            When
          </dt>
          <dd>
            {start && end && !Number.isNaN(start.getTime()) ? (
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
        <Total>
          <dt>{formatDuration(durationMinutes)}</dt>
          <dd>
            {price ? formatCurrency(price.usd) : "—"}
            {price ? <small>{price.rwf.toLocaleString()} RWF</small> : null}
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
