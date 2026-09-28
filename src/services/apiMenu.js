// Menu domain service: menu_categories, menu_sections, menu_items and
// menu_item_images, plus the `menu-images` storage bucket.
import supabase, { supabaseUrl } from "./supabase";

export const MENU_IMAGES_BUCKET = "menu-images";

export function getMenuStoragePath(imageName) {
  return `${supabaseUrl}/storage/v1/object/public/${MENU_IMAGES_BUCKET}/${imageName}`;
}

function imageNameFrom(url) {
  const prefix = `${supabaseUrl}/storage/v1/object/public/${MENU_IMAGES_BUCKET}/`;
  if (!url || !url.startsWith(prefix)) return null;
  return decodeURIComponent(url.slice(prefix.length));
}

// ---------------------------------------------------------------------------
// Overview — everything needed to render the menu management screens
// ---------------------------------------------------------------------------

export async function getMenuOverview() {
  const queries = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, name, description, sort_order, is_active")
      .order("sort_order"),
    supabase
      .from("menu_sections")
      .select(
        "id, category_id, name, description, sort_order, is_active"
      )
      .order("sort_order"),
    /* Archived items are gone for good — hidden everywhere, history
       kept (03-inventory.sql). Leaving them in this list would make a
       "remove" that fell back to archiving look like it did nothing. */
    supabase
      .from("menu_items")
      .select("*")
      .eq("is_archived", false)
      .order("sort_order"),
    supabase
      .from("menu_item_images")
      .select("id, menu_item_id, url, alt_text, sort_order, is_primary")
      .order("sort_order"),
  ]);

  const missingTable = queries.some(
    ({ error }) => error?.code === "42P01"
  );
  if (missingTable) {
    throw new Error(
      "The menu tables do not exist yet. Run setup_menu_table.sql in the Supabase SQL editor, then reload."
    );
  }

  for (const { error } of queries) {
    if (error) {
      console.error(error);
      throw new Error("Menu data could not be loaded");
    }
  }

  const [categories, sections, items, images] = queries.map(
    ({ data }) => data
  );

  return { categories, sections, items, images };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function ensureMenuCategories() {
  const { data: existing, error: countError } = await supabase
    .from("menu_categories")
    .select("id")
    .limit(1);

  if (countError) throw new Error("Categories could not be loaded");

  if (existing.length > 0) return { seeded: false };

  const { error } = await supabase.from("menu_categories").insert([
    { name: "Food", description: "Freshly prepared meals", sort_order: 1 },
    { name: "Drinks", description: "Beverages and more", sort_order: 2 },
  ]);

  if (error) throw new Error("Categories could not be created");
  return { seeded: true };
}

// ---------------------------------------------------------------------------
// Menu items
// ---------------------------------------------------------------------------

export async function createMenuItem(newItem) {
  const { data, error } = await supabase
    .from("menu_items")
    .insert([newItem])
    .select()
    .single();

  if (error) {
    console.error(error);
    throw new Error("Menu item could not be created");
  }
  return data;
}

export async function updateMenuItem(id, updates) {
  const { data, error } = await supabase
    .from("menu_items")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error(error);
    /* 42703: a column in `updates` does not exist. The only one that
       can be missing on a working database is `is_hidden`, and a bare
       "could not be updated" for it sends somebody looking at the item
       rather than at the migration. */
    if (error.code === "42703" && "is_hidden" in updates)
      throw new Error(MIGRATION_18_MESSAGE);
    throw new Error("Menu item could not be updated");
  }
  return data;
}

/* Postgres: the row is referenced by another table, so it will not go.

   TWO codes, and the second is the one that fires for the constraints
   in this schema. `on delete restrict` raises restrict_violation
   (23001); `on delete no action` raises foreign_key_violation (23503).
   Every FK here that guards a row is RESTRICT, so a handler that knows
   only 23503 is a handler that never runs — which is what the first
   version of the archive fallback was. */
const REFERENCE_VIOLATION = new Set(["23001", "23503"]);

function isReferenceViolation(error) {
  return REFERENCE_VIOLATION.has(error?.code);
}

