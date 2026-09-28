/* Stock in the rooms: what is there, and every movement in and out.

   Two tables, with a deliberate division of labour (see
   supabase/03-inventory.sql):

     stock_movements  the ledger. Append-only. The source of truth, and
                      the only thing this file ever WRITES.
     room_stock       the current count. A trigger-maintained running
                      total of the ledger, and read-only from here.

   Nothing in this file updates a quantity directly, and it could not if
   it tried: `room_stock` has no insert, update or delete policy for
   anybody. Recording a movement is how a count changes, which is what
   makes "the count" and "the explanation for the count" impossible to
   disagree.
*/

import supabase from "./supabase";

const MISSING_TABLE = new Set(["42P01", "PGRST205"]);

function migrationNotRun(error) {
  return MISSING_TABLE.has(error?.code);
}

const SETUP_MESSAGE =
  "The stock tables do not exist yet. Run supabase/03-inventory.sql in the Supabase SQL editor, then reload.";

/* ------------------------------------------------------------------
   Reading
   ------------------------------------------------------------------ */

/* Everything the inventory screen needs, in one round trip per table.

   Joined rather than fetched per room: four rooms times a dozen items is
   a nested select PostgREST does in one query, and doing it per room
   would be the classic screen that gets slower as the business grows.
*/
export async function getInventory() {
  const { data, error } = await supabase
    .from("room_stock")
    .select(
      `id, room_id, menu_item_id, quantity, par_level, updated_at,
       rooms ( id, name, room_type ),
       menu_items (
         id, name, price, cost_rwf, currency, is_available, is_archived, section_id,
         menu_sections ( id, name, category_id, menu_categories ( id, name ) ),
         menu_item_images ( url, is_primary, sort_order )
       )`,
    )
    .order("room_id");

  if (error) {
    if (migrationNotRun(error)) throw new Error(SETUP_MESSAGE);
    console.error(error);
    throw new Error("Stock levels could not be loaded");
  }

  /* An archived item that a room has run down to zero is not a row —
     it is the residue of a removal that could not delete the item
     because the ledger holds it. Those rows are what made a deleted
     snack go on appearing in every room at 0, with a Restock button
     that worked and put stock into a room for something the menu would
     never show again.

     supabase/18 clears them at the source and stops new ones being
     made; this keeps the screen right on a database where it has not
     been run yet.

     An archived item that still shows stock is NOT dropped. That is a
     real disagreement between the shelf and the records, and hiding it
     would leave somebody holding stock the system has forgotten —
     InventoryRow flags it instead. */
  return (data ?? [])
    .map(shapeStockRow)
    .filter((row) => !(row.isArchived && row.quantity === 0));
}

/* Flatten the nested join into something a row component can render
   without reaching through four levels, and pick the one photograph that
   represents the item. */
function shapeStockRow(row) {
  const item = row.menu_items ?? {};
  const images = item.menu_item_images ?? [];

  /* is_primary is the chosen one; otherwise the first by sort order, so
     an item whose photos were uploaded but never marked still shows one.
     Sorted defensively because PostgREST does not order a nested select
     for us. */
  const primary =
    images.find((image) => image.is_primary) ??
    [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];

  return {
    id: row.id,
    roomId: row.room_id,
    roomName: row.rooms?.name ?? "Unknown room",
    roomType: row.rooms?.room_type ?? "meeting_room",
    menuItemId: row.menu_item_id,
    name: item.name ?? "Unknown item",
    price: Number(item.price) || 0,
    /* null, not 0, when no buying price was ever recorded. An item with
       no cost would otherwise report a 100% margin — wrong, and the most
       flattering possible way to be wrong. utils/stock.js reads this
       null and says "not known" instead. */
    cost_rwf: item.cost_rwf == null ? null : Number(item.cost_rwf),
    currency: item.currency ?? "RWF",
    categoryName: item.menu_sections?.menu_categories?.name ?? null,
    sectionName: item.menu_sections?.name ?? null,
    isArchived: Boolean(item.is_archived),
    imageUrl: primary?.url ?? null,
    quantity: Number(row.quantity) || 0,
    par_level: Number(row.par_level) || 0,
    updatedAt: row.updated_at,
  };
}

/* The catalogue of things that CAN be stocked, for the "add an item to
   this room" picker.

   `is_stocked` is what separates a bottle of water from grilled tilapia:
   one lives in a fridge and has a count, the other is cooked to order and
   does not. Both are menu_items, because a Coke has one name, one price
   and one photograph wherever it appears. */
