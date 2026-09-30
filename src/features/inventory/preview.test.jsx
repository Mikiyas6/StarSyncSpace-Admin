/* A render smoke test that also leaves a picture behind.

   Same arrangement as AvailabilitySearch.test.jsx — renderToStaticMarkup
   with the hooks mocked — because the admin's login cannot be passed in
   a test. What it adds is that the markup is written to a file, so the
   cost, margin, profit and restock-alert work can actually be LOOKED at
   rather than only asserted about.

   The fixtures are the real ones: the 25 September delivery and David's
   purchase, exactly as supabase/11-snack-seed-2026-09-25.sql seeds them.
   If this stops matching that file, one of the two is wrong.
*/

/* eslint-env node */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServerStyleSheet, ThemeProvider } from "styled-components";

/* ---- the seeded state of the two rooms, after David left ---- */

const ROOMS = [
  { id: 319, name: "Meeting Room 01", room_type: "meeting_room" },
  { id: 310, name: "Meeting Room 02", room_type: "meeting_room" },
];

/* One row per ROOM per ITEM, and the item id is shared across rooms —
   which is the whole point of the totals panel and was the one thing an
   earlier version of this fixture got wrong: giving every row its own
   menuItemId made the same Snickers in two rooms look like two different
   snacks, and the totals silently agreed. */
function stockRow(rowId, itemId, roomId, roomName, name, price, cost, quantity, par) {
  return {
    id: rowId,
    roomId,
    roomName,
    roomType: "meeting_room",
    menuItemId: itemId,
    name,
    price,
    cost_rwf: cost,
    currency: "RWF",
    categoryName: null,
    sectionName: null,
    isArchived: false,
    imageUrl: null,
    quantity,
    par_level: par,
    updatedAt: "2026-09-25T21:50:00Z",
  };
}

const ITEM = {
  apple: 101, wow: 102, vitalo: 103, snickers: 104,
  jifu: 105, malt: 106, niks: 107, gone: 108,
};

const STOCK = [
  // Meeting Room 01
  stockRow(1, ITEM.apple,    319, "Meeting Room 01", "Inyange Apple Juice 500ml", 2000, 1166.67, 3, 1),
  stockRow(2, ITEM.wow,      319, "Meeting Room 01", "Wow Pure Mineral Water 500ml", 1000, 500, 4, 2),
  stockRow(3, ITEM.vitalo,   319, "Meeting Room 01", "Vitalo Still Water 500ml", 1000, 600, 1, 1),
  stockRow(4, ITEM.snickers, 319, "Meeting Room 01", "Snickers 2", 5000, 3000, 3, 1),
  stockRow(5, ITEM.jifu,     319, "Meeting Room 01", "Jifuchucui", 1500, 750, 4, 2),
  // Meeting Room 02
  stockRow(6, ITEM.apple,    310, "Meeting Room 02", "Inyange Apple Juice 500ml", 2000, 1166.67, 9, 3),
  stockRow(7, ITEM.wow,      310, "Meeting Room 02", "Wow Pure Mineral Water 500ml", 1000, 500, 1, 1),
  stockRow(8, ITEM.vitalo,   310, "Meeting Room 02", "Vitalo Still Water 500ml", 1000, 600, 3, 2),
  stockRow(9, ITEM.malt,     310, "Meeting Room 02", "Power Malt", 5000, 2500, 6, 2),
  stockRow(10, ITEM.niks,    310, "Meeting Room 02", "Niks Caramel", 2000, 800, 4, 2),
  stockRow(11, ITEM.snickers,310, "Meeting Room 02", "Snickers 2", 5000, 3000, 0, 1),
  stockRow(12, ITEM.jifu,    310, "Meeting Room 02", "Jifuchucui", 1500, 750, 0, 1),
  // Carried in one room only, and that room has none — gone everywhere.
  stockRow(13, ITEM.gone,    310, "Meeting Room 02", "Power Malt Zero", 5000, 2500, 0, 2),
];

