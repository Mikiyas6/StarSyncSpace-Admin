import { useState } from "react";
import {
  addHours,
  differenceInHours,
  isFuture,
  isPast,
  isToday,
} from "date-fns";
import supabase from "../services/supabase";
import Button from "../ui/Button";

import { bookings } from "./data-bookings";
import { rooms } from "./data-rooms";
import { guests } from "./data-guests";

async function deleteGuests() {
  const { error } = await supabase.from("guests").delete().gt("id", 0);
  if (error) console.log(error.message);
}

async function deleteRooms() {
  const { error } = await supabase.from("rooms").delete().gt("id", 0);
  if (error) console.log(error.message);
}

async function deleteBookings() {
  const { error } = await supabase.from("bookings").delete().gt("id", 0);
  if (error) console.log(error.message);
}

async function createGuests() {
  const { error } = await supabase.from("guests").insert(guests);
  if (error) console.log(error.message);
}

async function createRooms() {
  const { error } = await supabase.from("rooms").insert(rooms);
  if (error) console.log(error.message);
}

async function createBookings() {
  // Get all guest IDs
  const { data: guestsIds } = await supabase
    .from("guests")
    .select("id")
    .order("id");
  const allGuestIds = guestsIds.map((guest) => guest.id);

  // Get all room IDs
  const { data: roomsIds } = await supabase
    .from("rooms")
    .select("id")
    .order("id");
  const allRoomIds = roomsIds.map((room) => room.id);

  const finalBookings = bookings.map((booking) => {
    const room = rooms.at(booking.roomId - 1);
    const startTime = new Date(booking.startTime);
    const endTime = addHours(startTime, 2);
    const numHours = differenceInHours(endTime, startTime);
    const cabinPrice = numHours * (room.regularPrice - room.discount);
    const totalPrice = cabinPrice;

    let status;
    if (
      isPast(new Date(booking.endTime)) &&
      !isToday(new Date(booking.endTime))
    )
      status = "completed";
    if (
      isFuture(new Date(booking.startTime)) ||
      isToday(new Date(booking.startTime))
    )
      status = "booked";
    if (
      (isFuture(new Date(booking.endTime)) ||
        isToday(new Date(booking.endTime))) &&
      isPast(new Date(booking.startTime)) &&
      !isToday(new Date(booking.startTime))
    )
      status = "in-use";

    return {
      ...booking,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      numHours,
      cabinPrice,
      extrasPrice: 0,
      totalPrice,
      guestId: allGuestIds.at(booking.guestId - 1),
      roomId: allRoomIds.at(booking.roomId - 1),
      status,
    };
  });

  console.log("Uploading bookings:", finalBookings);

  const { error } = await supabase.from("bookings").insert(finalBookings);
  if (error) {
    console.error("Error uploading bookings:", error);
    throw new Error("Bookings could not be created");
  }
}

function Uploader() {
  const [isLoading, setIsLoading] = useState(false);

  async function uploadAll() {
    setIsLoading(true);
    // Bookings need to be deleted FIRST
    await deleteBookings();
    await deleteGuests();
    await deleteRooms();

    // Bookings need to be created LAST
    await createGuests();
    await createRooms();
    await createBookings();

    setIsLoading(false);
  }

  async function uploadBookings() {
    setIsLoading(true);
    await deleteBookings();
    await createBookings();
    setIsLoading(false);
  }

  return (
    <div
      style={{
        marginTop: "auto",
        backgroundColor: "var(--color-brand-100)",
        padding: "8px",
        borderRadius: "5px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <h3 style={{ color: "var(--color-brand-500)" }}>SAMPLE DATA</h3>

      <Button onClick={uploadAll} disabled={isLoading}>
        Upload ALL
      </Button>

      <Button onClick={uploadBookings} disabled={isLoading}>
        Upload bookings ONLY
      </Button>
    </div>
  );
}

export default Uploader;