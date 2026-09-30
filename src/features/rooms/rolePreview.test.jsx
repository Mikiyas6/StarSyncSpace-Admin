/* What a staff member sees on the two catalogue pages.

   Both used to be wrapped in RequireAdmin, so staff got "Rooms is for
   admins" instead of the list — which was the wrong answer to the wrong
   question. Reading a price list and setting a price are different
   permissions, and the desk needs the first one to work: which rooms
   exist, what is free at four, what the kitchen serves.

   So the pages are open and the controls inside are gated. That gate is
   what this file checks, on the two rows that carry it.

   The action MENUS are portals that render nothing until clicked, so
   they cannot appear in static markup — but the toggle that opens them
   can, and the toggle is the thing being gated. Its absence is the
   assertion: no toggle, no menu, nothing to open.
*/

/* eslint-env node */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServerStyleSheet, ThemeProvider } from "styled-components";

/* Hoisted so the vi.mock factory below can close over it, and mutable so
   the same file can render the page as both people. */
const state = vi.hoisted(() => ({ isAdmin: true }));

vi.mock("../authentication/useAdminRole", () => ({
  useAdminRole: () => ({
    isAdmin: state.isAdmin,
    role: state.isAdmin ? "admin" : "staff",
    isLoading: false,
    can: {
      manageRooms: state.isAdmin,
      manageMenu: state.isAdmin,
      manageStock: state.isAdmin,
      viewRooms: true,
      viewMenu: true,
    },
  }),
}));

vi.mock("./useDeleteRoom", () => ({
  useDeleteRoom: () => ({ deleteRoom: () => {}, isDeleting: false }),
}));
vi.mock("./useCreateRoom", () => ({
  useCreateRoom: () => ({ createRoom: () => {}, isCreating: false }),
}));
vi.mock("../menu/useMenuOverview", () => ({
  menuQueryKey: ["menuOverview"],
  useMenuOverview: () => ({ data: { images: [] }, isLoading: false }),
}));
vi.mock("../menu/useDeleteMenuItem", () => ({
  useDeleteMenuItem: () => ({ deleteMenuItem: () => {}, isDeleting: false }),
}));
vi.mock("../menu/useDuplicateMenuItem", () => ({
  useDuplicateMenuItem: () => ({
    duplicateMenuItem: () => {},
    isDuplicating: false,
  }),
}));
vi.mock("../menu/useToggleMenuItemFlag", () => ({
  useToggleMenuItemFlag: () => ({ toggleFlag: () => {}, isToggling: false }),
}));

import RoomRow from "./RoomRow";
import MenuRow from "../menu/MenuRow";
import Table from "../../ui/Table";
import Menus from "../../ui/Menus";

const ROOM = {
  id: 310,
  name: "310",
  maxCapacity: 8,
  // Francs an hour, which is what the column means since migration 21.
  hour_rate_rwf: 12000,
  discount: 0,
  description: "A meeting room",
  image: "",
};

const ITEM = {
  id: 101,
  section_id: 7,
  name: "Vitalo Still Water 500ml",
  price: 1000,
  currency: "RWF",
  is_available: true,
  is_featured: false,
  is_hidden: false,
  updated_at: "2026-09-25T21:50:00Z",
};