/* One sentence, in one place: several calls fail this way until the
   migration is run, and they should not each word it differently. */
const MIGRATION_18_MESSAGE =
  "Removing and hiding menu items is not set up yet. Run " +
  "supabase/18-remove-or-hide-a-menu-item.sql in the Supabase SQL " +
  "editor, then reload.";

/* The function is missing (42883), or PostgREST cannot see it yet
   (PGRST202) — both mean 18 has not been run. */
function migration18Missing(error) {
  return error?.code === "42883" || error?.code === "PGRST202";
}

/* Removing an item from the menu.

   Three outcomes, and the database decides between them inside one
   transaction (`remove_menu_item`, supabase/18):

     refused   a room still holds stock of it. Stock that is physically
               on a shelf must not vanish from the records with no line
               saying where it went, and the message names the item and
               the count so it can be dealt with.
     deleted   nothing has ever referenced it. The row goes, and
               room_stock and the image rows go with it by cascade.
     archived  it has traded. stock_movements.menu_item_id is `on delete
               restrict` because a sales ledger has to outlive the thing
               that sold, so the row stays with is_archived set.

   In one RPC rather than a query and a delete from here, for three
   reasons. `room_stock` has no write policy for anybody, so nothing
   holding an anon key can clear an item out of the rooms that carried
   it — and not clearing it is the bug this replaced: an archived item
   kept a row in every room, showing 0 on the Inventory screen with a
   Restock button that worked. The stock check and the delete have to be
   one statement or a sale can land between them. And a half-done
   retirement — rooms cleared but the item still on sale, or the item
   gone with rooms still listing it — is worse than either end state.

   For "take it off the menu but keep it", which is what people usually
   mean, there is Hide: is_hidden, reversible, and it touches nothing.
*/
export async function deleteMenuItem(id) {
  /* Read before the delete: on a real delete the image ROWS go by
     cascade, and these URLs are the only way to find the files
     afterwards. */
  const { data: images, error: imagesError } = await supabase
    .from("menu_item_images")
    .select("url")
    .eq("menu_item_id", id);

  if (imagesError) {
    console.error(imagesError);
    throw new Error("Menu item could not be removed");
  }

  const { data, error } = await supabase.rpc("remove_menu_item", {
    p_menu_item_id: id,
  });

  if (error) {
    console.error("[deleteMenuItem]", error, { id });
    if (migration18Missing(error)) throw new Error(MIGRATION_18_MESSAGE);
    throw new Error(explainRemoveError(error));
  }

  const archived = data === "archived";

  /* Only when the row itself is gone. An archived item still points at
     its photographs, and an admin who un-archives it in the SQL editor
     should not find a catalogue of broken images. */
  if (!archived) {
    for (const { url } of images) {
      const name = imageNameFrom(url);
      if (name)
        await supabase.storage.from(MENU_IMAGES_BUCKET).remove([name]);
    }
  }

  return { archived };
}

/* The function's own messages are written for the person reading the
   toast — they name the item, the count and the rooms — so they are
   passed through rather than replaced by something vaguer.

     P0003  a room still holds stock
     P0002  the item is already gone
     42501  not an admin
*/
function explainRemoveError(error) {
  const passThrough = new Set(["P0003", "P0002", "42501"]);
  if (passThrough.has(error?.code) && error?.message)
    return error.message;

  if (/row-level security/i.test(error?.message ?? ""))
    return "Only an admin can remove a menu item.";

  return "Menu item could not be removed";
}

/* Off the customer menu, still here.

   The third state, and the one the Delete button kept being used for:
   `is_available` is "sold out today" and the customer still sees the
   item; `is_archived` is "removed" and nobody does. This is neither —
   the item keeps its stock, its photographs, its history and its place
   in every room's list, and comes back with the same switch. */
export async function setMenuItemHidden(id, hidden) {
  return updateMenuItem(id, { is_hidden: Boolean(hidden) });
}

