/* The rows a removed item leaves behind in the rooms.

   room_stock.menu_item_id is `on delete cascade`, so a real DELETE
   takes the room rows with it. An ARCHIVE does not — and archiving is
   what happens to any item that has ever traded, because
   stock_movements holds the row with `on delete restrict`.

   So every item removed from the menu that had sales history kept a row
   in each room that had carried it: the Menu screen hid it, the
   customer menu hid it, and the Inventory screen listed it in each room
   at 0 with a working Restock button — which put stock into a room for
   something nothing would ever show again. That is the fault this
   covers, from both ends: supabase/18 clears the rows and stops new
   ones being made, and getInventory() drops them so the screen is right
   on a database where 18 has not been run yet.

   supabase is mocked at the module boundary, so this runs offline and
   writes nothing.
*/

import { beforeEach, describe, expect, it, vi } from "vitest";

let stockRows = [];
let stockError = null;
let rpcCalls = [];
let rpcError = null;

vi.mock("./supabase", () => {
  const api = {
    from() {
      return {
        select() {
          return {
            order: async () => ({ data: stockRows, error: stockError }),
          };
        },
      };
    },
    async rpc(name, args) {
      rpcCalls.push({ name, args });
      return rpcError ? { data: null, error: rpcError } : { data: true, error: null };
    },
  };
  return { default: api, supabaseUrl: "https://example.test" };
});

const { getInventory, removeItemFromRoom } = await import("./apiInventory");

function row({ id, name, quantity, isArchived = false }) {
  return {
    id,
    room_id: 1,
    menu_item_id: id,
    quantity,
    par_level: 0,
    updated_at: null,
    rooms: { id: 1, name: "Meeting Room 01", room_type: "meeting_room" },
    menu_items: {
      id,
      name,
      price: 1000,
      cost_rwf: 500,
      currency: "RWF",
      is_available: true,
      is_archived: isArchived,
      section_id: 1,
      menu_sections: null,
      menu_item_images: [],
    },
  };
}

beforeEach(() => {
  stockRows = [];
  stockError = null;
  rpcCalls = [];
  rpcError = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getInventory", () => {
  it("drops an archived item a room has run down to zero", async () => {
    stockRows = [
      row({ id: 1, name: "Vitalo", quantity: 4 }),
      row({ id: 2, name: "Removed snack", quantity: 0, isArchived: true }),
    ];

    const names = (await getInventory()).map((r) => r.name);

    expect(names).toEqual(["Vitalo"]);
  });

  /* A live item at zero is a restock job, not a ghost: it stays. */
  it("keeps a live item that is simply out of stock", async () => {
    stockRows = [row({ id: 1, name: "Vitalo", quantity: 0 })];

    expect(await getInventory()).toHaveLength(1);
  });

  /* Stock of something the business no longer sells is a real
     discrepancy. Hiding it would leave somebody holding units the
     system had forgotten about. */
  it("keeps an archived item a room still holds stock of", async () => {
    stockRows = [row({ id: 2, name: "Removed snack", quantity: 6, isArchived: true })];

    const [only] = await getInventory();

    expect(only.name).toBe("Removed snack");
    expect(only.isArchived).toBe(true);
    expect(only.quantity).toBe(6);
  });
});

describe("removeItemFromRoom", () => {
  /* It used to delete from room_stock over PostgREST, which cannot
     work: that table has no delete policy and `authenticated` is
     granted select on it and nothing else. */
  it("goes through the function, because the table refuses a direct delete", async () => {
    await removeItemFromRoom({ roomId: 1, menuItemId: 2, quantity: 0 });

    expect(rpcCalls).toEqual([
      { name: "remove_item_from_room", args: { p_room_id: 1, p_menu_item_id: 2 } },
    ]);
  });

  it("refuses on the spot while the room still holds stock", async () => {
    await expect(
      removeItemFromRoom({ roomId: 1, menuItemId: 2, quantity: 3 }),
    ).rejects.toThrow("There are still 3 in this room");

    // Not even attempted: the count is already on screen.
    expect(rpcCalls).toEqual([]);
  });

  it("passes on the database's own count when it disagrees", async () => {
    rpcError = {
      code: "P0003",
      message:
        "There are still 2 Snickers in this room. Record them as sold, removed or written off first — then this item can be taken off the list.",
    };

    await expect(
      removeItemFromRoom({ roomId: 1, menuItemId: 2, quantity: 0 }),
    ).rejects.toThrow("There are still 2 Snickers in this room");
  });

  it("names the migration when the function is not there yet", async () => {
    rpcError = { code: "42883", message: "function does not exist" };

    await expect(
      removeItemFromRoom({ roomId: 1, menuItemId: 2, quantity: 0 }),
    ).rejects.toThrow("18-remove-or-hide-a-menu-item.sql");
  });
});
