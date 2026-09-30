/* The two screens where a price is typed and read, in francs.

   Same arrangement as the other previews — renderToStaticMarkup with the
   hooks mocked — because the admin's login cannot be passed in a test.
   These two are worth a picture rather than only an assertion: the room
   form is where somebody decides what a room costs, and it spent a long
   time asking for dollars per hour and showing the franc figure as a
   derived aside. Since migration 21 it is the other way round.
*/

/* eslint-env node */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServerStyleSheet, ThemeProvider } from "styled-components";

const RATE = 1476.64522;

// The two live rooms, as they look after migration 21.
const MEETING_ROOM = {
  id: 310,
  name: "Meeting Room 02",
  room_type: "meeting_room",
  maxCapacity: 7,
  hour_rate_rwf: 30000,
  discount: 0,
  regularPrice: 20.4,
  description: "A private meeting room for two with a 75-inch smart screen.",
  image: "",
};

const SHARED_SPACE = {
  id: 320,
  name: "Shared Space 01",
  room_type: "shared_space",
  maxCapacity: 20,
  hour_rate_rwf: 5000,
  day_rate_rwf: 30000,
  month_rate_rwf: 147059,
  month_rate_usd: 100,
  discount: 0,
  regularPrice: 0,
  description: "A room full of desks, sold one seat at a time.",
  image: "",
};

