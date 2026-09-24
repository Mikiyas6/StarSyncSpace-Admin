import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Search, UserPlus, Zap } from "lucide-react";

import Form from "../../ui/Form";
import FormRow from "../../ui/FormRow";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Textarea from "../../ui/Textarea";
import Button from "../../ui/Button";
import SpinnerMini from "../../ui/SpinnerMini";
import Checkbox from "../../ui/Checkbox";

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

   The public site's form is built around a person browsing: it shows a
   grid of start times an hour or more away, and takes a card payment
   before it writes anything. Neither fits a walk-in. This one asks the
   four questions the desk actually asks — who, which room, from when,
   for how long — defaults the start to "right now", and lets the desk
   record that cash has changed hands.

   The rules that protect the ROOM are identical to the public site's
   (see utils/booking.js); only the rules that protect the CHECKOUT are
   dropped.
   ------------------------------------------------------------------ */

const Grid = styled.div`
  display: grid;
  gap: 1.2rem;
  grid-template-columns: 1fr 1fr;
`;

const Hint = styled.p`
  font-size: 1.2rem;
  color: var(--color-grey-500);
  margin-top: 0.4rem;
`;

const Problem = styled.p`
  font-size: 1.4rem;
  color: var(--color-red-700);
  background-color: var(--color-red-100);
  padding: 0.8rem 1.2rem;
  border-radius: var(--border-radius-sm);
`;

const Summary = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1.2rem;
  padding: 1.2rem 1.6rem;
  border-radius: var(--border-radius-sm);
  background-color: var(--color-grey-50);
  border: 1px solid var(--color-grey-100);

  & strong {
    font-family: "Space Grotesk";
    font-size: 1.8rem;
  }
`;

const GuestList = styled.ul`
  list-style: none;
  max-height: 18rem;
  overflow-y: auto;
  border: 1px solid var(--color-grey-100);
  border-radius: var(--border-radius-sm);

  & li + li {
    border-top: 1px solid var(--color-grey-100);
  }
`;

const GuestButton = styled.button`
  width: 100%;
  text-align: left;
  background: ${(props) =>
    props.$selected ? "var(--color-brand-100)" : "transparent"};
  border: none;
  padding: 0.8rem 1.2rem;
  font-size: 1.4rem;
  cursor: pointer;

  &:hover {
    background-color: var(--color-grey-100);
  }

  & span {
    display: block;
    color: var(--color-grey-500);
    font-size: 1.2rem;
  }
`;

const Tabs = styled.div`
  display: flex;
  gap: 0.8rem;
  margin-bottom: 1.2rem;
