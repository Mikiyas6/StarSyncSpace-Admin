/* What the dashboard's money actually says, with the real row behind it.

   Same arrangement as the menu and inventory previews —
   renderToStaticMarkup with the hooks mocked — because the admin's login
   cannot be passed in a test, and the figures on these cards are the
   kind of thing that has to be LOOKED at: "60,000 RWF / 87% of 69,000"
   was wrong in a way no unit test noticed, because every unit test
   agreed with the code.

   Two versions of booking 504. BROKEN is how it sat in the table: taken
   as two hours, frozen at 60,000 RWF by a hardcoded 2025 exchange rate,
   then shortened to eighty minutes without its franc total being
   recomputed — an implied 2,206 RWF to the dollar, which the card
   printed anyway. FIXED is what the desk actually took, 38,500 RWF,
   after migration 22.

   Both are rendered, because the two things worth proving are different:
   that the corrected row reads straight off the booking with no caveat,
   and that a row in the broken shape is caught rather than believed.
*/

/* eslint-env node */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServerStyleSheet, ThemeProvider } from "styled-components";

// The live reading on the day this was written.
const RATE = 1476.64522;

const BOOKING = {
  id: 504,
  created_at: "2026-09-25T21:06:43.033869+00:00",
  startTime: "2026-09-25T21:06:00+00:00",
  endTime: "2026-09-25T22:28:00+00:00",
  status: "completed",
  isPaid: true,
  /* 21:06 to 22:28 is 82 minutes, and at 30,000 RWF an hour that is
     41,000 RWF. 27.77 USD is what it converted to on the day. */
  totalPrice: 27.77,
  extrasPrice: 0,
  amount_rwf: 41000,
  roomId: 310,
  rooms: { id: 310, name: "Meeting Room 02", room_type: "meeting_room" },
};

const BROKEN_BOOKING = { ...BOOKING, totalPrice: 27.2, amount_rwf: 60000 };

/* The four sale rows for that day, as they read once migration 23 has
   run. Everything sold went at cost — the owner's figures — so each
   line's unit_cost_rwf equals its unit_price_rwf and the fridge made
   nothing. 6,500 RWF taken, 6,500 of stock, 0 profit.

   The other thirty-two rows in that table are restocks, transfers,
   waste, removals and corrections. Every one of them has
   revenue_rwf = 0 by construction, which is the whole reason this
   figure can be trusted — see movementRevenueRwf. */
const MOVEMENTS = [
  {
    room_id: 310,
    rooms: { id: 310, name: "Meeting Room 02", room_type: "meeting_room" },
    menu_item_id: 54,
    menu_items: { id: 54, name: "Vitalo Still Water 500ml" },
    delta: -1,
    reason: "sale",
    unit_price_rwf: 500,
    unit_cost_rwf: 500,
    revenue_rwf: 500,
    cogs_rwf: 500,
    profit_rwf: 0,
    spend_rwf: 0,
    created_at: "2026-09-25T21:50:00Z",
  },
  {
    room_id: 310,
    rooms: { id: 310, name: "Meeting Room 02", room_type: "meeting_room" },
    menu_item_id: 50,
    menu_items: { id: 50, name: "Snickers 2" },
    delta: -1,
    reason: "sale",
    unit_price_rwf: 2500,
    unit_cost_rwf: 2500,
    revenue_rwf: 2500,
    cogs_rwf: 2500,
    profit_rwf: 0,
    spend_rwf: 0,
    created_at: "2026-09-25T21:50:00Z",
  },
  {
    room_id: 310,
    rooms: { id: 310, name: "Meeting Room 02", room_type: "meeting_room" },
    menu_item_id: 51,
    menu_items: { id: 51, name: "Jifuchucui" },
    delta: -2,
    reason: "sale",
    unit_price_rwf: 1500,
    unit_cost_rwf: 1500,
    revenue_rwf: 3000,
    cogs_rwf: 3000,
    profit_rwf: 0,
    spend_rwf: 0,
    created_at: "2026-09-25T21:50:00Z",
  },
  {
    room_id: 310,
    rooms: { id: 310, name: "Meeting Room 02", room_type: "meeting_room" },
    menu_item_id: 55,
    menu_items: { id: 55, name: "Wow Pure Mineral Water 500ml" },
    delta: -1,
    reason: "sale",
    unit_price_rwf: 500,
    unit_cost_rwf: 500,
    revenue_rwf: 500,
    cogs_rwf: 500,
    profit_rwf: 0,
    spend_rwf: 0,
    created_at: "2026-09-25T21:50:00Z",
  },
];

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

import Stats from "./Stats";
import RevenueBreakdown from "./RevenueBreakdown";
import {
  revenueByRoom,
  revenueByStream,
  shrinkageByReason,
  topSellingItems,
} from "./revenue";

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

