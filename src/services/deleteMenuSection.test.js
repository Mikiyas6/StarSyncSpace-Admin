/* What "delete this section" says when it cannot.

   menu_items.section_id is `on delete restrict`, and an archived item
   is still a row in menu_items — so a section whose only remaining
   items are archived reads "0 items" on the screen (getMenuOverview
   filters archived rows out) and still cannot be deleted.

   The old guard counted every row and always answered "Move or delete
   its items first", which is an instruction the admin cannot follow:
   there is nothing left in the list to move. These are the three
   answers — one for live items, one for archived ones, and one for a
   refusal that came from somewhere else.

   supabase is mocked at the module boundary, so this runs offline and
   writes nothing.
*/

import { beforeEach, describe, expect, it, vi } from "vitest";

let deletedId = null;
let deletedFrom = null;

/* What the database will pretend to say. */
let deleteError = null;
let liveItems = [];
let archivedItems = [];
let itemsError = null;

vi.mock("./supabase", () => {
  const api = {
    from(table) {
      return {
        /* menu_items: select(...).eq("section_id").eq("is_archived").limit() */
        select() {
          const filters = {};
          const builder = {
            eq(column, value) {
              filters[column] = value;
              return builder;
            },
            limit() {
              if (itemsError) return Promise.resolve({ data: null, error: itemsError });
              const rows = filters.is_archived ? archivedItems : liveItems;
              return Promise.resolve({ data: rows, error: null });
            },
          };
          return builder;
        },
        delete() {
          return {
            eq(_column, value) {
              deletedFrom = table;
              deletedId = value;
              return Promise.resolve({ error: deleteError });
            },
          };
        },
      };
    },
  };

  return { default: api, supabaseUrl: "https://example.test" };
});

const { deleteMenuSection } = await import("./apiMenu");

/* Postgres' refusal, as PostgREST relays it.

   23001, not 23503: `on delete restrict` raises restrict_violation, and
   it is `on delete no action` that raises foreign_key_violation. The
   constraint here is RESTRICT, so this is the code that actually
   arrives — and a handler that knows only the famous one never runs. */
const restrictViolation = {
  code: "23001",
  message:
    'update or delete on table "menu_sections" violates RESTRICT setting of foreign key constraint "menu_items_section_id_fkey" on table "menu_items"',
};

/* The other one, in case a constraint is ever changed to NO ACTION. */
const noActionViolation = {
  code: "23503",
  message:
    'update or delete on table "menu_sections" violates foreign key constraint "menu_items_section_id_fkey" on table "menu_items"',
};

beforeEach(() => {
  deletedId = null;
  deletedFrom = null;
  deleteError = null;
  liveItems = [];
  archivedItems = [];
  itemsError = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("deleteMenuSection", () => {
  it("deletes a section nothing points at", async () => {
    await expect(deleteMenuSection(4)).resolves.toBeUndefined();

    expect(deletedFrom).toBe("menu_sections");
    expect(deletedId).toBe(4);
  });

  it("tells the admin to move the items when they are still live", async () => {
    deleteError = restrictViolation;
    liveItems = [{ id: 11 }];

    await expect(deleteMenuSection(4)).rejects.toThrow(
      "This section still has menu items. Move or delete its items first."
    );
  });

  /* The bug this test exists for: the screen shows the section as empty,
     because getMenuOverview hides archived items, and the old message
     asked for items the admin can no longer see or move. */
  it("explains the sales history when the only items left are archived", async () => {
    deleteError = restrictViolation;
    archivedItems = [{ id: 11 }];

    await expect(deleteMenuSection(4)).rejects.toThrow(
      /archived menu items, which are kept for their sales history/
    );
  });

  it("points at hiding the section, which is something the admin can do", async () => {
    deleteError = restrictViolation;
    archivedItems = [{ id: 11 }];

    await expect(deleteMenuSection(4)).rejects.toThrow(/Hide the section/);
  });

  /* Live items win the wording: those are the ones worth acting on. */
  it("asks for the live items first when the section holds both", async () => {
    deleteError = restrictViolation;
    liveItems = [{ id: 11 }];
    archivedItems = [{ id: 12 }];

    await expect(deleteMenuSection(4)).rejects.toThrow(
      "This section still has menu items. Move or delete its items first."
    );
  });

  /* A table nobody thought of, or counts that cannot be read: do not
     invent a reason the admin would act on. */
  it("does not blame menu items when no item is blocking it", async () => {
    deleteError = restrictViolation;

    await expect(deleteMenuSection(4)).rejects.toThrow(
      "This section is still in use somewhere and cannot be deleted."
    );
  });

  it("does not blame menu items when the counts cannot be read", async () => {
    deleteError = restrictViolation;
    itemsError = { code: "42501", message: "permission denied" };

    await expect(deleteMenuSection(4)).rejects.toThrow(
      "This section is still in use somewhere and cannot be deleted."
    );
  });

  it("reads a NO ACTION refusal the same way", async () => {
    deleteError = noActionViolation;
    archivedItems = [{ id: 11 }];

    await expect(deleteMenuSection(4)).rejects.toThrow(
      /archived menu items, which are kept for their sales history/
    );
  });

  it("still fails loudly on an error that is not a foreign key", async () => {
    deleteError = { code: "42501", message: "permission denied" };

    await expect(deleteMenuSection(4)).rejects.toThrow(
      "Section could not be deleted"
    );
    // and the real cause reaches the console rather than being swallowed
    expect(console.error).toHaveBeenCalledWith(deleteError);
  });
});