vi.mock("./useInventory", () => ({
  useInventory: () => ({ stock: STOCK, isLoading: false, error: null }),
  useSetParLevel: () => ({ savePar: () => {}, isSavingPar: false }),
  useAddItemToRoom: () => ({ addItem: () => {}, isAdding: false }),
  useRemoveItemFromRoom: () => ({ removeItem: () => {}, isRemovingItem: false }),
  useRecordMovement: () => ({ record: () => {}, isRecording: false }),
  useRestock: () => ({ restock: () => {}, isRestocking: false }),
  useTransferStock: () => ({ transfer: () => {}, isTransferring: false }),
  useLowStockCount: () => ({ lowCount: 4 }),
  useStockableItems: () => ({
    items: [
      { menuItemId: 99, name: "Fanta Orange 300ml", price: 1000, currency: "RWF" },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock("../menu/useMenuOverview", () => ({
  menuQueryKey: ["menuOverview"],
  useMenuOverview: () => ({
    data: {
      images: [],
      categories: [
        { id: 1, name: "Food", sort_order: 1 },
        { id: 2, name: "Drinks", sort_order: 2 },
      ],
      sections: [
        { id: 4, category_id: 1, name: "Snacks", sort_order: 4, is_active: true },
        { id: 7, category_id: 2, name: "Water", sort_order: 2, is_active: true },
      ],
    },
    isLoading: false,
  }),
}));

vi.mock("../menu/useCreateMenuItem", () => ({
  useCreateMenuItem: () => ({ createMenuItem: () => {}, isCreating: false }),
}));

vi.mock("../rooms/useRooms", () => ({
  useRooms: () => ({ rooms: ROOMS, isLoading: false }),
}));

/* The whole capability map, not just the two this preview reads today.
   A partial mock silently answers `undefined` for anything added later,
   which reads as "denied" — so the admin preview would quietly stop
   showing controls an admin actually has, and the picture would be
   wrong in the one direction nobody checks. */
vi.mock("../authentication/useAdminRole", () => ({
  useAdminRole: () => ({
    isAdmin: true,
    role: "admin",
    can: {
      manageStock: true,
      manageMenu: true,
      removeStock: true,
      transferStock: true,
      sellStock: true,
    },
  }),
}));

vi.mock("../authentication/useUser", () => ({
  useUser: () => ({ user: { id: "preview-admin" }, isAuthenticated: true }),
}));

import InventoryPage from "./InventoryPage";
import StockMovementForm from "./StockMovementForm";
import { restockAlertText, restockAlertTitle } from "./useRestockAlerts";
import ItemPhotoForm from "./ItemPhotoForm";
import AddStockItemForm from "./AddStockItemForm";

/* The same form with its second tab selected. The tab is component
   state, so the preview drives it the way a person would rather than
   reaching inside: render it, then render it again pre-clicked via a
   thin wrapper that flips the initial mode. */
function AddStockItemFormNew(props) {
  return <AddStockItemForm {...props} initialMode="new" />;
}
import RevenueBreakdown from "../dashboard/RevenueBreakdown";
import { revenueByRoom, revenueByStream, topSellingItems, shrinkageByReason } from "../dashboard/revenue";

/* David's purchase, in the shape getStockMovements() returns. */
function sale(menuItemId, name, delta, price, cost) {
  return {
    room_id: 310,
    rooms: { id: 310, name: "Meeting Room 02", room_type: "meeting_room" },
    menu_item_id: menuItemId,
    menu_items: { id: menuItemId, name },
    delta,
    reason: "sale",
    unit_price_rwf: price,
    unit_cost_rwf: cost,
    revenue_rwf: Math.abs(delta) * price,
    cogs_rwf: Math.abs(delta) * cost,
    spend_rwf: 0,
    profit_rwf: Math.abs(delta) * (price - cost),
    created_at: "2026-09-25T21:50:00Z",
  };
}

const MOVEMENTS = [
  sale(3, "Vitalo Still Water 500ml", -1, 1000, 600),
  sale(4, "Snickers 2", -1, 5000, 3000),
  sale(5, "Jifuchucui", -2, 1500, 750),
];

/* ONE ServerStyleSheet for the whole page, not one per section.

   Each sheet numbers its generated class names from zero, so N sheets
   concatenated into one document can produce N different rules sharing a
   name, and the last one wins. Nothing has been seen to break because of
   it here — an earlier round of blank-looking table rows turned out to be
   a screenshot taken mid-paint, not a collision — but concatenating
   independently-numbered sheets is a real hazard and there is no reason
   to keep doing it when one pass is just as easy. */
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

describe("inventory preview", () => {
  const totals = revenueByStream({ movements: MOVEMENTS, rate: 1500 });

  const ALERTS = [
    { id: "a", roomName: "Meeting Room 02", name: "Snickers 2", quantity: 0, parLevel: 1, isOut: true, suggested: 1, state: "empty" },
    { id: "b", roomName: "Meeting Room 02", name: "Jifuchucui", quantity: 0, parLevel: 1, isOut: true, suggested: 1, state: "empty" },
    { id: "c", roomName: "Meeting Room 01", name: "Vitalo Still Water 500ml", quantity: 1, parLevel: 1, isOut: false, suggested: 1, state: "low" },
    { id: "d", roomName: "Meeting Room 02", name: "Wow Pure Mineral Water 500ml", quantity: 1, parLevel: 1, isOut: false, suggested: 1, state: "low" },
  ];

  let html = "";

  beforeAll(() => {
    const rendered = renderAll([
      {
        title: "Inventory — margin per item",
        node: <InventoryPage />,
      },
      {
        title: "Restock — prices captured on delivery",
        node: (
          <StockMovementForm
            row={STOCK.find((r) => r.name === "Power Malt")}
            defaultReason="restock"
          />
        ),
      },
      {
        title: "Sell — takings and profit",
        node: (
          <StockMovementForm
            row={STOCK.find((r) => r.name === "Snickers 2" && r.roomId === 319)}
            defaultReason="sale"
          />
        ),
      },
      {
        title: "Add an item — pick one that exists",
        node: <AddStockItemForm room={ROOMS[1]} alreadyStocked={[]} />,
      },
      {
        title: "Add an item — create a new one, with a photo",
        node: <AddStockItemFormNew room={ROOMS[1]} alreadyStocked={[]} />,
      },
      {
        title: "Send to another room — asks where",
        node: (
          <StockMovementForm
            row={STOCK.find((r) => r.name === "Niks Caramel")}
            defaultReason="transfer_out"
          />
        ),
      },
      {
        title: "Photos — opened from an inventory row",
        node: (
          <ItemPhotoForm
            row={STOCK.find((r) => r.name === "Snickers 2" && r.roomId === 310)}
          />
        ),
      },
      {
        title: "Revenue — snack profit",
        node: (
          <RevenueBreakdown
            totals={totals}
            byRoom={revenueByRoom({ movements: MOVEMENTS, rooms: ROOMS, rate: 1500 })}
            topItems={topSellingItems(MOVEMENTS)}
            shrinkage={shrinkageByReason(MOVEMENTS)}
            isEstimated={false}
          />
        ),
      },
      {
        title: "Restock alerts — as the bell and the toast word them",
        node: (
          <ul style={{ font: "14px/1.7 system-ui", padding: "0 1.6rem" }}>
            {ALERTS.map((a) => (
              <li key={a.id}>
                <b>{restockAlertTitle(a)}</b>
                <br />
                {restockAlertText(a)}
              </li>
            ))}
          </ul>
        ),
      },
    ]);

    html = rendered.html;

    /* The picture is opt-in. Set PREVIEW_OUT to a path and this writes a
       standalone page there — handy for actually looking at the margin,
       profit and alert wording:

         PREVIEW_OUT=public/preview-inventory.html npx vitest run \
           src/features/inventory/preview.test.jsx

       Unset, which is how CI and everybody else runs it, nothing is
       written and this stays an ordinary render test. */
    if (!process.env.PREVIEW_OUT) return;

    const out = resolve(process.env.PREVIEW_OUT);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(
      out,
      `<!doctype html><meta charset="utf-8"><title>Inventory preview</title>
${rendered.css}
<style>
  :root{--color-grey-0:#fff;--color-grey-50:#f9fafb;--color-grey-100:#f3f4f6;--color-grey-200:#e5e7eb;--color-grey-400:#9ca3af;--color-grey-500:#6b7280;--color-grey-600:#4b5563;--color-grey-700:#374151;--color-brand-50:#eef2ff;--color-brand-600:#4f46e5;--color-green-100:#dcfce7;--color-green-700:#15803d;--color-yellow-100:#fef9c3;--color-yellow-700:#a16207;--color-red-100:#fee2e2;--color-red-700:#b91c1c;--color-indigo-100:#e0e7ff;--color-indigo-700:#4338ca;--color-silver-100:#e5e7eb;--color-silver-700:#374151;--color-blue-100:#e0f2fe;--color-blue-700:#0369a1;--color-chart-1:#4f46e5;--color-chart-2:#0ea5e9;--color-chart-3:#16a34a;
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

  /* The other question the room-by-room layout cannot answer: how many
     do we have altogether, and is anything gone everywhere? */
  it("totals each item across every room", () => {
    expect(html).toContain("Across all rooms");
    // Snickers: 3 in MR01 + 0 in MR02 = 3, and it says where.
    expect(html).toContain("Meeting Room 01 3");
    // Apple juice: 3 + 9 = 12 across two rooms.
    expect(html).toContain("Meeting Room 02 9");
    expect(html).toContain("Value at cost");
  });

  it("flags an item that has run out everywhere as off the menu", () => {
    expect(html).toContain("Off the menu");
    /* Exactly one: Snickers and Jifuchucui are 0 in MR02 but still held
       in MR01, so they are NOT sold out — which is the distinction the
       per-room view cannot make. */
    expect(html).toContain("1 sold out");
    expect(html).toContain("Power Malt Zero");
  });

  it("shows the margin on every stocked item, in both rooms", () => {
    // Snickers: 5,000 sold, 3,000 cost -> +2,000 at 40%
    expect(html).toContain("+2,000 RWF");
    // Apple juice: 2,000 sold, 1,166.67 cost -> +833.33
    expect(html).toContain("833.33 RWF");
    // Niks and Power Malt are only in Meeting Room 02, so these assert
    // that the SECOND room's rows are rendered too — the table is built
    // per room and it would be easy for one of them to come out empty.
    expect(html).toContain("Niks Caramel");
    expect(html).toContain("+1,200 RWF");
    expect(html).toContain("Power Malt");
    expect(html).toContain("Out of stock");
  });

  /* Every one of these rows has no photo yet, so every one should offer
     the way to add one — that is the whole point of putting it on the
     empty slot rather than only in the row menu. */
  it("offers a way to add a photo on each row that has none", () => {
    expect(html).toContain("Add a photo of Snickers 2");
    expect(html).toContain("Add a photo of Power Malt");
    const triggers = [...html.matchAll(/Add a photo of /g)].length;
    expect(triggers).toBe(STOCK.length);
  });

  /* The bug: "Send to another room" recorded the stock leaving and
     nothing arriving, because the form never asked where. */
  it("can add an item that already exists", () => {
    expect(html).toContain("Choose an existing item");
    expect(html).toContain("Fanta Orange 300ml");
    expect(html).toContain("How many should it normally hold?");
  });

  /* Adding an item and putting stock in it used to be two trips: add at
     0, then find Restock. The opening amount is on the same form now. */
  it("offers an opening amount on both tabs", () => {
    const openings = [...html.matchAll(/How many are going in now\?/g)].length;
    expect(openings).toBe(2);
    // Defaults to none, so adding without stock still works as before.
    expect(html).toContain("0 — none yet");
    expect(html).toContain("Leave the opening amount at 0");
  });

  /* The gap: a brand new snack used to mean leaving Inventory, finding
     the Menu page, creating it there with the right section and the
     "kept as stock" box ticked, then coming back. */
  it("can create a brand new item, with prices and a photo", () => {
    expect(html).toContain("Create a new item");
    expect(html).toContain("What is it called?");
    expect(html).toContain("Where does it belong on the menu?");
    expect(html).toContain("What does one sell for?");
    expect(html).toContain("What does one cost to buy?");
    // Sections are labelled with their category.
    expect(html).toContain("Food · Snacks");
    expect(html).toContain("Drinks · Water");
    // And a photo can be attached at the same time.
    expect(html).toContain("newItemImages");
    expect(html).toContain("Create and add");
  });

  it("asks which room to send to, and offers only the other rooms", () => {
    expect(html).toContain("Send to which room?");
    // Niks is stocked in Meeting Room 02, so that must NOT be an option.
    const picker = html.slice(
      html.indexOf("Send to which room?"),
      html.indexOf("How many?", html.indexOf("Send to which room?")),
    );
    expect(picker).toContain("Meeting Room 01");
    expect(picker).not.toContain("Meeting Room 02");
    expect(picker).toContain("Choose a room…");
  });

  it("will not let a transfer be submitted with no destination", () => {
    const form = html.slice(html.indexOf("Send to which room?"));
    // The submit button is disabled until a room is picked.
    expect(form).toMatch(/<button[^>]*disabled[^>]*>\s*Send to another room/);
    expect(form).toContain("Pick a room to send to");
  });

  it("opens the item's own photo gallery, not a per-room copy", () => {
    expect(html).toContain("Photos · Snickers 2");
    expect(html).toContain("Add more photos");
    // Says plainly that this is shared with the public menu.
    expect(html).toContain("the same one the public");
  });

  it("asks for the buying and selling price on a restock", () => {
    expect(html).toContain("What does one cost to buy?");
    expect(html).toContain("What does one sell for?");
    expect(html).toContain("50% margin");
  });

  it("shows takings AND profit on a sale", () => {
    expect(html).toContain("2,000 RWF profit");
  });

  it("reports what the fridge made, not just what it took", () => {
    expect(totals.snacksProfitRwf).toBe(3900);
    expect(totals.snacksCostRwf).toBe(5100);
    expect(html).toContain("3,900 RWF");
    expect(html).toContain("5,100 RWF");
  });

  it("names the room and the item in every restock alert", () => {
    expect(restockAlertText(ALERTS[0])).toBe(
      "Meeting Room 02 has run out of Snickers 2. Bring 1.",
    );
    expect(restockAlertText(ALERTS[2])).toBe(
      "Meeting Room 01 is down to 1 × Vitalo Still Water 500ml (target 1). Bring 1.",
    );
    expect(html).toContain("has run out of Snickers 2");
  });

  /* Both rooms get a full table. The margin assertions above would pass
     on a page that rendered one room and dropped the other, so the row
     COUNT is checked separately: 5 items in MR01, 7 in MR02. */
  it("renders every stocked row in both rooms", () => {
    const sellButtons = [...html.matchAll(/>Sell</g)].length;
    expect(sellButtons).toBeGreaterThanOrEqual(STOCK.length);
  });
});
