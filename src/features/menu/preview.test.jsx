/* The three states a menu item can be in, as the row actually draws
   them.

   Same arrangement as the inventory preview — renderToStaticMarkup with
   the hooks mocked — because the admin's login cannot be passed in a
   test, and the point is that the difference between the three can be
   LOOKED at rather than only asserted about. They are easy to confuse
   and were being confused: Delete kept getting used for "take this off
   the menu for now", which archived items that had traded and left them
   in every room's stock list at 0.

     Available   on the customer menu, orderable.
     Sold out    on the customer menu, greyed. "None today."
     Hidden      not on the customer menu at all, and still here.

   The row menu is a portal that renders nothing until it is opened, so
   the actions inside it cannot appear in static markup — the dialog is
   rendered on its own below for the same reason.
*/

/* eslint-env node */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServerStyleSheet, ThemeProvider } from "styled-components";

const ITEMS = [
  {
    id: 101,
    section_id: 7,
    name: "Vitalo Still Water 500ml",
    price: 1000,
    currency: "RWF",
    is_available: true,
    is_featured: false,
    is_hidden: false,
    updated_at: "2026-09-25T21:50:00Z",
  },
  {
    id: 102,
    section_id: 7,
    name: "Snickers 2",
    price: 5000,
    currency: "RWF",
    is_available: false,
    is_featured: true,
    is_hidden: false,
    updated_at: "2026-09-25T21:50:00Z",
  },
  {
    id: 103,
    section_id: 4,
    name: "Power Malt Zero",
    price: 5000,
    currency: "RWF",
    /* Deliberately available AND hidden — the state that proves which
       flag the row believes. An item nobody can see is not also
       "Available", and before this the row said it was. */
    is_available: true,
    is_featured: false,
    is_hidden: true,
    updated_at: "2026-09-25T21:50:00Z",
  },
];

vi.mock("./useMenuOverview", () => ({
  menuQueryKey: ["menuOverview"],
  useMenuOverview: () => ({ data: { images: [] }, isLoading: false }),
}));

vi.mock("./useDeleteMenuItem", () => ({
  useDeleteMenuItem: () => ({ deleteMenuItem: () => {}, isDeleting: false }),
}));

vi.mock("./useDuplicateMenuItem", () => ({
  useDuplicateMenuItem: () => ({
    duplicateMenuItem: () => {},
    isDuplicating: false,
  }),
}));

vi.mock("./useToggleMenuItemFlag", () => ({
  useToggleMenuItemFlag: () => ({ toggleFlag: () => {}, isToggling: false }),
}));

import MenuRow from "./MenuRow";
import Table from "../../ui/Table";
import Menus from "../../ui/Menus";
import ConfirmDelete from "../../ui/ConfirmDelete";

const COLUMNS = "6rem 1.8fr 1fr 1fr 1.4fr 1fr 3.2rem";

/* The dialog MenuRow opens, with the props MenuRow passes it. It is a
   portal behind a click, so this is the only way it reaches the page —
   and the wording is the part worth reading: it is where somebody finds
   out that Hide is what they wanted. */
function RemoveDialog() {
  const name = "Snickers 2";
  return (
    <ConfirmDelete
      resourceName={`"${name}"`}
      title={`Remove "${name}"`}
      description={`Take "${name}" off the menu for good and out of every room's stock list? Its sales history is kept either way. Any room that still holds stock of it has to be cleared first. To take it off the customer menu and keep everything as it is, close this and choose "Hide from menu".`}
      confirmLabel="Remove"
      disabled={false}
      onConfirm={() => {}}
    />
  );
}

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

describe("menu preview", () => {
  let html = "";

  beforeAll(() => {
    const rendered = renderAll([
      {
        title: "Menu rows — available, sold out, hidden",
        node: (
          <Menus>
            <Table columns={COLUMNS}>
              <Table.Header>
                <div></div>
                <div>Item</div>
                <div>Section</div>
                <div>Price</div>
                <div>Status</div>
                <div>Updated</div>
                <div></div>
              </Table.Header>
              {ITEMS.map((item) => (
                <MenuRow
                  key={item.id}
                  item={item}
                  sectionName={item.section_id === 4 ? "Snacks" : "Water"}
                />
              ))}
            </Table>
          </Menus>
        ),
      },
      {
        title: "Remove — what it says it will do",
        node: <RemoveDialog />,
      },
    ]);

    html = rendered.html;

    /* Opt-in picture, same as the inventory preview:

         PREVIEW_OUT=public/preview-menu.html npx vitest run \
           src/features/menu/preview.test.jsx
    */
    if (!process.env.PREVIEW_OUT) return;

    const out = resolve(process.env.PREVIEW_OUT);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(
      out,
      `<!doctype html><meta charset="utf-8"><title>Menu preview</title>
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

  it("marks a hidden item Hidden", () => {
    expect(html).toContain("Hidden");
    expect(html).toContain("Power Malt Zero");
  });

  /* The whole point of the badge: three items, three different words,
     and the hidden one does not also claim to be on the menu. */
  it("does not also call a hidden item Available", () => {
    const available = [...html.matchAll(/>Available</g)].length;
    const soldOut = [...html.matchAll(/>Sold out</g)].length;
    const hidden = [...html.matchAll(/>Hidden</g)].length;

    expect(available).toBe(1); // only Vitalo
    expect(soldOut).toBe(1); // only Snickers
    expect(hidden).toBe(1); // only Power Malt Zero
  });

  it("still shows the other flags beside it", () => {
    expect(html).toContain("Featured");
    expect(html).toContain("Vitalo Still Water 500ml");
    expect(html).toContain("Snacks");
    expect(html).toContain("Water");
  });

  /* The dialog is where somebody learns that Remove is not what they
     wanted. It has to say both halves: that the rooms are cleared, and
     that Hide exists. */
  it("says what Remove does to the rooms, and offers Hide instead", () => {
    expect(html).toContain("out of every room&#x27;s stock list");
    expect(html).toContain("has to be cleared first");
    expect(html).toContain("Hide from menu");
    expect(html).toContain("sales history is kept either way");
  });
});
