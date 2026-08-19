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
    supabase
      .from("menu_items")
      .select("*")
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
    throw new Error("Menu item could not be updated");
  }
  return data;
}

export async function deleteMenuItem(id) {
  const { data: images, error: imagesError } = await supabase
    .from("menu_item_images")
    .select("url")
    .eq("menu_item_id", id);

  if (imagesError) throw new Error("Menu item could not be deleted");

  const { error } = await supabase.from("menu_items").delete().eq("id", id);
  if (error) throw new Error("Menu item could not be deleted");

  // Best effort storage cleanup — the rows are already gone via cascade.
  for (const { url } of images) {
    const name = imageNameFrom(url);
    if (name)
      await supabase.storage.from(MENU_IMAGES_BUCKET).remove([name]);
  }

  return true;
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

export async function deleteMenuSection(id) {
  const { data: items, error: checkError } = await supabase
    .from("menu_items")
    .select("id")
    .eq("section_id", id)
    .limit(1);
  if (checkError) throw new Error("Section could not be deleted");

  if (items.length > 0)
    throw new Error(
      "This section still has menu items. Move or delete its items first."
    );

  const { error } = await supabase
    .from("menu_sections")
    .delete()
    .eq("id", id);
  if (error) throw new Error("Section could not be deleted");
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
    sort_order: Number(input.sort_order ?? 0),
  };
}