function render() {
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
              <Menus>
                <section>
                  <h2 className="t">Rooms</h2>
                  {/* Same template RoomTable uses, or the action cell
                      lands in the wrong column and the picture lies. */}
                  <Table columns="8.8rem 2.6fr 1.3fr 1.2fr 0.8fr 3.2rem">
                    <Table.Header>
                      <div></div>
                      <div>Room</div>
                      <div>Capacity</div>
                      <div>Price</div>
                      <div>Discount</div>
                      <div></div>
                    </Table.Header>
                    <RoomRow room={ROOM} />
                  </Table>
                </section>
                <section>
                  <h2 className="t">Menu</h2>
                  <Table columns="6rem 1.8fr 1fr 1fr 1.4fr 1fr 3.2rem">
                    <Table.Header>
                      <div></div>
                      <div>Item</div>
                      <div>Section</div>
                      <div>Price</div>
                      <div>Status</div>
                      <div>Updated</div>
                      <div></div>
                    </Table.Header>
                    <MenuRow item={ITEM} sectionName="Water" />
                  </Table>
                </section>
              </Menus>
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

/* Menus.Toggle is the only <button> either row renders into static
   markup, so counting them counts the action menus on the page. */
function toggleCount(html) {
  return [...html.matchAll(/<button/g)].length;
}

describe("what staff see on the catalogue pages", () => {
  let asAdmin = "";
  let asStaff = "";

  beforeAll(() => {
    state.isAdmin = true;
    const admin = render();
    asAdmin = admin.html;

    state.isAdmin = false;
    const staff = render();
    asStaff = staff.html;

    /* Opt-in picture, same as the other previews:

         PREVIEW_OUT=public/preview-roles.html npx vitest run \
           src/features/rooms/rolePreview.test.jsx
    */
    if (!process.env.PREVIEW_OUT) return;

    const out = resolve(process.env.PREVIEW_OUT);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(
      out,
      `<!doctype html><meta charset="utf-8"><title>Roles preview</title>
${admin.css}
<style>
  :root{--color-grey-0:#fff;--color-grey-50:#f9fafb;--color-grey-100:#f3f4f6;--color-grey-200:#e5e7eb;--color-grey-300:#d1d5db;--color-grey-400:#9ca3af;--color-grey-500:#6b7280;--color-grey-600:#4b5563;--color-grey-700:#374151;--color-grey-800:#1f2937;--color-brand-50:#eef2ff;--color-brand-100:#e0e7ff;--color-brand-600:#4f46e5;--color-brand-700:#4338ca;--color-green-100:#dcfce7;--color-green-700:#15803d;--color-blue-100:#e0f2fe;--color-blue-700:#0369a1;--color-yellow-100:#fef9c3;--color-yellow-700:#a16207;--color-red-100:#fee2e2;--color-red-700:#b91c1c;--color-red-800:#991b1b;--color-silver-100:#e5e7eb;--color-silver-700:#374151;--color-coral-100:#ffe4df;--color-coral-700:#c23a28;
    --border-radius-sm:5px;--border-radius-md:7px;--border-radius-lg:9px;
    --shadow-sm:0 1px 2px rgba(0,0,0,.04);--shadow-md:0 .6rem 2.4rem rgba(0,0,0,.06);--shadow-lg:0 2.4rem 3.2rem rgba(0,0,0,.12);
    --backdrop-color:rgba(255,255,255,.1);--image-grayscale:0;--image-opacity:100%;}
  html{font-size:62.5%}
  body{font-family:system-ui,sans-serif;font-size:1.6rem;background:#f3f4f6;color:var(--color-grey-700);margin:0;padding:2.4rem}
  section{background:var(--color-grey-0);border-radius:9px;margin:0 0 1.6rem;overflow:hidden;box-shadow:var(--shadow-md)}
  .t{font:600 1.4rem/1 system-ui;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;background:#f9fafb;margin:0;padding:1.4rem 2.4rem;border-bottom:1px solid #e5e7eb}
  .who{font:700 1.6rem/1 system-ui;margin:0 0 1.2rem;color:#374151}
</style>
<body>
  <p class="who">As an admin</p>${asAdmin}
  <p class="who">As staff</p>${asStaff}
</body>`,
    );
    console.log("PREVIEW:", out);
  });

  it("shows both rows to staff, with their contents", () => {
    expect(asStaff).toContain("310");
    expect(asStaff).toContain("Vitalo Still Water 500ml");
    expect(asStaff).toContain("Water");
    expect(asStaff).toContain("Available");
  });

  it("gives an admin an action menu on each row", () => {
    expect(toggleCount(asAdmin)).toBe(2);
  });

  /* The change. No toggle means no menu: no Edit, Delete, Duplicate,
     Manage images or Hide, on either catalogue. */
  it("gives staff no action menu on either row", () => {
    expect(toggleCount(asStaff)).toBe(0);
  });

  it("keeps the price on screen for staff — reading is the point", () => {
    expect(asStaff).toContain("12,000 RWF/hr");
    expect(asStaff).toContain("200 RWF/min");
    expect(asStaff).toContain("1,000");
  });

  /* The room table used to print "$12,000.00/hr" off the retired USD
     column, and a per-minute figure converted with a rate hardcoded in
     2025. Neither dollar sign belongs on this screen any more. */
  it("quotes the room in francs, with no dollar figure", () => {
    expect(asStaff).not.toMatch(/\$\s?\d/);
    expect(asAdmin).not.toMatch(/\$\s?\d/);
  });
});
