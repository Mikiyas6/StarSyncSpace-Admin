import { useMemo } from "react";
import styled, { css } from "styled-components";
import {
  Armchair,
  ArrowRight,
  CalendarPlus,
  DoorOpen,
  ImageOff,
  Users,
} from "lucide-react";

import Button, { ButtonContent } from "../../ui/Button";
import Modal from "../../ui/Modal";
import Spinner from "../../ui/Spinner";
import Tag from "../../ui/Tag";
import CreateBookingForm from "../bookings/CreateBookingForm";
import { useSettings } from "../settings/useSettings";
import { formatMenuPrice } from "../../utils/helpers";
import { PASS_TYPES, isSharedSpace, offersHourly } from "../../utils/spaces";
import { useRooms } from "./useRooms";
import {
  availabilityBoard,
  boardSummary,
  verdictMeta,
} from "./availability";
import AvailabilityTimeline from "./AvailabilityTimeline";

/* ------------------------------------------------------------------
   The answer, one row per room.

   Ordered by what the desk can do with it — sellable first — rather than
   by name, because the top of this list is usually the whole answer. Each
   row carries four things, in the order somebody reads them:

     WHAT it is      photo, name, and what it costs in the unit it is
                     actually sold in (per hour for a room, per desk per
                     day for a space). A rate is what the next sentence
                     out of the desk's mouth needs.
     THE VERDICT     free, booked, or how many desks are left.
     THE DAY         the strip, which says when it is free rather than
                     only whether it is free now.
     WHAT NEXT       Book — which carries this exact window into the
                     booking form — or, when it cannot take the window,
                     the next time it could, as a button that moves the
                     search there.

   That last pair is the point of the whole screen. Every other way of
   answering "is anything free at four" ends with the admin re-typing the
   time into a different form and hoping they typed the same thing.
   ------------------------------------------------------------------ */

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

const Summary = styled.div`
  display: flex;
  align-items: center;
  gap: 1.6rem;
  flex-wrap: wrap;
  font-size: 1.4rem;
  color: var(--color-grey-500);
  padding: 0 0.4rem;

  & b {
    font-family: "Space Grotesk";
    font-size: 1.8rem;
    font-weight: 600;
    color: var(--color-grey-700);
  }
`;

const Board = styled.div`
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-md);
  background-color: var(--color-grey-0);
  overflow: hidden;
`;

const Line = styled.article`
  display: grid;
  grid-template-columns: 7.2rem minmax(14rem, 1.4fr) 15rem minmax(18rem, 2fr) 13rem;
  column-gap: 1.6rem;
  align-items: center;
  padding: 1.2rem 2rem;

  &:not(:last-child) {
    border-bottom: 1px solid var(--color-grey-100);
  }

  /* A row nobody can sell is still worth reading — it is what carries the
     "free from" — but it should not compete with the ones they can. */
  ${(props) =>
    !props.$sellable &&
    css`
      background-color: var(--color-grey-50);
    `}

  /* The board is a wide table of five things. Below that it becomes two
     stacked halves rather than five squeezed columns, and the strip keeps
     its full width — squeezing THAT is what makes it unreadable. */
  @media (max-width: 82em) {
    grid-template-columns: 7.2rem minmax(0, 1fr) 13rem;
    row-gap: 1.2rem;

    & > *:nth-child(4) {
      grid-column: 1 / -1;
    }
    & > *:nth-child(5) {
      grid-column: 1 / -1;
      justify-self: start;
    }
  }
`;

const thumbBox = css`
  width: 7.2rem;
  aspect-ratio: 3 / 2;
  border-radius: var(--border-radius-sm);
  border: 1px solid var(--color-grey-200);
  background-color: var(--color-grey-100);
`;

const Img = styled.img`
  ${thumbBox}
  display: block;
  object-fit: cover;
  object-position: center;
`;

const NoImg = styled.div`
  ${thumbBox}
  display: grid;
  place-items: center;
  color: var(--color-grey-400);

  & svg {
    width: 1.8rem;
    height: 1.8rem;
  }
`;

const Which = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;

  & h4 {
    font-family: "Space Grotesk";
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-grey-700);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const Meta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  font-size: 1.2rem;
  color: var(--color-grey-500);

  & svg {
    width: 1.3rem;
    height: 1.3rem;
    color: var(--color-grey-400);
    flex-shrink: 0;
  }
`;

const Verdict = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  align-items: flex-start;

  & small {
    font-size: 1.2rem;
    color: var(--color-grey-500);
    line-height: 1.4;
  }
`;

const Act = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  align-items: stretch;
`;

/* "Free from 16:15", as a button. The suggestion is only useful if acting
   on it is one click — typing 16:15 back into the window by hand is the
   work this screen exists to remove. */
const Later = styled.button.attrs({ type: "button" })`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  font-family: inherit;
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--color-grey-600);
  background-color: var(--color-grey-0);
  border: 1px dashed var(--color-grey-300);
  border-radius: var(--border-radius-sm);
  padding: 0.6rem 0.8rem;
  cursor: pointer;
  white-space: nowrap;

  & svg {
    width: 1.3rem;
    height: 1.3rem;
    color: var(--color-grey-400);
  }

  &:hover {
    border-style: solid;
    border-color: var(--color-brand-600);
    color: var(--color-grey-700);
  }
`;

const Nothing = styled.p`
  padding: 3.2rem 2rem;
  text-align: center;
  font-size: 1.5rem;
  color: var(--color-grey-500);
