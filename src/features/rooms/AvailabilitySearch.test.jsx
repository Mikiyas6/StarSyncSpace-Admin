/* A render smoke test, not a UI test.

   There is no DOM test setup in this project, so this renders the panel
   and the board to static markup and reads the result — the same
   arrangement CreateBookingForm.test.jsx uses, and enough to catch the
   things the pure tests in availability.test.js cannot: that the two
   components still mount, that the closed state really is one line of
   shortcuts rather than a form, and that a running search puts the right
   verdict and the right "free from" beside each room.

   The arithmetic itself is tested next door. What is checked here is that
   the numbers reach the screen. */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const ROOMS = [
  {
    id: 1,
    name: "Room 001",
    room_type: "meeting_room",
    maxCapacity: 8,
    regularPrice: 20,
    image: "",
  },
  {
    id: 2,
    name: "Shared Space 01",
    room_type: "shared_space",
    maxCapacity: 20,
    day_rate_rwf: 30000,
    hour_rate_rwf: 5000,
    month_rate_usd: 100,
    image: "",
  },
];

vi.mock("./useRooms", () => ({
  useRooms: () => ({ rooms: ROOMS, isLoading: false }),
}));

vi.mock("../settings/useSettings", () => ({
  useSettings: () => ({
    settings: {
      business_hours_start: "00:00",
      business_hours_end: "23:59",
      min_booking_duration_minutes: 15,
      max_booking_duration_minutes: 24 * 60,
      booking_buffer_minutes: 15,
    },
    isLoading: false,
  }),
}));

/* Room 001 is taken until 15:00; the shared space has four of its twenty
   desks held over the same window. */
vi.mock("./useRoomsAvailability", () => ({
  useRoomsAvailability: () => ({
    bookings: [
      {
        id: 10,
        roomId: 1,
        startTime: new Date("2026-09-27T13:00").toISOString(),
        endTime: new Date("2026-09-27T15:00").toISOString(),
        status: "booked",
        seats: 1,
        guests: { fullName: "Aline K." },
      },
      ...Array.from({ length: 4 }, (_, index) => ({
        id: 20 + index,
        roomId: 2,
        startTime: new Date("2026-09-27T09:00").toISOString(),
        endTime: new Date("2026-09-27T17:00").toISOString(),
        status: "booked",
        seats: 1,
      })),
    ],
    range: {
      from: new Date("2026-09-27T00:00"),
      to: new Date("2026-09-28T00:00"),
      days: 1,
    },
    isLoading: false,
    isFetching: false,
  }),
}));

const { default: AvailabilitySearch } = await import("./AvailabilitySearch");

/* The rendered markup, as the words a person would read off the screen.

   Assertions are written against this rather than the raw HTML because
   the sentences on this screen are stitched out of several elements —
   "<b>1</b> of 2 spaces can take this" — and an assertion against the
   raw string would be testing the tag structure rather than the claim. */
function text(html) {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* The clock formats on this screen follow the machine's locale, so the
   expected strings are derived from the same formatter rather than typed
   as "15:15" — which is right here and wrong on a machine set to
   twelve-hour time. */
const clock = (iso) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

function render(url) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <AvailabilitySearch />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const RUNNING = "/rooms?from=2026-09-27T14:00&to=2026-09-27T15:00";

describe("AvailabilitySearch", () => {
  it("starts as one line of shortcuts, not a form", () => {
    const words = text(render("/rooms"));

    expect(words).toContain("Check availability");
    expect(words).toContain("Right now");
    expect(words).toContain("This afternoon");
    expect(words).toContain("Tomorrow morning");
    // No board, and no window controls, until something is asked.
    expect(words).not.toContain("can take this");
  });

  it("reads the window back in words", () => {
    const words = text(render(RUNNING));

    expect(words).toContain(clock("2026-09-27T14:00"));
    expect(words).toContain(clock("2026-09-27T15:00"));
    expect(words).toContain("1 hr");
  });

  it("answers for every space at once, sellable first", () => {
    const words = text(render(RUNNING));

    expect(words).toContain("1 of 2 spaces can take this");
    expect(words).toContain("16 desks free");
    // The space can take it; the room cannot, so the space comes first.
    expect(words.indexOf("Shared Space 01")).toBeLessThan(
      words.indexOf("Room 001"),
    );
  });

  it("says who has the room and when it frees up", () => {
    const words = text(render(RUNNING));

    expect(words).toContain("Aline K.");
    // 15:00 plus the 15-minute turnaround.
    expect(words).toContain(`Free from ${clock("2026-09-27T15:15")}`);
  });

  it("offers Book only where the booking could actually be written", () => {
    const html = render(RUNNING);
    expect(html.match(/> Book</g) ?? []).toHaveLength(1);
  });

  it("hides what cannot take the window when asked to", () => {
    const words = text(render(`${RUNNING}&free=1`));

    expect(words).toContain("Shared Space 01");
    expect(words).not.toContain("Room 001");
  });

  it("carries the party size into the question", () => {
    const words = text(render(`${RUNNING}&people=25`));

    // Twenty desks cannot seat twenty-five, whatever the clock says.
    expect(words).toContain("Too small");
    expect(words).toContain("0 of 2 spaces can take this");
  });
});
