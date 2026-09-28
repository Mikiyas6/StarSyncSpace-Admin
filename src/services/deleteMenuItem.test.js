/* What "remove this menu item" actually does.

   Three outcomes, decided by the database inside one transaction
   (`remove_menu_item`, supabase/18):

     refused   a room still holds stock. Stock on a shelf must not
               vanish from the records with no line saying where it
               went, so the count has to be dealt with first.
     deleted   nothing ever referenced it — the row goes, and its
               room_stock and image rows go with it by cascade.
     archived  it has traded. stock_movements.menu_item_id is `on delete
               restrict`, so the row stays with is_archived set and the
               sales history survives.

   Either way it leaves every room's stock list, which is the bug this
   replaced: the old version set is_archived from here and never touched
   room_stock, so a removed snack went on showing in each room at 0 with
   a Restock button that worked.

   supabase is mocked at the module boundary, so this runs offline and
   writes nothing.
*/

import { beforeEach, describe, expect, it, vi } from "vitest";

let rpcCalls = [];
let updates = [];
let removedFromStorage = [];

/* What the database will pretend to say. */
let images = [];
let imagesError = null;
let rpcResult = "deleted";
let rpcError = null;
let updateError = null;

vi.mock("./supabase", () => {
  const api = {
    async rpc(name, args) {
      rpcCalls.push({ name, args });
      if (rpcError) return { data: null, error: rpcError };
      return { data: rpcResult, error: null };
    },
    from(table) {
      return {
        select() {
          return {
            eq: async () =>
              table === "menu_item_images"
                ? { data: images, error: imagesError }
                : { data: [], error: null },
          };
        },
        update(row) {
          updates.push(row);
          return {
            eq() {
              return {
                select() {
                  return {
                    single: async () =>
                      updateError
                        ? { data: null, error: updateError }
                        : { data: { id: 57, ...row }, error: null },
                  };
                },
              };
            },
          };
        },
      };
    },
    storage: {
      from() {
        return {
          async remove(names) {
            removedFromStorage.push(...names);
            return { error: null };
          },
        };
      },
    },
  };

  return { default: api, supabaseUrl: "https://example.test" };
});

const { deleteMenuItem, setMenuItemHidden } = await import("./apiMenu");

const PHOTO =
  "https://example.test/storage/v1/object/public/menu-images/snickers.jpg";

beforeEach(() => {
  rpcCalls = [];
  updates = [];
  removedFromStorage = [];
  images = [];
  imagesError = null;
  rpcResult = "deleted";
  rpcError = null;
  updateError = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("deleteMenuItem", () => {
  it("asks the database to do the whole thing, rather than doing it here", async () => {
    await deleteMenuItem(57);

    expect(rpcCalls).toEqual([
      { name: "remove_menu_item", args: { p_menu_item_id: 57 } },
    ]);
    // Nothing is archived from the browser any more: that is the step
    // that used to leave room_stock behind.
    expect(updates).toEqual([]);
  });

  it("deletes outright an item nothing has ever referenced", async () => {
    images = [{ url: PHOTO }];
    rpcResult = "deleted";

    expect(await deleteMenuItem(57)).toEqual({ archived: false });
    // Nothing points at the photographs any more.
    expect(removedFromStorage).toEqual(["snickers.jpg"]);
  });

  it("archives an item whose sales history blocks the delete", async () => {
    rpcResult = "archived";

    expect(await deleteMenuItem(57)).toEqual({ archived: true });
  });

  /* The archived row still points at them. */
  it("leaves the photographs alone when the item is only archived", async () => {
    images = [{ url: PHOTO }];
    rpcResult = "archived";

    await deleteMenuItem(57);

    expect(removedFromStorage).toEqual([]);
  });

  /* The bug the user hit: an item deleted at the menu went on appearing
     in every room. The function clears room_stock in the same
     transaction, so there is nothing for this layer to do — but it must
     not report success for a refusal. */
  it("refuses in the item's own words while a room still holds stock", async () => {
    rpcError = {
      code: "P0003",
      message:
        "Snickers is not empty: 4 left in 1 room(s). Sell, remove or write off the stock first, or hide the item instead.",
    };

    await expect(deleteMenuItem(57)).rejects.toThrow(
      "Snickers is not empty: 4 left in 1 room(s)."
    );
    expect(removedFromStorage).toEqual([]);
  });

  it("passes on the database's refusal for a member of staff", async () => {
    rpcError = { code: "42501", message: "Only an admin can remove a menu item" };

    await expect(deleteMenuItem(57)).rejects.toThrow(
      "Only an admin can remove a menu item"
    );
  });

  it("passes on an item somebody else already removed", async () => {
    rpcError = {
      code: "P0002",
      message: "That item no longer exists. Reload and try again.",
    };

    await expect(deleteMenuItem(57)).rejects.toThrow("Reload and try again");
  });

  /* Without this the screen says "could not be removed" and the reason —
     one unrun migration — is nowhere. */
  it("names the migration when the function is not there yet", async () => {
    rpcError = { code: "42883", message: "function remove_menu_item does not exist" };

    await expect(deleteMenuItem(57)).rejects.toThrow(
      "18-remove-or-hide-a-menu-item.sql"
    );
  });

  it("names the migration when PostgREST cannot see the function", async () => {
    rpcError = { code: "PGRST202", message: "Could not find the function" };

    await expect(deleteMenuItem(57)).rejects.toThrow(
      "18-remove-or-hide-a-menu-item.sql"
    );
  });

  it("still fails loudly on anything else", async () => {
    rpcError = { code: "08006", message: "connection failure" };

    await expect(deleteMenuItem(57)).rejects.toThrow(
      "Menu item could not be removed"
    );
    // and the real cause reaches the console rather than being swallowed
    expect(console.error).toHaveBeenCalled();
  });

  it("does not remove anything when the photographs cannot be read", async () => {
    imagesError = { code: "42501", message: "permission denied" };

    await expect(deleteMenuItem(57)).rejects.toThrow(
      "Menu item could not be removed"
    );
    expect(rpcCalls).toEqual([]);
  });
});

/* The third state, and the one Delete kept being used for. */
describe("setMenuItemHidden", () => {
  it("hides an item without touching anything else about it", async () => {
    await setMenuItemHidden(57, true);

    expect(updates).toEqual([{ is_hidden: true }]);
    expect(rpcCalls).toEqual([]);
  });

  it("puts it back", async () => {
    await setMenuItemHidden(57, false);

    expect(updates).toEqual([{ is_hidden: false }]);
  });

  it("names the migration when the column is not there yet", async () => {
    updateError = { code: "42703", message: 'column "is_hidden" does not exist' };

    await expect(setMenuItemHidden(57, true)).rejects.toThrow(
      "18-remove-or-hide-a-menu-item.sql"
    );
  });
});