vi.mock("../fx/useFxRate", () => ({
  useFxRate: () => ({
    rate: RATE,
    toRwf: (usd) => Math.round(usd * RATE),
    source: "api",
    fetchedAt: "2026-09-30T10:23:54.370Z",
    isIndicative: false,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("./useCreateRoom", () => ({
  useCreateRoom: () => ({ createRoom: () => {}, isCreating: false }),
}));
vi.mock("./useEditRoom", () => ({
  useEditRoom: () => ({ editRoom: () => {}, isEditing: false }),
}));
vi.mock("./useDeleteRoom", () => ({
  useDeleteRoom: () => ({ deleteRoom: () => {}, isDeleting: false }),
}));
vi.mock("./RoomImagesManager", () => ({ default: () => null }));
vi.mock("../authentication/useAdminRole", () => ({
  useAdminRole: () => ({
    can: { manageRooms: true, viewRevenue: true },
    isAdmin: true,
    isLoading: false,
  }),
}));

import CreateRoomForm from "./CreateRoomForm";
import RoomRow from "./RoomRow";
import Table from "../../ui/Table";
import Menus from "../../ui/Menus";

const COLUMNS = "6rem 1.8fr 2.2fr 1fr 1fr 3.2rem";

function renderAll(sections) {
  const sheet = new ServerStyleSheet();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  try {
    const html = renderToStaticMarkup(
      sheet.collectStyles(
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <ThemeProvider theme={{}}>
              <>
                {sections.map((section) => (
                  <section key={section.title}>
                    <h2 className="t">{section.title}</h2>
                    <div className="p">{section.node}</div>
                  </section>
                ))}
              </>
            </ThemeProvider>
          </MemoryRouter>
        </QueryClientProvider>,
      ),
    );
    return { html, css: sheet.getStyleTags() };
  } finally {
    sheet.seal();
  }
}

describe("room pricing preview", () => {
  let html = "";

  beforeAll(() => {
    const rendered = renderAll([
      {
        title: "The room list — what each space costs",
        node: (
          <Menus>
            <Table columns={COLUMNS}>
              <Table.Header>
                <div></div>
                <div>Room</div>
                <div>Capacity</div>
                <div>Price</div>
                <div>Discount</div>
                <div></div>
              </Table.Header>
              <RoomRow room={MEETING_ROOM} />
              <RoomRow room={SHARED_SPACE} />
            </Table>
          </Menus>
        ),
      },
      {
        title: "Editing a meeting room — price per hour, in RWF",
        node: <CreateRoomForm roomToEdit={MEETING_ROOM} />,
      },
      {
        title: "Editing a shared space — three seat rates, all in RWF",
        node: <CreateRoomForm roomToEdit={SHARED_SPACE} />,
      },
    ]);

    html = rendered.html;

    /* Opt-in picture. ONE test file at a time — every preview in this
       repo reads the same variable:

         PREVIEW_OUT=public/preview-rooms.html npx vitest run \
           src/features/rooms/pricePreview.test.jsx
    */
    if (!process.env.PREVIEW_OUT) return;

    const out = resolve(process.env.PREVIEW_OUT);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(
      out,
      `<!doctype html><meta charset="utf-8"><title>Room pricing preview</title>
${rendered.css}
<style>
  :root{--color-grey-0:#fff;--color-grey-50:#f9fafb;--color-grey-100:#f3f4f6;--color-grey-200:#e5e7eb;--color-grey-300:#d1d5db;--color-grey-400:#9ca3af;--color-grey-500:#6b7280;--color-grey-600:#4b5563;--color-grey-700:#374151;--color-grey-800:#1f2937;--color-brand-50:#eef2ff;--color-brand-100:#e0e7ff;--color-brand-600:#4f46e5;--color-brand-700:#4338ca;--color-green-100:#dcfce7;--color-green-700:#15803d;--color-yellow-100:#fef9c3;--color-yellow-700:#a16207;--color-red-100:#fee2e2;--color-red-700:#b91c1c;--color-red-800:#991b1b;--color-silver-100:#e5e7eb;--color-silver-700:#374151;
    --border-radius-sm:5px;--border-radius-md:7px;--border-radius-lg:9px;
    --shadow-sm:0 1px 2px rgba(0,0,0,.04);--shadow-md:0 .6rem 2.4rem rgba(0,0,0,.06);--shadow-lg:0 2.4rem 3.2rem rgba(0,0,0,.12);
    --backdrop-color:rgba(255,255,255,.1);--image-grayscale:0;--image-opacity:100%;}
  html{font-size:62.5%}
  body{font-family:system-ui,sans-serif;font-size:1.6rem;background:#f3f4f6;color:var(--color-grey-700);margin:0;padding:2.4rem}
  section{background:var(--color-grey-0);border-radius:9px;margin:0 0 2.4rem;overflow:hidden;box-shadow:var(--shadow-md)}
  .t{font:600 1.4rem/1 system-ui;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;background:#f9fafb;margin:0;padding:1.4rem 2.4rem;border-bottom:1px solid #e5e7eb}
  .p{padding:2.4rem;display:grid;gap:2.4rem}
</style>
<body>${html}</body>`,
    );
    console.log("PREVIEW:", out);
  });

  it("asks for the hourly price in RWF, not USD", () => {
    expect(html).toContain("Price per hour (RWF)");
    expect(html).not.toContain("Price per hour (USD)");
  });

  it("asks for the monthly desk in RWF, not USD", () => {
    expect(html).toContain("ONE MONTH (RWF)");
    expect(html).not.toContain("ONE MONTH (USD)");
  });

  /* The whole hierarchy of the change: the franc rate is what is typed
     in, and the dollar figure is the aside underneath it. */
  it("shows the dollar figure as a derived aside on the form", () => {
    expect(html).toContain("500 RWF/min");
    expect(html).toContain("≈ $20.32/hr at today&#x27;s rate");
    expect(html).toContain("does not move when the exchange rate does");
  });

  it("quotes the discount in francs, off the franc rate", () => {
    expect(html).toContain("Discount per hour (RWF)");
  });

  it("prices both rooms in the list, each on its own axis", () => {
    expect(html).toContain("30,000 RWF/hr");
    expect(html).toContain("500 RWF/min");
    expect(html).toContain("30,000 RWF/desk/day");
    expect(html).toContain("5,000 RWF/desk/hr");
  });

  /* A shared space used to read "$0.00/hr" in this table, because
     `regularPrice` is genuinely 0 on one — it was never where a desk's
     price lived. */
  it("never shows a room as costing nothing", () => {
    expect(html).not.toContain("$0.00");
  });
});