`;

const TIME = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});
const DAY_TIME = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/* Today's suggestion is a time; tomorrow's needs a day on it, or "free
   from 09:00" reads as this morning, which has passed. */
function freeFromLabel(date, start) {
  const sameDay = date.toDateString() === start.toDateString();
  return sameDay ? TIME.format(date) : DAY_TIME.format(date);
}

function AvailabilityBoard({
  bookings,
  range,
  start,
  end,
  minutes,
  people,
  kind,
  onlyFree,
  isLoading,
  onMoveTo,
}) {
  const { rooms, isLoading: isLoadingRooms } = useRooms();
  const { settings } = useSettings();

  const results = useMemo(
    () =>
      availabilityBoard({
        rooms: rooms ?? [],
        bookings,
        start,
        end,
        people,
        kind,
        settings: settings ?? {},
        onlyFree,
      }),
    [rooms, bookings, start, end, people, kind, settings, onlyFree],
  );

  const summary = useMemo(() => boardSummary(results), [results]);

  if (isLoading || isLoadingRooms) return <Spinner />;

  return (
    <Wrap>
      <Summary>
        <span>
          <b>{summary.sellable}</b> of {summary.total}{" "}
          {summary.total === 1 ? "space" : "spaces"} can take this
        </span>
        {summary.desksFree > 0 ? (
          <span>
            <b>{summary.desksFree}</b> desks free
          </span>
        ) : null}
        {summary.soonest ? (
          <span>
            Nothing free now — earliest is{" "}
            <b>{freeFromLabel(summary.soonest, start)}</b>
          </span>
        ) : null}
      </Summary>

      <Board>
        {results.length === 0 ? (
          <Nothing>
            {onlyFree
              ? "Nothing can take this window. Turn off “only what can take it” to see when each space frees up."
              : "No rooms match that filter."}
          </Nothing>
        ) : null}

        {results.map((result) => {
          const { room } = result;
          const meta = verdictMeta(result.verdict);
          const shared = isSharedSpace(room);
          const roomBookings = (bookings ?? []).filter(
            (booking) => String(booking.roomId) === String(room.id),
          );

          return (
            <Line key={room.id} $sellable={result.isSellable}>
              {room.image ? (
                <Img src={room.image} alt="" />
              ) : (
                <NoImg title="No photo yet">
                  <ImageOff />
                </NoImg>
              )}

              <Which>
                <h4 title={room.name}>{room.name}</h4>
                <Meta>
                  {shared ? <Armchair /> : <DoorOpen />}
                  <span>
                    {shared
                      ? `${formatMenuPrice(room.day_rate_rwf ?? 0, "RWF")}/desk/day`
                      : `${formatMenuPrice(room.hour_rate_rwf ?? 0, "RWF")}/hr`}
                  </span>
                  <Users />
                  <span>{result.capacity}</span>
                </Meta>
              </Which>

              <Verdict>
                <Tag type={meta.tag}>
                  {shared && result.seats && result.isSellable
                    ? `${result.seats.left} free`
                    : meta.label}
                </Tag>
                {/* A single clash is named below, so saying "one booking
                    in the way" above it is the same sentence twice and
                    makes every busy row three lines tall. */}
                {result.note && result.clashes.length !== 1 ? (
                  <small>{result.note}</small>
                ) : null}
                {result.clashes.length ? (
                  <small>
                    {result.clashes[0].guests?.fullName
                      ? `${result.clashes[0].guests.fullName}, `
                      : ""}
                    {TIME.format(new Date(result.clashes[0].startTime))}–
                    {TIME.format(new Date(result.clashes[0].endTime))}
                  </small>
                ) : null}
              </Verdict>

              {/* The seat count is not repeated under the strip: the
                  verdict column already carries it in words, and the
                  strip's job is the SHAPE of the day rather than the
                  figure. */}
              <div>
                <AvailabilityTimeline
                  room={room}
                  bookings={roomBookings}
                  range={range}
                  start={start}
                  end={end}
                  settings={settings}
                />
              </div>

              <Act>
                {result.isSellable ? (
                  <Modal>
                    <Modal.Open opens={`book-${room.id}`}>
                      <Button size="small">
                        <ButtonContent>
                          <CalendarPlus size={15} /> Book
                        </ButtonContent>
                      </Button>
                    </Modal.Open>
                    <Modal.Window name={`book-${room.id}`}>
                      <CreateBookingForm
                        prefill={{
                          roomId: room.id,
                          start,
                          end,
                          minutes,
                          /* A meeting room takes the window as it stands.
                             A desk is sold by the hour when the space is
                             offered that way, and otherwise as a day pass
                             — never as an hourly sale the database has no
                             rate for. */
                          seats: shared ? people : 1,
                          numGuests: people,
                          passType: offersHourly(room)
                            ? PASS_TYPES.HOURLY
                            : PASS_TYPES.DAY,
                        }}
                      />
                    </Modal.Window>
                  </Modal>
                ) : null}

                {result.freeFrom ? (
                  <Later
                    onClick={() => onMoveTo(result.freeFrom)}
                    title={`Move the search to ${freeFromLabel(result.freeFrom, start)}`}
                  >
                    Free from {freeFromLabel(result.freeFrom, start)}
                    <ArrowRight />
                  </Later>
                ) : null}
              </Act>
            </Line>
          );
        })}
      </Board>
    </Wrap>
  );
}

export default AvailabilityBoard;