export async function duplicateMenuItem(item) {
  const newItem = {
    section_id: item.section_id,
    name: `Copy of ${item.name}`,
    description: item.description,
    price: item.price,
    currency: item.currency,
    is_available: item.is_available,
    is_featured: item.is_featured,
    is_stocked: item.is_stocked ?? false,
    sort_order: (item.sort_order ?? 0) + 1,
    preparation_time_minutes: item.preparation_time_minutes,
    calories: item.calories,
    allergens: item.allergens ?? [],
    dietary_tags: item.dietary_tags ?? [],
    ingredients: item.ingredients ?? [],
  };

  const { data, error } = await supabase
    .from("menu_items")
    .insert([newItem])
    .select()
    .single();
  if (error) throw new Error("Menu item could not be duplicated");

  // Copy the image rows — the URLs are public storage links, no re-upload.
  if (item.images?.length) {
    const rows = item.images.map(
      ({ url, alt_text, sort_order, is_primary }) => ({
        menu_item_id: data.id,
        url,
        alt_text,
        sort_order,
        is_primary,
      })
    );
    const { error: copyError } = await supabase
      .from("menu_item_images")
      .insert(rows);
    if (copyError) {
      console.error(copyError);
      throw new Error("Item duplicated, but its images could not be copied");
    }
  }

  return data;
}

// ---------------------------------------------------------------------------
// Item images
// ---------------------------------------------------------------------------