`;

// <input type="datetime-local"> wants local wall-clock time with no zone.
// toISOString() would hand it UTC and silently shift the booking by the
// timezone offset, which in Kigali is two hours of free room time.
function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const DURATION_PRESETS = [30, 60, 120, 240, 480, FULL_DAY_MINUTES];

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

  // Guest: pick an existing one, or take the details of someone new.
  const [guestMode, setGuestMode] = useState("existing");
  const [guestSearch, setGuestSearch] = useState("");
  const [selectedGuestId, setSelectedGuestId] = useState(null);
  const [newGuest, setNewGuest] = useState({ fullName: "", email: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      start ? new Date(start.getTime() + durationMinutes * MINUTE_MS) : null,
    [start, durationMinutes],
  );

  // The room's existing bookings, so a clash is shown while the desk is
  // still typing rather than after they hit save.
  const { data: existingBookings = [] } = useQuery({
    queryKey: [
      "room-bookings",
      roomId,
      start?.toISOString(),
      end?.toISOString(),
    ],
    queryFn: () => getRoomBookingsAround(roomId, start, end),
    enabled: Boolean(roomId && start && end),
  });

  const durations = useMemo(() => durationOptions(settings), [settings]);
  const presets = useMemo(
    () => DURATION_PRESETS.filter((minutes) => durations.includes(minutes)),
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

  const price = room
    ? priceForMinutes(durationMinutes, usdPerMinuteFromRoom(room))
    : null;

  const guestChosen =
    guestMode === "existing"
      ? Boolean(selectedGuestId)
      : Boolean(newGuest.fullName.trim() && newGuest.email.trim());

  const blocked = Boolean(check.error) || !guestChosen || !room;

  async function handleSubmit(e) {
    e.preventDefault();
    if (blocked || isSubmitting || isCreating) return;

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
          // A walk-in who is already in the room is "in use", not
          // "booked". Everything else starts as "booked" and the
          // reconciler moves it along at its start time on its own.
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
      <Form type="modal">
        <SpinnerMini />
      </Form>
    );

  const busy = isCreating || isSubmitting;

  return (
    <Form type="modal" onSubmit={handleSubmit}>
      <FormRow label="Room">
        <Select
          id="roomId"
          value={roomId}
          disabled={busy}
          onChange={(e) => setRoomId(e.target.value)}
          options={[
            { value: "", label: "Pick a room…" },
            ...(rooms ?? []).map((entry) => ({
              value: entry.id,
              label: `${entry.name} · ${formatCurrency(
                entry.regularPrice,
              )}/hr · ${entry.maxCapacity} seats`,
            })),
          ]}
        />
      </FormRow>

      <FormRow label="Guest">
        <div>
          <Tabs>
            <Button
              type="button"
              size="small"
              variation={guestMode === "existing" ? "primary" : "secondary"}
              onClick={() => setGuestMode("existing")}
            >
              <Search size={14} /> Existing guest
            </Button>
            <Button
              type="button"
              size="small"
              variation={guestMode === "new" ? "primary" : "secondary"}
              onClick={() => setGuestMode("new")}
            >
              <UserPlus size={14} /> New walk-in
            </Button>
          </Tabs>

          {guestMode === "existing" ? (
            <>
              <Input
                type="search"
                id="guestSearch"
                placeholder="Search by name or email"
                value={guestSearch}
                disabled={busy}
                onChange={(e) => setGuestSearch(e.target.value)}
                style={{ width: "100%", marginBottom: "0.8rem" }}
              />
              {isSearchingGuests && !guests.length ? (
                <SpinnerMini />
              ) : guests.length ? (
                <GuestList>
                  {guests.map((guest) => (
                    <li key={guest.id}>
                      <GuestButton
                        type="button"
                        $selected={selectedGuestId === guest.id}
                        onClick={() => setSelectedGuestId(guest.id)}
                      >
                        {guest.fullName}
                        <span>{guest.email}</span>
                      </GuestButton>
                    </li>
                  ))}
                </GuestList>
              ) : (
                <Hint>
                  No guest matches that. Use “New walk-in” to add them.
                </Hint>
              )}
            </>
          ) : (
            <Grid>
              <Input
                id="newGuestName"
                placeholder="Full name"
                value={newGuest.fullName}
                disabled={busy}
                onChange={(e) =>
                  setNewGuest((current) => ({
                    ...current,
                    fullName: e.target.value,
                  }))
                }
              />
              <Input
                id="newGuestEmail"
                type="email"
                placeholder="Email"
                value={newGuest.email}
                disabled={busy}
                onChange={(e) =>
                  setNewGuest((current) => ({
                    ...current,
                    email: e.target.value,
                  }))
                }
              />
              <Hint style={{ gridColumn: "1 / -1" }}>
                If this email already belongs to a guest, the booking is
                attached to that account instead of creating a second one.
              </Hint>
            </Grid>
          )}
        </div>
      </FormRow>

      <FormRow label="Starts">
        <div>
          <Checkbox
            id="startsNow"
            checked={startsNow}
            disabled={busy}
            onChange={() => setStartsNow((current) => !current)}
          >
            <Zap size={14} /> Start right now
          </Checkbox>
          <Input
            type="datetime-local"
            id="startTime"
            value={startValue}
            disabled={busy || startsNow}
            onChange={(e) => setStartValue(e.target.value)}
            style={{ marginTop: "0.8rem" }}
          />
          <Hint>
            Desk bookings have no one-hour notice — unlike the public site,
            this can start this minute.
          </Hint>
        </div>
      </FormRow>

      <FormRow label="Length">
        <div>
          <Tabs>
            {presets.map((minutes) => (
              <Button
                key={minutes}
                type="button"
                size="small"
                variation={
                  minutes === durationMinutes ? "primary" : "secondary"
                }
                disabled={busy}
                onClick={() => setDurationMinutes(minutes)}
              >
                {formatDuration(minutes)}
              </Button>
            ))}
          </Tabs>
          <Select
            id="durationMinutes"
            value={durationMinutes}
            disabled={busy}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            options={durations.map((minutes) => ({
              value: minutes,
              label: formatDuration(minutes),
            }))}
          />
          {end ? (
            <Hint>
              Runs until{" "}
              {end.toLocaleString(undefined, {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Hint>
          ) : null}
        </div>
      </FormRow>

      <FormRow label="People">
        <Input
          type="number"
          id="numGuests"
          min={1}
          max={room?.maxCapacity ?? 50}
          value={numGuests}
          disabled={busy}
          onChange={(e) => setNumGuests(e.target.value)}
        />
      </FormRow>

      <FormRow label="Notes">
        <Textarea
          id="observations"
          value={observations}
          disabled={busy}
          maxLength={1000}
          onChange={(e) => setObservations(e.target.value)}
          placeholder="Anything the team should know — setup, invoicing, who to call"
        />
      </FormRow>

      <FormRow label="At the desk">
        <div>
          <Checkbox
            id="isPaid"
            checked={isPaid}
            disabled={busy}
            onChange={() => setIsPaid((current) => !current)}
          >
            Payment taken
          </Checkbox>
          <Checkbox
            id="startInUse"
            checked={startInUse}
            disabled={busy}
            onChange={() => setStartInUse((current) => !current)}
          >
            They are going in now, mark it “in use”
          </Checkbox>
          <Hint>
            Leave both alone for a booking that is being held for later —
            it becomes “in use” on its own at the start time.
          </Hint>
        </div>
      </FormRow>

      {check.error ? (
        <FormRow>
          <Problem>{check.error}</Problem>
        </FormRow>
      ) : null}

      {room && price ? (
        <FormRow>
          <Summary>
            <span>
              {room.name} · {formatDuration(durationMinutes)}
            </span>
            <strong>
              {formatCurrency(price.usd)} · {price.rwf.toLocaleString()} RWF
            </strong>
          </Summary>
        </FormRow>
      ) : null}

      <FormRow>
        <Button
          type="button"
          variation="secondary"
          disabled={busy}
          onClick={() => onCloseModal?.()}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={blocked || busy}>
          {busy ? "Creating…" : "Create booking"}
        </Button>
      </FormRow>
    </Form>
  );
}

export default CreateBookingForm;
