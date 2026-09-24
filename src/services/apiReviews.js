import supabase from "./supabase";
import { PAGE_SIZE } from "../utils/constants";

/* Guest reviews, as the moderation queue sees them.

   Nothing a guest writes reaches the public site on its own: rows are
   inserted as 'pending' and stay invisible until somebody here moves
   them to 'published'. That is what makes the star rating in Google's
   results defensible — every review behind it was read by a person
   before it counted. */

export const REVIEW_STATUSES = ["pending", "published", "rejected"];

export async function getReviews(filter, sortBy, page) {
  let query = supabase
    .from("reviews")
    .select("*, rooms(name), guests(fullName, email)", { count: "exact" });

  if (filter) {
    query = query[filter.method || "eq"](filter.field, filter.value);
  }

  if (sortBy) {
    query = query.order(sortBy.field, {
      ascending: sortBy.direction === "asc",
    });
  }

  if (page) {
    const from = (page - 1) * PAGE_SIZE;
    const to = page * PAGE_SIZE;
    query = query.range(from, to);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error loading reviews:", error);
    throw new Error("Reviews could not be loaded");
  }

  return { data, count };
}

/* How many reviews are waiting to be read — the number on the nav badge.
   `head: true` asks Postgres for the count without shipping the rows. */
export async function getPendingReviewCount() {
  const { count, error } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) {
    console.error("Error counting pending reviews:", error);
    throw new Error("Pending reviews could not be counted");
  }

  return count ?? 0;
}

/* Publish, reject, or send a review back to the queue.

   `published_at` is deliberately NOT set here. A trigger on the table
   owns it: it stamps the row on the way to 'published' and clears it on
   the way out again. Setting it from two places is how it ends up
   disagreeing with `status`. */
export async function setReviewStatus(id, status) {
  if (!REVIEW_STATUSES.includes(status))
    throw new Error(`Unknown review status "${status}"`);

  const { data, error } = await supabase
    .from("reviews")
    .update({ status })
    .eq("id", id)
    .select("*, rooms(name)")
    .single();

  if (error) {
    console.error("Error updating review:", error);
    throw new Error("Review status could not be updated");
  }

  return data;
}

export async function deleteReview(id) {
  const { data, error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", id)
    .select("*, rooms(name)")
    .single();

  if (error) {
    console.error("Error deleting review:", error);
    throw new Error("Review could not be deleted");
  }

  return data;
}
