/* A render smoke test, not a UI test.

   There is no DOM test setup in this project, so this renders the sheet to
   static markup on the server and reads the result. That is enough to catch
   the two things the pure tests cannot: that the component still mounts,
   and that the interval dropdown really is gone and two time boxes stand
   in its place. Interaction lives in bookingWindow.test.js, where the
   rules that move the two times are pure functions. */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* Deliberately out of order, and with a 9 and a 10 in it: the rooms
   arrive unordered from the database, and the dropdown has to sort them
   the way a person reads room numbers. */
vi.mock("../rooms/useRooms", () => ({
  useRooms: () => ({
    rooms: [
      { id: 3, name: "010", maxCapacity: 12, regularPrice: 40, room_type: "meeting_room" },
      { id: 1, name: "001", maxCapacity: 4, regularPrice: 20, room_type: "meeting_room" },
      { id: 2, name: "009", maxCapacity: 8, regularPrice: 30, room_type: "meeting_room" },
    ],
    isLoading: false,
  }),
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

vi.mock("./useCreateBooking", () => ({
  useCreateBooking: () => ({ createBooking: vi.fn(), isCreating: false }),
}));

vi.mock("../../services/apiGuests", () => ({
  searchGuests: vi.fn(async () => []),
  findOrCreateGuest: vi.fn(),
}));

vi.mock("../../services/apiBookings", () => ({
  getRoomBookingsAround: vi.fn(async () => []),
  /* The form imports this for the shared-space branch. It is never called
     with no room selected, but a module mock that omits an import leaves
     it undefined — which fails the moment somebody adds a test that does
     select one. */
  getRoomSeatBookings: vi.fn(async () => []),
}));

/* Kept off the network. The real hook reads fx_rates and then the rates
   API; the form only wants a number to multiply by. */
vi.mock("../fx/useFxRate", () => ({
  useFxRate: () => ({
    rate: 1500,
    toRwf: (usd) => Math.round(usd * 1500),
    isIndicative: false,
    isLoading: false,
  }),
}));

const { default: CreateBookingForm } = await import("./CreateBookingForm");

function markup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <CreateBookingForm />
    </QueryClientProvider>,
  );
}

describe("CreateBookingForm", () => {
  it("offers the rooms as a dropdown, not a grid of cards", () => {
    const html = markup();
    const options = [...html.matchAll(/<option value="(\d*)"[^>]*>([^<]*)/g)];

    // A placeholder, then one option per room.
    expect(options[0][1]).toBe("");
    expect(options).toHaveLength(4);
  });

  it("sorts the rooms by number, so 9 comes before 10", () => {
    const names = [...markup().matchAll(/<option value="\d+"[^>]*>([^ ]+)/g)].map(
      (match) => match[1],
    );
    expect(names).toEqual(["001", "009", "010"]);
  });

  it("keeps each room's seats and rate on its own option", () => {
    // What the cards used to show. On a closed dropdown the chosen room's
    // label still says it, so collapsing the grid costs nothing.
    expect(markup()).toMatch(/010 — 12 seats/);
  });

  it("asks for a start and an end, each its own control", () => {
    const html = markup();
    expect(html).toContain("Starts");
    expect(html).toContain("Ends");
    expect(html).toContain('id="booking-start"');
    expect(html).toContain('id="booking-end"');
  });

  it("picks the dates in the admin's own calendar, not the browser's", () => {
    // The whole reason for the custom picker: a native datetime-local
    // opens a grey popup the app has no say over.
    const html = markup();
    expect(html).not.toContain("datetime-local");
    expect(html.match(/aria-haspopup="dialog"/g)).toHaveLength(2);
  });

  it("keeps the panel shut until it is asked for", () => {
    const html = markup();
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="dialog"');
  });

  it("has no interval dropdown left — the only select is the room one", () => {
    // A <select> of 15-minute steps is not how a desk states a booking's
    // length, so the one dropdown left in the sheet is the room list.
    const selects = markup().match(/<select[^>]*>/g);
    expect(selects).toHaveLength(1);
    expect(selects[0]).toContain('id="booking-room"');
  });

  it("states the allowed length range instead of enumerating it", () => {
    expect(markup()).toContain("15 min");
  });

  it("opens with an end time already an hour past the start", () => {
    const html = markup();
    // Each trigger says its value back in words — "Sat 26 Sep, 19:45" —
    // inside a span, with the calendar icon after it.
    const clock = (field) =>
      html
        .match(
          new RegExp(`<button id="booking-${field}"[\\s\\S]*?</button>`),
        )[0]
        .match(/(\d{2}):(\d{2})/)
        .slice(1)
        .map(Number);

    const [startHour, startMinute] = clock("start");
    const [endHour, endMinute] = clock("end");
    const spanned =
      (endHour * 60 + endMinute - (startHour * 60 + startMinute) + 1440) % 1440;
    expect(spanned).toBe(60);
  });

  it("freezes the start box while the booking is set to start now", () => {
    const html = markup();
    expect(html.match(/<button id="booking-start"[^>]*>/)[0]).toContain(
      "disabled",
    );
    expect(html.match(/<button id="booking-end"[^>]*>/)[0]).not.toContain(
      "disabled",
    );
  });
});
