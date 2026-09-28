import { useMemo } from "react";
import styled from "styled-components";

import { bookingMinutes, formatDuration } from "../../utils/booking";
import { isSharedSpace } from "../../utils/spaces";
import {
  gapFor,
  mergeHeatRuns,
  nowMarker,
  occupancyBlocks,
  seatHeatCells,
  timelineTicks,
  windowMarker,
} from "./availability";

/* ------------------------------------------------------------------
   One room's day, on one line.

   A verdict tells the desk whether the room is free at four. The strip
   tells them WHY, and what to offer instead, without reading anything:
   the day runs left to right, what is taken is dark, the window being
   asked about is outlined, and now is a line. Somebody looking at eight
   of these sees the shape of the afternoon in about a second, which is
   the thing a list of "Booked / Free" tags cannot do at any length.

   The two room types are drawn DIFFERENTLY, because they are different
   questions and one drawing cannot answer both:

     a meeting room   is let whole, so its day is a row of BLOCKS — this
                      session, then that one, each with its turnaround
                      hatched on the end so a gap that looks free but is
                      not reads as what it is.

     a shared space   has twenty bookings overlapping by design, so blocks
                      would be twenty bars stacked on top of each other.
                      Its day is a HEAT strip instead: each half hour
                      shaded by how much of the room is held at its
                      busiest moment inside it. Full reads solid, empty
                      reads as the bare track, and the morning rush is
                      visible as a dark band.

   Everything positioned here is a percentage of the strip's own width,
   worked out in availability.js from real dates. No pixel arithmetic and
   no fixed width, so the strip is as wide as its column happens to be.
   ------------------------------------------------------------------ */

const Wrap = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

/* The day itself: the bare track is FREE time. Making free the absence of
   ink rather than a colour of its own is what lets the eye find the gaps
   instead of counting the bookings. */
const Track = styled.div`
  position: relative;
  height: 2.8rem;
  border-radius: var(--border-radius-sm);
  background-color: var(--color-grey-100);
  border: 1px solid var(--color-grey-200);
  overflow: hidden;
`;

const Band = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
`;

/* Somebody's session. Coral rather than red: this is a room doing its
   job, not an error, and the palette already uses coral for "in use". */
const Booked = styled(Band)`
  background-color: var(--color-coral-700);
  opacity: 0.85;
  border-radius: 3px;
`;

/* The turnaround window after a booking. The room is just as unavailable
   here, but nobody is in it — hatched, so a desk does not read the gap
   between two meetings as bookable and then get refused by the form. */
const Turnaround = styled(Band)`
  background-image: repeating-linear-gradient(
    45deg,
    var(--color-grey-400) 0 2px,
    transparent 2px 5px
  );
  opacity: 0.7;
`;

/* One half hour of a shared space, shaded by how full it is. A solid
   colour at partial opacity rather than a scale of named colours: the
   value being shown is continuous, and brand-600 inverts between light
   and dark mode on its own, so the strip stays legible in both without a
   second set of rules. */
const Heat = styled(Band)`
  background-color: var(--color-brand-600);
  opacity: ${(props) => 0.12 + props.$ratio * 0.72};
`;

/* The window being asked about, outlined over whatever is underneath it.
   Outlined rather than filled, because the answer is what it OVERLAPS. */
const Asked = styled(Band)`
  border: 2px solid var(--color-gold-500);
  border-radius: 4px;
  background-color: transparent;
  box-shadow: 0 0 0 1px var(--color-grey-0) inset;
  z-index: 2;
  pointer-events: none;
`;

const Now = styled.div`
  position: absolute;
  top: -1px;
  bottom: -1px;
  width: 2px;
  background-color: var(--color-teal-500);
  z-index: 3;
  pointer-events: none;
`;

const Axis = styled.div`
  position: relative;
  height: 1.2rem;
  font-family: "Space Grotesk";
  font-size: 1rem;
  color: var(--color-grey-400);
`;

const Tick = styled.span`
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  white-space: nowrap;

  /* The ends would otherwise hang off the strip. */
  &:first-child {
    transform: none;
  }
  &:last-child {
    transform: translateX(-100%);
  }
`;

/* What a block says when hovered. Deliberately the guest's name and the
   real length of the booking — bookingMinutes(), not numHours, which is
   rounded to whole hours and lies about half of them. */
function blockTitle(block) {
  const times = `${fmt(block.start)}–${fmt(block.end)}`;
  const who = block.booking?.guests?.fullName;
  const long = formatDuration(bookingMinutes(block.booking));
  return who ? `${who} · ${times} (${long})` : `${times} (${long})`;
}

function fmt(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function AvailabilityTimeline({
  room,
  bookings = [],
  range,
  start,
  end,
  settings,
}) {
  const shared = isSharedSpace(room);
  const gapMinutes = gapFor(settings);

  const blocks = useMemo(
    () =>
      shared ? [] : occupancyBlocks(bookings, range.from, range.to, gapMinutes),
    [shared, bookings, range.from, range.to, gapMinutes],
  );

  /* One cell per half hour of the strip, however many days it spans, so a
     multi-day window does not get 48 cells a week wide. */
  const cells = useMemo(() => {
    if (!shared) return [];
    const hours = (range.to - range.from) / (60 * 60 * 1000);
    return mergeHeatRuns(
      seatHeatCells(room, bookings, range.from, range.to, Math.round(hours * 2)),
    );
  }, [shared, room, bookings, range.from, range.to]);

  const asked = useMemo(
    () => windowMarker(start, end, range.from, range.to),
    [start, end, range.from, range.to],
  );
  const now = useMemo(() => nowMarker(range.from, range.to), [range.from, range.to]);
  const ticks = useMemo(() => timelineTicks(range.from, range.to), [range.from, range.to]);

  return (
    <Wrap>
      <Track>
        {blocks.map((block) => (
          <Booked
            key={block.booking.id}
            style={{ left: `${block.leftPct}%`, width: `${block.widthPct}%` }}
            title={blockTitle(block)}
          />
        ))}
        {blocks
          .filter((block) => block.gapPct > 0)
          .map((block) => (
            <Turnaround
              key={`gap-${block.booking.id}`}
              style={{
                left: `${block.leftPct + block.widthPct}%`,
                width: `${block.gapPct}%`,
              }}
              title={`${gapMinutes} min turnaround`}
            />
          ))}

        {cells
          .filter((cell) => cell.taken > 0)
          .map((cell) => (
            <Heat
              key={cell.start.toISOString()}
              $ratio={cell.ratio}
              /* A pixel wider than it measures: two bands that abut at a
                 fractional percentage otherwise leave a hairline of track
                 showing between them, which reads as a gap in a day that
                 has none. */
              style={{
                left: `${cell.leftPct}%`,
                width: `calc(${cell.widthPct}% + 1px)`,
              }}
              title={`${fmt(cell.start)}–${fmt(cell.end)} · ${cell.taken} of ${cell.capacity} desks held`}
            />
          ))}

        <Asked style={{ left: `${asked.leftPct}%`, width: `${asked.widthPct}%` }} />
        {now ? <Now style={{ left: `${now.leftPct}%` }} title="Now" /> : null}
      </Track>

      <Axis aria-hidden="true">
        {ticks.map((tick) => (
          <Tick key={tick.at.toISOString()} style={{ left: `${tick.leftPct}%` }}>
            {tick.label}
          </Tick>
        ))}
      </Axis>
    </Wrap>
  );
}

export default AvailabilityTimeline;
