// For each of our tables in our database, we create one service
import supabase, { supabaseUrl } from "./supabase";

export async function getRoomImages(roomId) {
  const { data, error } = await supabase
    .from("room_images")
    .select("id, url, sort_order")
    .eq("room_id", roomId)
    .order("sort_order");

  if (error) {
    throw new Error("Room photos could not be loaded");
  }
  return data;
}

export async function createRoomImage(file, roomId, sortOrder) {
  const imageName = `${Math.random()}-${file.name}`.replaceAll("/", "");
  const url = `${supabaseUrl}/storage/v1/object/public/room-images/${imageName}`;

  const { error: storageError } = await supabase.storage
    .from("room-images")
    .upload(imageName, file);
  if (storageError) {
    throw new Error("Photo could not be uploaded");
  }

  const { data, error } = await supabase
    .from("room_images")
    .insert([{ room_id: roomId, url, sort_order: sortOrder }])
    .select()
    .single();
  if (error) {
    throw new Error("Photo could not be saved");
  }
  return data;
}

export async function deleteRoomImage(id) {
  const { error } = await supabase.from("room_images").delete().eq("id", id);
  if (error) {
    throw new Error("Photo could not be deleted");
  }
}

export async function getRooms() {
  const { data, error } = await supabase.from("rooms").select("*");

  if (error) {
    throw new Error("Rooms could not be loaded");
  }
  return data;
}
export async function deleteRoom(id) {
  const { data, error } = await supabase
    .from("rooms")
    .delete()
    .eq("id", id)
    .select();
  if (error) {
    throw new Error("Room could not be deleted");
  }
  return data;
}

/* The columns a room is actually made of, and what each one is.

   The edit form is seeded with the whole row, so react-hook-form hands
   back every column it was given — `id` and `created_at` included —
   alongside the handful anybody typed into. Spreading that straight into
   an UPDATE rewrites a room's primary key and its creation date with
   themselves on every save, and any column that is later dropped,
   renamed or made read-only turns every save into a failure with no
   clue attached. Naming the writable columns here is what keeps the
   payload to the fields this form is actually for.

   The types matter as much as the names: an <input type="number">
   yields a STRING, and "" from an untouched one is neither a number nor
   null. Postgres accepts neither in a numeric column. */
const ROOM_COLUMNS = {
  name: "text",
  description: "text",
  image: "text",
  room_type: "text",
  maxCapacity: "number",
  regularPrice: "number",
  discount: "number",
  hour_rate_rwf: "number",
  day_rate_rwf: "number",
  month_rate_usd: "number",
  is_archived: "boolean",
  discount_valid_from: "raw",
  discount_valid_until: "raw",
};

function roomPayload(room) {
  const payload = {};

  for (const [column, kind] of Object.entries(ROOM_COLUMNS)) {
    if (!(column in room)) continue;
    const value = room[column];

    if (kind === "number") {
      if (value === "" || value === null || value === undefined) {
        payload[column] = null;
        continue;
      }
      const parsed = Number(value);
      payload[column] = Number.isFinite(parsed) ? parsed : null;
      continue;
    }

    if (kind === "boolean") {
      payload[column] = Boolean(value);
      continue;
    }

    payload[column] = value;
  }

  return payload;
}

/* What went wrong, in the words of whatever actually refused.

   The old message was the single string "Room could not be created",
   thrown for every failure and on the edit path too — so a room that
   would not save said it could not be CREATED, and said nothing about
   why. The commonest cause is the one it hid best: row-level security
   lets a non-admin's UPDATE match zero rows, PostgREST returns an empty
   result, and .single() turns that into an error that has nothing to do
   with the data being wrong. */
function roomWriteError(error, isEdit) {
  /* PGRST116: the statement ran and touched no rows. On an edit that is
     almost always the rooms policy — changing a room is admin-only — and
     occasionally a room deleted from another tab. */
  if (error?.code === "PGRST116")
    return new Error(
      isEdit
        ? "The database accepted the request but changed nothing. Room changes are admin-only — if this account is signed in as staff, an admin has to make the change or promote the account."
        : "The room was not saved. Adding a room is admin-only — if this account is signed in as staff, an admin has to add it.",
    );

  // 42501 is an outright RLS refusal, which an INSERT gets where an
  // UPDATE quietly matches nothing.
  if (error?.code === "42501")
    return new Error(
      `Not allowed: changing rooms is admin-only, and this account is not an admin.`,
    );

  if (error?.code === "PGRST204" || error?.code === "42703")
    return new Error(
      `The rooms table is missing a column this form writes (${error.message}). Run the migrations in supabase/ and reload.`,
    );

  /* Anything else is reported in the database's own words. The callers
     already say which operation failed ("Failed to update room: …"), so
     repeating it here would only push the useful half off the toast. */
  return new Error(error?.message || "the database gave no reason");
}

export async function createEditRoom(newRoom, id) {
  const isEdit = Boolean(id);

  /* A string here is the photo the room already has, whatever host it
     lives on; a File is a new one being uploaded. Tested by shape rather
     than by matching the storage URL, because a room seeded with a photo
     from anywhere else is still a room with a photo, and an edit that
     did not touch it must not be made to re-pick one.

     `?.name` rather than `.name` for the third shape: opening the file
     dialog and cancelling leaves an empty FileList behind, whose [0] is
     undefined — and reading `.name` off that is what used to throw
     before the request was even made. */
  const hasImagePath = typeof newRoom.image === "string" && newRoom.image !== "";
  const isNewFile = Boolean(newRoom.image?.name);

  const imageName = isNewFile
    ? `${Math.random()}-${newRoom.image.name}`.replaceAll("/", "")
    : null;
  const imagePath = isNewFile
    ? `${supabaseUrl}/storage/v1/object/public/room-images/${imageName}`
    : hasImagePath
      ? newRoom.image
      : null;

  if (!imagePath)
    throw new Error("Pick a photo for this room before saving it");

  const payload = roomPayload({ ...newRoom, image: imagePath });

  // 1. Create/edit room
  let query = supabase.from("rooms");

  // A) CREATE
  if (!isEdit) {
    query = query.insert([payload]);
  }

  // B) EDIT
  if (isEdit) {
    query = query.update(payload).eq("id", id);
  }

  /* maybeSingle, not single: "no rows came back" is a distinct outcome
     worth its own message, and .single() flattens it into the same error
     as a malformed statement. */
  const { data, error } = await query.select().maybeSingle();

  if (error) {
    console.error("[createEditRoom]", error, "payload:", payload);
    throw roomWriteError(error, isEdit);
  }
  if (!data) {
    console.error("[createEditRoom] no row returned", "payload:", payload);
    throw roomWriteError({ code: "PGRST116" }, isEdit);
  }

  if (!isNewFile) return data;

  // Uploads the image to the storage bucket named room-images
  const { error: storageError } = await supabase.storage
    .from("room-images")
    .upload(imageName, newRoom.image);

  if (storageError) {
    /* Only a brand-new room is rolled back. Deleting the row on an EDIT
       would destroy an existing room — and every booking that references
       it — because a photo failed to upload. */
    if (!isEdit) await supabase.from("rooms").delete().eq("id", data.id);
    throw new Error(
      isEdit
        ? `The room was saved, but the new photo could not be uploaded: ${storageError.message}`
        : `Room image could not be uploaded: ${storageError.message}`,
    );
  }
  return data;
}