export async function getStockableItems() {
  const { data, error } = await supabase
    .from("menu_items")
    .select(
      `id, name, price, cost_rwf, currency, is_stocked, is_archived, section_id,
       menu_sections ( id, name, category_id, menu_categories ( id, name ) ),
       menu_item_images ( url, is_primary, sort_order )`,
    )
    .eq("is_stocked", true)
    .order("name");

  if (error) {
    // 42703: `is_stocked` does not exist yet.
    if (migrationNotRun(error) || error.code === "42703")
      throw new Error(SETUP_MESSAGE);
    console.error(error);
    throw new Error("Stockable items could not be loaded");
  }

  return (data ?? [])
    .filter((item) => !item.is_archived)
    .map((item) => shapeStockRow({ menu_items: item, quantity: 0, par_level: 0 }));
}

/* What needs restocking, and enough about it to say so in a sentence.

   Deliberately reads the same rows the page does rather than asking the
   database for a count: "low" is par_level-relative and a par of 0 means
   "no target", which is a rule that lives in stock.js and must not be
   re-expressed as a slightly different SQL filter that drifts from it.

   It pulls the two NAMES as well as the numbers, which the sidebar badge
   does not need — because the alert does. "4 items need restocking" is a
   number somebody has to go and investigate; "Meeting Room 02 is out of
   Snickers" is something they can act on without leaving the desk. One
   query serves both, so the badge and the alert can never disagree about
   what is low.
*/
export async function getLowStockRows() {
  const { data, error } = await supabase
    .from("room_stock")
    .select(
      `id, room_id, menu_item_id, quantity, par_level, updated_at,
       rooms ( id, name ),
       menu_items ( id, name, is_archived )`,
    );

  if (error) {
    // The badge is decoration. It must never be the thing that breaks
    // the sidebar, so a failure here is silent and counts as zero.
    if (!migrationNotRun(error)) console.error(error);
    return [];
  }

  return (data ?? [])
    /* An item nobody carries any more is not a restock job. Without
       this, archiving something leaves it on the alert list for ever
       and the badge becomes a number people learn to ignore. */
    .filter((row) => !row.menu_items?.is_archived)
    .map((row) => ({
      id: row.id,
      roomId: row.room_id,
      roomName: row.rooms?.name ?? "Unknown room",
      menuItemId: row.menu_item_id,
      name: row.menu_items?.name ?? "Unknown item",
      quantity: Number(row.quantity) || 0,
      par_level: Number(row.par_level) || 0,
      updatedAt: row.updated_at,
    }));
}

/* The ledger, for a date range. What the revenue screens read. */
export async function getStockMovements({ from, to, roomId } = {}) {
  let query = supabase
    .from("stock_movements")
    .select(
      `id, room_id, menu_item_id, delta, reason,
       unit_price_rwf, unit_cost_rwf,
       revenue_rwf, cogs_rwf, spend_rwf, profit_rwf,
       booking_id, actor_id, note, created_at,
       rooms ( id, name, room_type ),
       menu_items ( id, name, currency )`,
    )
    .order("created_at", { ascending: false });

  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);
  if (roomId) query = query.eq("room_id", roomId);

  const { data, error } = await query;

  if (error) {
    if (migrationNotRun(error)) throw new Error(SETUP_MESSAGE);
    console.error(error);
    throw new Error("Stock movements could not be loaded");
  }

  return data ?? [];
}

/* ------------------------------------------------------------------
   Writing — one function, because there is one kind of write
   ------------------------------------------------------------------ */