// Uploads a file to storage only — returns the storage object name and the
// public URL. The DB row is created separately (insertMenuItemImages) so a
// failed upload never leaves a half-created item behind.
export async function uploadMenuItemImage({ file, sortOrder }) {
  const imageName = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}-${file.name}`.replaceAll("/", "");
  const url = getMenuStoragePath(imageName);

  const { error: storageError } = await supabase.storage
    .from(MENU_IMAGES_BUCKET)
    .upload(imageName, file);
  if (storageError) {
    console.error(storageError);
    const bucketMissing =
      /bucket not found|nosuchbucket/i.test(storageError.message);
    throw new Error(
      bucketMissing
        ? `Photo could not be uploaded: the "${MENU_IMAGES_BUCKET}" storage bucket is missing. Run setup_menu_table.sql in the Supabase SQL editor to create it.`
        : `Photo could not be uploaded (${file.name})`
    );
  }

  return { name: imageName, url, sortOrder };
}

export async function insertMenuItemImages(rows) {
  const { error } = await supabase
    .from("menu_item_images")
    .insert(rows);
  if (error) {
    console.error(error);
    throw new Error("Photo could not be saved");
  }
}

/* How many photos an item already has.

   Used to decide whether a newly added one becomes the primary. `head:
   true` so this is a count, not a download of every row. */
export async function countMenuItemImages(menuItemId) {
  const { count, error } = await supabase
    .from("menu_item_images")
    .select("id", { count: "exact", head: true })
    .eq("menu_item_id", menuItemId);

  if (error) {
    console.error(error);
    throw new Error("Existing photos could not be counted");
  }

  return count ?? 0;
}

/* Attach ONE photo to an item that already exists: upload it, then
   record it.

   Both halves, deliberately. uploadMenuItemImage() only puts the file in
   the bucket — the row is a separate step, which is right for the create
   and edit forms because they upload before the item exists. But it made
   "add a photo to this item" a trap: the caller that only uploaded got a
   file in storage, no row, and a success toast for a photo that never
   appeared anywhere. That is what this function exists to prevent, and
   why the hook now calls this rather than the upload on its own.

   The first photo becomes the primary one. An item whose only photo is
   not its card image is not a state anybody would choose, and leaving it
   to a second click means every item added this way starts out with a
   gallery and a blank card.
*/
export async function attachMenuItemImage({ file, menuItemId }) {
  if (!menuItemId) throw new Error("Pick an item for the photo");
  if (!file) throw new Error("Pick a photo");

  const [sortOrder, existing] = await Promise.all([
    getNextImageSortOrder(menuItemId),
    countMenuItemImages(menuItemId),
  ]);

  const { name, url } = await uploadMenuItemImage({ file, sortOrder });

  try {
    await insertMenuItemImages([
      {
        menu_item_id: menuItemId,
        url,
        sort_order: sortOrder,
        is_primary: existing === 0,
      },
    ]);
  } catch (error) {
    /* The row is what makes the file findable, so a file with no row is
       litter in the bucket nothing will ever point at. Same cleanup the
       create and edit forms do when their insert fails. */
    await supabase.storage.from(MENU_IMAGES_BUCKET).remove([name]);
    throw error;
  }

  return { url, isPrimary: existing === 0 };
}

export async function getNextImageSortOrder(menuItemId) {
  const { data, error } = await supabase
    .from("menu_item_images")
    .select("sort_order")
    .eq("menu_item_id", menuItemId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (error) throw new Error("Photo order could not be loaded");
  return (data?.[0]?.sort_order ?? 0) + 1;
}

export async function updateMenuItemImage(id, updates) {
  const { error } = await supabase
    .from("menu_item_images")
    .update(updates)
    .eq("id", id);
  if (error) throw new Error("Photo could not be updated");
}

export async function setPrimaryMenuItemImage(itemId, imageId) {
  const { error: clearError } = await supabase
    .from("menu_item_images")
    .update({ is_primary: false })
    .eq("menu_item_id", itemId);
  if (clearError) throw new Error("Photo could not be updated");

  const { error } = await supabase
    .from("menu_item_images")
    .update({ is_primary: true })
    .eq("id", imageId);
  if (error) throw new Error("Photo could not be updated");
}

export async function deleteMenuItemImage(id) {
  const { data: [image], error: findError } = await supabase
    .from("menu_item_images")
    .select("url")
    .eq("id", id);
  if (findError) throw new Error("Photo could not be deleted");

  const { error } = await supabase
    .from("menu_item_images")
    .delete()
    .eq("id", id);
  if (error) throw new Error("Photo could not be deleted");

  const name = imageNameFrom(image?.url);
  if (name)
    await supabase.storage.from(MENU_IMAGES_BUCKET).remove([name]);

  return true;
}

export async function reorderMenuItemImages(itemId, orderedImages) {
  const updates = orderedImages.map((image, index) => ({
    id: image.id,
    sort_order: index,
  }));
  const { error } = await supabase
    .from("menu_item_images")
    .upsert(updates);
  if (error) throw new Error("Photo order could not be saved");
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export async function createMenuSection({ name, category_id, description }) {
  const { data: maxRow, error: maxError } = await supabase
    .from("menu_sections")
    .select("sort_order")
    .eq("category_id", category_id)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (maxError) throw new Error("Section could not be created");

  const sortOrder =
    (maxRow?.[0]?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("menu_sections")
    .insert([{ name, category_id, description, sort_order: sortOrder }])
    .select()
    .single();
  if (error) {
    console.error(error);
    const rlsMissing = /row-level security/i.test(error.message);
    throw new Error(
      rlsMissing
        ? "Section could not be created: RLS is blocking inserts. Run setup_menu_table.sql in the Supabase SQL editor to add the insert policies."
        : "Section could not be created"
    );
  }
  return data;
}

export async function updateMenuSection(id, updates) {
  const { data, error } = await supabase
    .from("menu_sections")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error(error);
    throw new Error("Section could not be updated");
  }
  return data;
}

/* Why a section that looks empty still refuses to go.

   menu_items.section_id is `on delete restrict` (setup_menu_table.sql),
   and an archived item is still a row in menu_items. So a section whose
   last live item was removed — archived, because it had sales history —
   shows "0 items" on the screen and cannot be deleted. That is correct:
   deleting the section would take the archived items with it, and with
   them the ledger's answer to what they sold for.

   What was wrong was the sentence. The old guard counted every row,
   archived or not, and always said "Move or delete its items first" —
   an instruction with nothing to carry it out on, pointing at a list
   the admin now shows as empty.

   So the two cases are told apart and worded separately: live items are
   something the admin can act on, archived ones are not, and the way
   out for those is the Hidden switch the section already has.
 */
const SECTION_HAS_LIVE_ITEMS =
  "This section still has menu items. Move or delete its items first.";

const SECTION_HAS_ARCHIVED_ITEMS =
  "This section still holds archived menu items, which are kept for their " +
  "sales history and cannot be removed. Hide the section instead — it stays " +
  "here and disappears from the customer menu.";

/* Which of the two it is, asked only once the database has refused. */
async function sectionBlockedMessage(id) {
  const [live, archived] = await Promise.all([
    supabase
      .from("menu_items")
      .select("id")
      .eq("section_id", id)
      .eq("is_archived", false)
      .limit(1),
    supabase
      .from("menu_items")
      .select("id")
      .eq("section_id", id)
      .eq("is_archived", true)
      .limit(1),
  ]);

  if (live.data?.length) return SECTION_HAS_LIVE_ITEMS;
  if (archived.data?.length) return SECTION_HAS_ARCHIVED_ITEMS;

  /* Either the counts could not be read, or something outside
     menu_items holds the section. Say what is known rather than
     inventing a reason. */
  return "This section is still in use somewhere and cannot be deleted.";
}

/* The DELETE goes first and the database decides, the same way
   deleteMenuItem works: no window for an item to be added between a
   pre-flight count and the delete, and a referencing table nobody
   thought of still produces an honest message instead of a wrong one. */
export async function deleteMenuSection(id) {
  const { error } = await supabase
    .from("menu_sections")
    .delete()
    .eq("id", id);

  if (!error) return;

  console.error(error);

  if (isReferenceViolation(error))
    throw new Error(await sectionBlockedMessage(id));

  throw new Error("Section could not be deleted");
}

// ---------------------------------------------------------------------------
// Ordering — persist sort_order for sections and items
// ---------------------------------------------------------------------------

export async function reorderMenuSections(orderedIds) {
  const updates = orderedIds.map((id, index) => ({
    id,
    sort_order: index,
  }));
  const { error } = await supabase
    .from("menu_sections")
    .upsert(updates);
  if (error) throw new Error("Section order could not be saved");
}

export async function reorderMenuItems(orderedIds) {
  const updates = orderedIds.map((id, index) => ({
    id,
    sort_order: index,
  }));
  const { error } = await supabase.from("menu_items").upsert(updates);
  if (error) throw new Error("Item order could not be saved");
}

// ---------------------------------------------------------------------------
// Helpers shared by hooks & tests
// ---------------------------------------------------------------------------

// Turns admin form input into a database payload, coerce strings to numbers
// and normalise arrays. Exported for unit testing.
export function normalizeMenuItemInput(input) {
  return {
    name: input.name?.trim(),
    description: input.description?.trim() || null,
    section_id: Number(input.section_id),
    price: Number(input.price),
    currency: input.currency || "RWF",
    preparation_time_minutes:
      input.preparation_time_minutes === "" ||
      input.preparation_time_minutes == null
        ? null
        : Number(input.preparation_time_minutes),
    calories:
      input.calories === "" || input.calories == null
        ? null
        : Number(input.calories),
    ingredients: (input.ingredients ?? [])
      .map((x) => x?.trim())
      .filter(Boolean),
    allergens: (input.allergens ?? []).map((x) => x?.trim()).filter(Boolean),
    dietary_tags: (input.dietary_tags ?? [])
      .map((x) => x?.trim())
      .filter(Boolean),
    is_available: input.is_available == null ? true : Boolean(input.is_available),
    is_featured: Boolean(input.is_featured),
    /* Whether this item is physically held in a room and counted there.
       Must be in this list or the checkbox on the form saves nothing:
       normalizeMenuItemInput builds the database payload from scratch, so
       a field it does not name is a field that silently does not exist. */
    is_stocked: Boolean(input.is_stocked),
    /* What one costs to buy. Named here for exactly the reason the
       comment above gives: this function builds the payload from
       scratch, so a buying price typed into any form that goes through
       it would otherwise be dropped on the floor without a word.
       Null rather than 0 when left blank — "never recorded" and "free"
       are different things, and only one of them should report a 100%
       margin. */
    cost_rwf:
      input.cost_rwf === "" || input.cost_rwf == null
        ? null
        : Number(input.cost_rwf),
    sort_order: Number(input.sort_order ?? 0),
  };
}