describe("dashboard money preview", () => {
  let html = "";
  let totals;

  beforeAll(() => {
    const bookings = [BOOKING];
    totals = revenueByStream({ bookings, movements: MOVEMENTS, rate: RATE });

    const rendered = renderAll([
      {
        title: "Top of the dashboard — one currency",
        node: (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "2.4rem",
            }}
          >
            <Stats
              bookings={bookings}
              confirmedStays={[{ ...BOOKING, numHours: 1.3333 }]}
              numDays={30}
              roomCount={4}
            />
          </div>
        ),
      },
      {
        title: "Revenue — where the money came from",
        node: (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "2.4rem",
            }}
          >
            <RevenueBreakdown
              totals={totals}
              byRoom={revenueByRoom({
                bookings,
                movements: MOVEMENTS,
                rooms: [BOOKING.rooms],
                rate: RATE,
              })}
              topItems={topSellingItems(MOVEMENTS)}
              shrinkage={shrinkageByReason(MOVEMENTS)}
              isEstimated={totals.estimatedRwf > 0}
            />
          </div>
        ),
      },
    ]);

    html = rendered.html;

    /* Opt-in picture, same as the other previews:

         PREVIEW_OUT=public/preview-dashboard.html npx vitest run \
           src/features/dashboard/preview.test.jsx
    */
    if (!process.env.PREVIEW_OUT) return;

    const out = resolve(process.env.PREVIEW_OUT);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(
      out,
      `<!doctype html><meta charset="utf-8"><title>Dashboard preview</title>
${rendered.css}
<style>
  :root{--color-grey-0:#fff;--color-grey-50:#f9fafb;--color-grey-100:#f3f4f6;--color-grey-200:#e5e7eb;--color-grey-300:#d1d5db;--color-grey-400:#9ca3af;--color-grey-500:#6b7280;--color-grey-600:#4b5563;--color-grey-700:#374151;--color-grey-800:#1f2937;--color-brand-50:#eef2ff;--color-brand-100:#e0e7ff;--color-brand-600:#4f46e5;--color-brand-700:#4338ca;--color-green-100:#dcfce7;--color-green-700:#15803d;--color-yellow-100:#fef9c3;--color-yellow-700:#a16207;--color-red-100:#fee2e2;--color-red-700:#b91c1c;--color-red-800:#991b1b;--color-silver-100:#e5e7eb;--color-silver-700:#374151;
    --color-indigo-100:#e0e7ff;--color-indigo-700:#4338ca;
    --color-chart-1:#4f46e5;--color-chart-2:#0891b2;--color-chart-3:#ca8a04;
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

  /* The complaint, in one assertion: the figure that was on the card is
     not on the card any more, and what the desk took is. */
  it("reports what the booking actually took", () => {
    expect(html).toContain("41,000 RWF");
    expect(html).not.toContain("60,000 RWF");
    expect(html).not.toContain("69,000 RWF");
  });

  it("puts the headline Sales tile in RWF, agreeing with the revenue card", () => {
    expect(totals.meetingRooms).toBe(41000);
    expect(totals.total).toBe(47500);

    /* The tile at the top and the card lower down are two different
       components reading two different queries, and they used to answer
       in two different currencies. */
    expect([...html.matchAll(/41,000 RWF/g)].length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("86% of 47,500 RWF");
  });

  it("shows no dollar sign anywhere on the dashboard's money", () => {
    expect(html).not.toMatch(/\$\s?\d/);
  });

  /* A corrected row is read straight off the booking. No conversion
     happened, so there is nothing to caveat — the caveat appearing here
     would mean the fix had not taken. */
  it("reads the corrected row off the booking, with no estimate caveat", () => {
    expect(totals.estimatedRwf).toBe(0);
    expect(totals.restatedCount).toBe(0);
    expect(html).not.toContain("converted from USD");
  });

  /* And the guard is still armed: a row in the shape 504 was in — a
     franc total frozen against a price the booking no longer has — is
     caught rather than believed, and says so. */
  it("still catches a booking whose frozen franc total cannot be true", () => {
    const broken = revenueByStream({
      bookings: [BROKEN_BOOKING],
      movements: MOVEMENTS,
      rate: RATE,
    });

    expect(broken.restatedCount).toBe(1);
    expect(broken.meetingRooms).toBe(40165); // 27.20 USD at today's rate
    expect(broken.meetingRooms).not.toBe(60000);
  });

  /* Snacks are unaffected: they are priced in RWF and never converted. */
  it("leaves the snack figures alone", () => {
    expect(totals.snacks).toBe(6500);
    expect(totals.snacksCostRwf).toBe(6500);
    /* Sold at cost, so the fridge made nothing that day. The card has to
       be able to say that rather than showing a blank or a loss. */
    expect(totals.snacksProfitRwf).toBe(0);
    expect(html).toContain("6,500 RWF");
    expect(html).toContain("0 RWF</strong> profit after 6,500 RWF");
  });
});