/* Record a movement.

   `delta` is already signed (see deltaFor() in utils/stock.js) and the
   database checks that its sign agrees with the reason, so a "sale" of
   +5 is rejected rather than quietly adding stock and booking revenue.

   `unitPriceRwf` is captured HERE, at the moment of sale, rather than
   read from menu_items when a report runs. Prices change; what a customer
   paid in March does not, and a sales report that re-prices history every
   time somebody edits the menu is not a report. The database enforces
   that a sale has one.

   Revenue is NOT passed: `revenue_rwf` is a generated column, computed as
   abs(delta) × unit_price for a sale and zero for everything else. There
   is no argument here that could claim otherwise, which is the point.
*/
export async function recordStockMovement({
  roomId,
  menuItemId,
  delta,
  reason,
  unitPriceRwf = null,
  /* Left null for a sale on purpose: the database fills it from the
     item's current cost (default_stock_movement_prices() in
     10-snack-costs.sql), so a member of staff selling a bottle never has
     to know — or be shown — what it cost to buy. Passed explicitly only
     where the caller genuinely knows better, such as a correction. */
  unitCostRwf = null,
  bookingId = null,
  actorId = null,
  note = "",
}) {
  if (!roomId) throw new Error("Pick a room");
  if (!menuItemId) throw new Error("Pick an item");
  if (!delta) throw new Error("Say how many");

  const { data, error } = await supabase
    .from("stock_movements")
    .insert([
      {
        room_id: roomId,
        menu_item_id: menuItemId,
        delta,
        reason,
        unit_price_rwf: unitPriceRwf,
        unit_cost_rwf: unitCostRwf,
        booking_id: bookingId,
        actor_id: actorId,
        note: String(note ?? "").slice(0, 500) || null,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("[recordStockMovement]", error, { roomId, menuItemId, delta, reason });
    throw new Error(explainStockError(error, reason));
  }

  return data;
}

/* Record a delivery AND update what the item costs and sells for, in one
   transaction.

   The two have to move together. A crate that came in dearer this week
   recorded at the new cost, against an item still carrying last week's,
   leaves the fridge reporting a margin that was never real — and the gap
   is invisible, because both halves look right on their own screen.

   An RPC rather than two calls for exactly that reason: `restock_with_prices`
   (10-snack-costs.sql) re-prices the item and writes the ledger line
   inside one transaction, so there is no window in which one has
   happened and the other has not.

   A null price means "leave it alone", never "clear it" — the function
   coalesces on both sides. Clearing a cost by leaving a box empty would
   be one keystroke away and would show up as a 100% margin.
*/
export async function restockWithPrices({
  roomId,
  menuItemId,
  quantity,
  unitCostRwf = null,
  unitPriceRwf = null,
  actorId = null,
  note = "",
}) {
  if (!roomId) throw new Error("Pick a room");
  if (!menuItemId) throw new Error("Pick an item");

  const count = Math.floor(Number(quantity) || 0);
  if (count <= 0) throw new Error("Say how many arrived");

  const { data, error } = await supabase.rpc("restock_with_prices", {
    p_room_id: roomId,
    p_menu_item_id: menuItemId,
    p_quantity: count,
    p_unit_cost: numberOrNull(unitCostRwf),
    p_unit_price: numberOrNull(unitPriceRwf),
    p_actor_id: actorId,
    p_note: String(note ?? "").slice(0, 500) || null,
  });

  if (error) {
    // 42883: the function does not exist — 10-snack-costs.sql has not run.
    if (error.code === "42883" || migrationNotRun(error))
      throw new Error(
        "Buying prices are not set up yet. Run supabase/10-snack-costs.sql in the Supabase SQL editor, then reload.",
      );
    console.error("[restockWithPrices]", error, { roomId, menuItemId, count });
    throw new Error(explainStockError(error, "restock"));
  }

  /* The RPC returns the movement row. PostgREST gives a composite back
     bare, but an array if the signature is ever widened to a set, so both
     shapes are handled rather than one of them becoming a silent
     undefined in the toast. */
  return Array.isArray(data) ? data[0] : data;
}

/* "" and null both mean "not given" and must not become 0 — a cost of
   zero is a claim (it was free), and the RPC treats null as "unchanged".
   Number("") is 0, which is why this cannot just be Number(). */
function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/* Move stock from one room to another.

   ONE call, because it is one action. The ledger records a transfer as
   two lines — a `transfer_out` from the source and a matching
   `transfer_in` at the destination — and writing them from here as two
   inserts would be wrong twice over:

     a failure between them leaves stock that has left one room and
     arrived in none, which is invisible and, because the ledger is
     append-only, cannot be tidied away afterwards;

     and the RLS lets staff record what goes OUT of a room but reserves
     what comes IN for admins, so the desk would be allowed the first
     insert and refused the second.

   `transfer_stock` (13-transfer-stock.sql) writes both inside one
   transaction, and is SECURITY DEFINER with its own is_desk() check —
   moving stock the business already owns is not a purchase, so anybody
   who may take it out of a room may move it to another.
*/
export async function transferStock({
  fromRoomId,
  toRoomId,
  menuItemId,
  quantity,
  actorId = null,
  note = "",
}) {
  if (!fromRoomId) throw new Error("Pick a room to send from");
  if (!toRoomId) throw new Error("Pick a room to send to");
  if (!menuItemId) throw new Error("Pick an item");
  if (fromRoomId === toRoomId)
    throw new Error("That is the same room. Pick a different room to send to.");

  const count = Math.abs(Math.floor(Number(quantity) || 0));
  if (count === 0) throw new Error("Say how many to send");

  const { data, error } = await supabase.rpc("transfer_stock", {
    p_from_room_id: fromRoomId,
    p_to_room_id: toRoomId,
    p_menu_item_id: menuItemId,
    p_quantity: count,
    p_actor_id: actorId,
    p_note: String(note ?? "").slice(0, 400) || null,
  });

  if (error) {
    // 42883: the function does not exist — 13 has not been run.
    if (error.code === "42883" || migrationNotRun(error))
      throw new Error(
        "Moving stock between rooms is not set up yet. Run supabase/13-transfer-stock.sql in the Supabase SQL editor, then reload.",
      );
    console.error("[transferStock]", error, { fromRoomId, toRoomId, menuItemId, count });
    throw new Error(explainStockError(error, "transfer_out"));
  }

  /* The function returns both legs. The out-leg is the one the source
     room's screen cares about, and it is written first. */
  const rows = Array.isArray(data) ? data : [data].filter(Boolean);
  return {
    out: rows.find((row) => row?.reason === "transfer_out") ?? rows[0] ?? null,
    in: rows.find((row) => row?.reason === "transfer_in") ?? null,
    units: count,
  };
}

/* Set how much of an item a room should carry.

   Through an RPC rather than an update, because `room_stock` has no write
   policy at all — quantity belongs to the ledger, and opening the table
   for par levels would open it for quantities too. The function is
   SECURITY DEFINER with its own is_admin() check inside. */
export async function setParLevel({ roomId, menuItemId, parLevel }) {
  const { data, error } = await supabase.rpc("set_stock_par_level", {
    p_room_id: roomId,
    p_menu_item_id: menuItemId,
    p_par_level: Math.max(0, Math.floor(Number(parLevel) || 0)),
  });

  if (error) {
    console.error("[setParLevel]", error);
    throw new Error(explainStockError(error));
  }

  return data;
}

/* Take an item out of a room's list entirely.

   Not a movement: this says "we do not carry this here", which is a
   different statement from "we have none right now". Only possible when
   the count is already zero — otherwise the stock that is physically
   there would vanish from the records without any line explaining where
   it went, which is exactly what the ledger exists to prevent.

   Through an RPC, and this one had to change: it used to delete from
   `room_stock` directly, which cannot work. That table has no delete
   policy and `authenticated` is granted select on it and nothing else,
   so every press came back 42501 — "You do not have permission to do
   that" — for an admin who plainly did. `remove_item_from_room`
   (supabase/18) is SECURITY DEFINER with its own is_admin() gate and
   makes the same zero check the database can actually enforce.
*/
export async function removeItemFromRoom({ roomId, menuItemId, quantity }) {
  /* Still checked here as well as in the function. The count is already
     on screen, so the answer is instant and nobody waits on a round
     trip to be told what the row in front of them says. */
  if (Number(quantity) > 0)
    throw new Error(
      `There are still ${quantity} in this room. Record them as sold, removed or written off first — then this item can be taken off the list.`,
    );

  const { error } = await supabase.rpc("remove_item_from_room", {
    p_room_id: roomId,
    p_menu_item_id: menuItemId,
  });

  if (error) {
    // 42883 / PGRST202: the function does not exist — 18 has not run.
    if (error.code === "42883" || error.code === "PGRST202")
      throw new Error(
        "Taking an item off a room's list is not set up yet. Run supabase/18-remove-or-hide-a-menu-item.sql in the Supabase SQL editor, then reload.",
      );
    console.error("[removeItemFromRoom]", error, { roomId, menuItemId });
    // P0003 is the function's own "there are still N here", which names
    // the count and the item better than anything written here could.
    if (error.code === "P0003" && error.message) throw new Error(error.message);
    throw new Error(explainStockError(error));
  }

  return true;
}

/* ------------------------------------------------------------------
   Turning Postgres errors into sentences
   ------------------------------------------------------------------ */

/* Each of these is a rule the database is enforcing on purpose, and each
   one reads like a malfunction if it is reported raw. */
function explainStockError(error, reason) {
  const message = error?.message ?? "";

  /* The apply_stock_movement() trigger's own message, which already names
     the item and both counts ("Not enough Coke in stock: 2 left, 5
     requested"). Better than anything that could be written here, so it
     is passed through rather than replaced. */
  if (/not enough .* in stock/i.test(message)) return message;

  if (error?.code === "42501" || /row-level security/i.test(message)) {
    if (reason === "restock" || reason === "transfer_in")
      return "Only an admin can add stock. Ask an admin to restock this.";
    if (reason === "correction")
      return "Only an admin can correct a count.";
    return "You do not have permission to do that.";
  }

  if (/append-only/i.test(message)) return message;

  if (error?.code === "23514") {
    if (/sign_matches_reason/i.test(message))
      return "That quantity goes the wrong way for that reason.";
    if (/sale_has_price/i.test(message))
      return "A sale needs a price. Set one on the item in the Menu page.";
    return message;
  }

  if (error?.code === "23503")
    return "That room or item no longer exists. Reload and try again.";

  return "The stock movement could not be recorded";
}
