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
export async function createEditRoom(newRoom, id) {
  const hasImagePath = newRoom.image?.startsWith?.(supabaseUrl);
  const imageName = `${Math.random()}-${newRoom.image.name}`.replaceAll(
    "/",
    ""
  );
  const imagePath = hasImagePath
    ? newRoom.image
    : `${supabaseUrl}/storage/v1/object/public/room-images/${imageName}`;

  // 1. Create/edit room
  let query = supabase.from("rooms");

  // A) CREATE
  if (!id) {
    query = query.insert([{ ...newRoom, image: imagePath }]);
  }

  // B) EDIT
  if (id) {
    query = query.update({ ...newRoom, image: imagePath }).eq("id", id);
  }
  const { data, error } = await query.select().single();
  if (error) {
    throw new Error("Room could not be created");
  }
  if (hasImagePath) return data;
  // Uploads the image to the storage bucket named room-images
  const { error: storageError } = await supabase.storage
    .from("room-images")
    .upload(imageName, newRoom.image);

  if (storageError) {
    await supabase.from("rooms").delete().eq("id", data.id);
    throw new Error("Room image could not be uploaded");
  }
  return data;
}
