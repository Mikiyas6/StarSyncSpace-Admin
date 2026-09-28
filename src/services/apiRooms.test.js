/* What createEditRoom writes, and what it says when the write fails.

   Two things had gone wrong here and both were invisible from the
   screen. The edit form is seeded with the whole room row, so every
   column it was given came back on submit and went into the UPDATE —
   including `id` and `created_at`, which a save has no business
   rewriting. And every failure, on both paths, was reported as the one
   sentence "Room could not be created", which is wrong about the
   operation on an edit and says nothing about the cause — least of all
   the commonest one, a row-level-security policy letting the statement
   match zero rows.

   supabase is mocked at the module boundary, so this runs offline and
   writes nothing.
*/

import { beforeEach, describe, expect, it, vi } from "vitest";

/* Captured from the last call, for inspection. */
let inserted = null;
let updated = null;
let updatedId = null;
let deleted = null;
let uploaded = null;

/* What the database will pretend to say. */
let writeResult = { data: { id: 7 }, error: null };
let uploadError = null;

vi.mock("./supabase", () => {
  const result = () => ({
    select: () => ({ maybeSingle: async () => writeResult }),
  });

  const api = {
    from() {
      return {
        insert(rows) {
          inserted = rows[0];
          return result();
        },
        update(row) {
          updated = row;
          return {
            eq(_column, value) {
              updatedId = value;
              return result();
            },
          };
        },
        delete() {
          return {
            eq(_column, value) {
              deleted = value;
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
    storage: {
      from() {
        return {
          async upload(name, file) {
            uploaded = { name, file };
            return { error: uploadError };
          },
        };
      },
    },
  };

  return { default: api, supabaseUrl: "https://example.test" };
});

const { createEditRoom } = await import("./apiRooms");

const EXISTING_IMAGE =
  "https://example.test/storage/v1/object/public/room-images/old.jpg";

/* A room row exactly as the edit form hands it back: every column the
   table has, because that is what it was seeded with. */
function editedRoom(overrides = {}) {
  return {
    created_at: "2026-08-19T13:51:02.775424+00:00",
    name: "Shared Space 01",
    maxCapacity: "20",
    regularPrice: 0,
    discount: 0,
    description: "Twenty desks in the middle of Kigali.",
    image: EXISTING_IMAGE,
    discount_valid_from: null,
    discount_valid_until: null,
    room_type: "shared_space",
    day_rate_rwf: "30000",
    month_rate_usd: "100",
    is_archived: false,
    hour_rate_rwf: "5000",
    ...overrides,
  };
}

beforeEach(() => {
  inserted = null;
  updated = null;
  updatedId = null;
  deleted = null;
  uploaded = null;
  writeResult = { data: { id: 320 }, error: null };
  uploadError = null;
});

describe("createEditRoom · the payload", () => {
  it("never writes id or created_at back, however it was seeded", async () => {
    await createEditRoom(editedRoom({ id: 320 }), 320);

    expect(updated).not.toHaveProperty("id");
    expect(updated).not.toHaveProperty("created_at");
    expect(updatedId).toBe(320);
  });

  it("turns the form's number strings into numbers", async () => {
    await createEditRoom(editedRoom(), 320);

    expect(updated.maxCapacity).toBe(20);
    expect(updated.day_rate_rwf).toBe(30000);
    expect(updated.month_rate_usd).toBe(100);
    expect(updated.hour_rate_rwf).toBe(5000);
  });

  it("sends an untouched number box as null, not as an empty string", async () => {
    await createEditRoom(editedRoom({ hour_rate_rwf: "" }), 320);

    expect(updated.hour_rate_rwf).toBeNull();
  });

  it("keeps the photo a room already has when no new one was picked", async () => {
    await createEditRoom(editedRoom(), 320);

    expect(updated.image).toBe(EXISTING_IMAGE);
    expect(uploaded).toBeNull();
  });

  it("uploads and points at the new photo when one was", async () => {
    const file = { name: "new.jpg" };
    await createEditRoom(editedRoom({ image: file }), 320);

    expect(updated.image).toMatch(/room-images\/.+-new\.jpg$/);
    expect(uploaded.file).toBe(file);
  });

  it("drops a column the rooms table does not have", async () => {
    await createEditRoom(editedRoom({ somethingRemoved: "ignore me" }), 320);

    expect(updated).not.toHaveProperty("somethingRemoved");
  });
});

describe("createEditRoom · what it says when it fails", () => {
  it("says the change was refused, not that a room could not be CREATED", async () => {
    writeResult = { data: null, error: null };

    await expect(createEditRoom(editedRoom(), 320)).rejects.toThrow(
      /admin-only/i,
    );
    await expect(createEditRoom(editedRoom(), 320)).rejects.not.toThrow(
      /could not be created/i,
    );
  });

  it("names row-level security when the database refuses outright", async () => {
    writeResult = {
      data: null,
      error: { code: "42501", message: "new row violates row-level security" },
    };

    await expect(createEditRoom(editedRoom(), 320)).rejects.toThrow(
      /not an admin/i,
    );
  });

  it("points at the migrations when a column is missing", async () => {
    writeResult = {
      data: null,
      error: { code: "PGRST204", message: "column 'hour_rate_rwf' not found" },
    };

    await expect(createEditRoom(editedRoom(), 320)).rejects.toThrow(
      /supabase\//,
    );
  });

  it("repeats the database's own words for anything else", async () => {
    writeResult = {
      data: null,
      error: { code: "23514", message: "rooms_rates_non_negative violated" },
    };

    await expect(createEditRoom(editedRoom(), 320)).rejects.toThrow(
      /rooms_rates_non_negative/,
    );
  });

  /* A failed photo upload used to delete the row it had just written —
     correct for a room that did not exist a moment ago, catastrophic for
     one that did, since it takes every booking that references it. */
  it("does not delete an existing room when its new photo fails to upload", async () => {
    uploadError = { message: "bucket unavailable" };

    await expect(
      createEditRoom(editedRoom({ image: { name: "new.jpg" } }), 320),
    ).rejects.toThrow(/the room was saved/i);

    expect(deleted).toBeNull();
  });

  it("still rolls back a brand-new room whose photo fails to upload", async () => {
    uploadError = { message: "bucket unavailable" };
    writeResult = { data: { id: 999 }, error: null };

    await expect(
      createEditRoom(
        { name: "Meeting Room 03", image: { name: "new.jpg" } },
        undefined,
      ),
    ).rejects.toThrow(/could not be uploaded/i);

    expect(deleted).toBe(999);
    expect(inserted.name).toBe("Meeting Room 03");
  });
});
